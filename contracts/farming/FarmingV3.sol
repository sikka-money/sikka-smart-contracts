// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { EnumerableSetUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import { IUniswapV3Pool } from "./uniswapv3/interfaces/IUniswapV3Pool.sol";
import { NFTPositionInfo } from "./uniswapv3/libraries/NFTPositionInfo.sol";
import { IUniswapV3Factory } from "./uniswapv3/interfaces/IUniswapV3Factory.sol";
import { INonfungiblePositionManager } from "./uniswapv3/interfaces/INonfungiblePositionManager.sol";

import { IFarming } from "./interfaces/IFarming.sol";
import { IStrategy } from "./interfaces/IStrategy.sol";
import { ITokenBonding } from "./interfaces/ITokenBonding.sol";
import { IIncentiveVoting } from "./interfaces/IIncentiveVoting.sol";

contract FarmingV3 is IFarming, Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

  // Info of each user.
  struct UserInfo {
    uint256 shares;
    uint256 rewardDebt;
    uint256 claimable;
    uint256 tokenId;
  }

  // Info of each pool.
  struct PoolInfo {
    address token;
    bool isUniswapV3;
    IStrategy strategy;
    uint256 rewardsPerSecond;
    uint256 lastRewardTime; // Last second that reward distribution occurs.
    uint256 accRewardPerShare; // Accumulated rewards per share, times 1e12. See below.
  }

  uint256 internal constant WEEK = 1 weeks;

  // Info of each pool.
  // address[] public registeredTokens;
  // mapping(address => PoolInfo) public poolInfo;
  PoolInfo[] public poolInfo; // Info of each pool.

  // pid => user => Info of each user that stakes LP tokens.
  mapping(uint256 => mapping(address => UserInfo)) public userInfo;
  // The timestamp when reward mining starts.
  uint256 public startTime;

  // account earning rewards => receiver of rewards for this account
  // if receiver is set to address(0), rewards are paid to the earner
  // this is used to aid 3rd party contract integrations
  mapping(address => address) public claimReceiver;

  // when set to true, other accounts cannot call
  // `deposit` or `claim` on behalf of an account
  mapping(address => bool) public blockThirdPartyActions;

  IERC20Upgradeable public rewardToken;
  IIncentiveVoting public incentiveVoting;

  // uniswap pool => pid
  mapping(address => uint256) public uniPoolToPid;
  mapping(address => mapping(address => EnumerableSetUpgradeable.UintSet)) internal _userToTokenId;

  IUniswapV3Factory public factory;
  INonfungiblePositionManager public nonfungiblePositionManager;

  event Deposit(address indexed caller, address indexed user, uint256 indexed pid, uint256 amount);
  event DepositV3(
    address indexed caller,
    address indexed user,
    uint256 indexed pid,
    uint256 tokenId
  );
  event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
  event WithdrawV3(address indexed user, uint256 indexed pid, uint256 tokenId);
  event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
  event ClaimedReward(
    address indexed caller,
    address indexed claimer,
    address indexed receiver,
    uint256 amount
  );

  function initialize(
    IERC20Upgradeable _rewardToken,
    IIncentiveVoting _incentiveVoting,
    IUniswapV3Factory _factory,
    INonfungiblePositionManager _nonfungiblePositionManager
  ) public initializer {
    __ReentrancyGuard_init();
    __Ownable_init();
    startTime = _incentiveVoting.startTime();
    rewardToken = _rewardToken;
    incentiveVoting = _incentiveVoting;
    factory = _factory;
    nonfungiblePositionManager = _nonfungiblePositionManager;
  }

  /**
    @notice The current number of stakeable LP tokens
  */
  function poolLength() external view returns (uint256) {
    return poolInfo.length;
  }

  /**
    @notice Add a new token that may be staked within this contract
    @dev Called by `IncentiveVoting` after a successful token approval vote
  */
  function addPool(
    address _token,
    address _strategy,
    address[] memory _pools,
    bool _isUniswapV3,
    bool _withUpdate
  ) external virtual returns (uint256) {
    require(msg.sender == address(incentiveVoting), "Sender not incentiveVoting");
    if (_withUpdate) {
      massUpdatePools();
    }
    nonfungiblePositionManager.setApprovalForAll(_strategy, true);
    poolInfo.push(
      PoolInfo({
        token: _token,
        isUniswapV3: _isUniswapV3,
        strategy: IStrategy(_strategy),
        rewardsPerSecond: 0,
        lastRewardTime: block.timestamp,
        accRewardPerShare: 0
      })
    );
    uint256 pid = poolInfo.length - 1;
    for(uint i; i < _pools.length; ++i) {
      uniPoolToPid[_pools[i]] = pid;
    }
    return pid;
  }

  function addUniPoolToPid(uint _pid, address _uniPool) external onlyOwner {
    uniPoolToPid[_uniPool] = _pid;
  }

  /**
    @notice Set the claim receiver address for the caller
    @dev When the claim receiver is not == address(0), all
          emission claims are transferred to this address
    @param _receiver Claim receiver address
  */
  function setClaimReceiver(address _receiver) external virtual {
    claimReceiver[msg.sender] = _receiver;
  }

  /**
    @notice Allow or block third-party calls to deposit, withdraw
            or claim rewards on behalf of the caller
  */
  function setBlockThirdPartyActions(bool _block) external virtual {
    blockThirdPartyActions[msg.sender] = _block;
  }

  // View function to see staked Want tokens on frontend.
  function stakedWantTokens(uint256 _pid, address _user) external view virtual returns (uint256) {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];

    uint256 sharesTotal = pool.strategy.sharesTotal();
    uint256 wantLockedTotal = pool.strategy.wantLockedTotal();
    if (sharesTotal == 0) {
      return 0;
    }
    return (user.shares * wantLockedTotal) / sharesTotal;
  }

  // Update reward variables for all pools. Be careful of gas spending!
  function massUpdatePools() public virtual {
    uint256 length = poolInfo.length;
    for (uint256 pid = 0; pid < length; ++pid) {
      updatePool(pid);
    }
  }

  // Update reward variables of the given pool to be up-to-date.
  function updatePool(uint256 _pid) public virtual returns (uint256 accRewardPerShare) {
    PoolInfo storage pool = poolInfo[_pid];
    uint256 lastRewardTime = pool.lastRewardTime;
    require(lastRewardTime > 0, "Invalid pool");
    if (block.timestamp <= lastRewardTime) {
      return pool.accRewardPerShare;
    }
    (accRewardPerShare, pool.rewardsPerSecond) = _getRewardData(_pid);
    pool.lastRewardTime = block.timestamp;
    if (accRewardPerShare == 0) return pool.accRewardPerShare;
    accRewardPerShare += pool.accRewardPerShare;
    pool.accRewardPerShare = accRewardPerShare;
    return accRewardPerShare;
  }

  /**
    @notice Get the current number of unclaimed rewards for a user on one or more tokens
    @param _user User to query pending rewards for
    @param _pids Array of token addresses to query
    @return uint256[] Unclaimed rewards
  */
  function claimableReward(address _user, uint256[] calldata _pids)
    external
    view
    virtual
    returns (uint256[] memory)
  {
    uint256[] memory claimable = new uint256[](_pids.length);
    for (uint256 i = 0; i < _pids.length; i++) {
      uint256 pid = _pids[i];
      PoolInfo storage pool = poolInfo[pid];
      UserInfo storage user = userInfo[pid][_user];
      (uint256 accRewardPerShare, ) = _getRewardData(pid);
      accRewardPerShare += pool.accRewardPerShare;
      claimable[i] = user.claimable + (user.shares * accRewardPerShare) / 1e12 - user.rewardDebt;
    }
    return claimable;
  }

  // Get updated reward data for the given token
  function _getRewardData(uint256 _pid)
    internal
    view
    virtual
    returns (uint256 accRewardPerShare, uint256 rewardsPerSecond)
  {
    PoolInfo storage pool = poolInfo[_pid];
    uint256 lpSupply = pool.strategy.sharesTotal();
    uint256 start = startTime;
    uint256 currentWeek = (block.timestamp - start) / WEEK;

    if (lpSupply == 0) {
      return (0, incentiveVoting.getRewardsPerSecond(_pid, currentWeek));
    }

    uint256 lastRewardTime = pool.lastRewardTime;
    uint256 rewardWeek = (lastRewardTime - start) / WEEK;
    rewardsPerSecond = pool.rewardsPerSecond;
    uint256 reward;
    uint256 duration;
    while (rewardWeek < currentWeek) {
      rewardWeek++;
      uint256 nextRewardTime = rewardWeek * WEEK + start;
      duration = nextRewardTime - lastRewardTime;
      reward += duration * rewardsPerSecond;
      rewardsPerSecond = incentiveVoting.getRewardsPerSecond(_pid, rewardWeek);
      lastRewardTime = nextRewardTime;
    }

    duration = block.timestamp - lastRewardTime;
    reward += duration * rewardsPerSecond;
    return ((reward * 1e12) / lpSupply, rewardsPerSecond);
  }

  function deposit(
    uint256 _pid,
    uint256 _wantAmt,
    bool _claimRewards,
    address _userAddress
  ) external virtual nonReentrant returns (uint256) {
    require(_wantAmt > 0, "Cannot deposit zero");
    if (msg.sender != _userAddress) {
      _claimRewards = false;
    }
    uint256 _accRewardPerShare = updatePool(_pid);
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_userAddress];

    uint256 pending;
    if (user.shares > 0) {
      pending = (user.shares * _accRewardPerShare) / 1e12 - user.rewardDebt;
      if (_claimRewards) {
        pending += user.claimable;
        user.claimable = 0;
        pending = _safeRewardTransfer(_userAddress, pending);
      } else if (pending > 0) {
        user.claimable += pending;
        pending = 0;
      }
    }

    IERC20Upgradeable(pool.token).safeTransferFrom(msg.sender, address(this), _wantAmt);
    IERC20Upgradeable(pool.token).safeIncreaseAllowance(address(pool.strategy), _wantAmt);
    uint256 sharesAdded = pool.strategy.deposit(_userAddress, _wantAmt);
    user.shares += sharesAdded;

    user.rewardDebt = (user.shares * pool.accRewardPerShare) / 1e12;
    emit Deposit(msg.sender, _userAddress, _pid, _wantAmt);
    return pending;
  }

  function depositUniV3(
    uint256 _tokenId,
    bool _claimRewards,
    address _userAddress
  ) external virtual nonReentrant returns (uint256) {
    if (msg.sender != _userAddress) {
      _claimRewards = false;
    }
    (IUniswapV3Pool uniPool, , , ) = NFTPositionInfo.getPositionInfo(
      factory,
      nonfungiblePositionManager,
      _tokenId
    );
    uint256 _pid = uniPoolToPid[address(uniPool)];
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_userAddress];
    require(pool.token == address(nonfungiblePositionManager), "wrong token address");
    uint256 _accRewardPerShare = updatePool(_pid);

    uint256 pending;
    if (user.shares > 0) {
      pending = (user.shares * _accRewardPerShare) / 1e12 - user.rewardDebt;
      if (_claimRewards) {
        pending += user.claimable;
        user.claimable = 0;
        pending = _safeRewardTransfer(_userAddress, pending);
      } else if (pending > 0) {
        user.claimable += pending;
        pending = 0;
      }
    }
    _userToTokenId[_userAddress][address(uniPool)].add(_tokenId);
    INonfungiblePositionManager(pool.token).transferFrom(msg.sender, address(this), _tokenId);
    uint256 sharesAdded = pool.strategy.deposit(_userAddress, _tokenId);
    user.shares += sharesAdded;

    user.rewardDebt = (user.shares * pool.accRewardPerShare) / 1e12;
    emit DepositV3(msg.sender, _userAddress, _pid, _tokenId);
    return pending;
  }

  function onERC721Received(
    address,
    address _from,
    uint256 _tokenId,
    bytes calldata
  ) external returns (bytes4) {
    require(
      msg.sender == address(nonfungiblePositionManager),
      "UniswapV3Staker::onERC721Received: not a univ3 nft"
    );
    (IUniswapV3Pool uniPool, , , ) = NFTPositionInfo.getPositionInfo(
      factory,
      nonfungiblePositionManager,
      _tokenId
    );
    uint256 _pid = uniPoolToPid[address(uniPool)];
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_from];
    require(pool.token == address(nonfungiblePositionManager), "wrong token address");
    uint256 _accRewardPerShare = updatePool(_pid);

    uint256 pending;
    if (user.shares > 0) {
      pending = (user.shares * _accRewardPerShare) / 1e12 - user.rewardDebt;
      if (pending > 0) {
        user.claimable += pending;
        pending = 0;
      }
    }

    INonfungiblePositionManager(pool.token).transferFrom(msg.sender, address(this), _tokenId);
    uint256 sharesAdded = pool.strategy.deposit(_from, _tokenId);
    user.shares += sharesAdded;

    user.rewardDebt = (user.shares * pool.accRewardPerShare) / 1e12;
    emit DepositV3(msg.sender, _from, _pid, _tokenId);
    return this.onERC721Received.selector;
  }

  /**
    @notice Withdraw LP tokens from the contract
    @dev Also updates the caller's current boost
    @param _pid LP token address to withdraw.
    @param _wantAmt Amount of tokens to withdraw.
    @param _claimRewards If true, also claim rewards earned on the token.
    @return uint256 Claimed reward amount
  */
  function withdraw(
    uint256 _pid,
    uint256 _wantAmt,
    bool _claimRewards
  ) public virtual nonReentrant returns (uint256) {
    address _userAddress = msg.sender;
    require(_wantAmt > 0, "Cannot withdraw zero");
    uint256 accRewardPerShare = updatePool(_pid);
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_userAddress];

    uint256 sharesTotal = pool.strategy.sharesTotal();

    require(user.shares > 0, "user.shares is 0");
    require(sharesTotal > 0, "sharesTotal is 0");

    uint256 pending = (user.shares * accRewardPerShare) / 1e12 - user.rewardDebt;
    if (_claimRewards) {
      pending += user.claimable;
      user.claimable = 0;
      pending = _safeRewardTransfer(_userAddress, pending);
    } else if (pending > 0) {
      user.claimable += pending;
      pending = 0;
    }
    // Withdraw want tokens
    uint256 amount = (user.shares * pool.strategy.wantLockedTotal()) / sharesTotal;
    if (_wantAmt > amount) {
      _wantAmt = amount;
    }
    uint256 sharesRemoved = pool.strategy.withdraw(_userAddress, _wantAmt);

    if (sharesRemoved > user.shares) {
      user.shares = 0;
    } else {
      user.shares -= sharesRemoved;
    }

    IERC20Upgradeable token = IERC20Upgradeable(pool.token);
    uint256 wantBal = token.balanceOf(address(this));
    if (wantBal < _wantAmt) {
      _wantAmt = wantBal;
    }
    user.rewardDebt = (user.shares * pool.accRewardPerShare) / 1e12;
    token.safeTransfer(_userAddress, _wantAmt);

    emit Withdraw(_userAddress, _pid, _wantAmt);
    return pending;
  }

  function withdrawAll(uint256 _pid, bool _claimRewards) public virtual returns (uint256) {
    return withdraw(_pid, type(uint256).max, _claimRewards);
  }

  function withdrawUniV3(uint256 _tokenId, bool _claimRewards) external virtual returns (uint256) {
    address _userAddress = msg.sender;
    (IUniswapV3Pool uniPool, , , ) = NFTPositionInfo.getPositionInfo(
      factory,
      nonfungiblePositionManager,
      _tokenId
    );
    uint256 _pid = uniPoolToPid[address(uniPool)];
    uint256 accRewardPerShare = updatePool(_pid);
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_userAddress];

    uint256 sharesTotal = pool.strategy.sharesTotal();

    require(user.shares > 0, "user.shares is 0");
    require(sharesTotal > 0, "sharesTotal is 0");

    uint256 pending = (user.shares * accRewardPerShare) / 1e12 - user.rewardDebt;
    if (_claimRewards) {
      pending += user.claimable;
      user.claimable = 0;
      pending = _safeRewardTransfer(_userAddress, pending);
    } else if (pending > 0) {
      user.claimable += pending;
      pending = 0;
    }
    uint256 sharesRemoved = pool.strategy.withdraw(_userAddress, _tokenId);
    require(
      _userToTokenId[_userAddress][address(uniPool)].contains(_tokenId),
      "User has not token with that Pool id"
    );
    _userToTokenId[_userAddress][address(uniPool)].add(_tokenId);

    if (sharesRemoved > user.shares) {
      user.shares = 0;
    } else {
      user.shares -= sharesRemoved;
    }

    user.rewardDebt = (user.shares * pool.accRewardPerShare) / 1e12;
    INonfungiblePositionManager(pool.token).safeTransferFrom(address(this), _userAddress, _tokenId);

    emit WithdrawV3(_userAddress, _pid, _tokenId);
    return pending;
  }

  /**
    @notice Claim pending rewards for one or more tokens for a user.
    @param _user Address to claim rewards for. Reverts if the caller is not the
                  claimer and the claimer has blocked third-party actions.
    @param _pids Array of LP token addresses to claim for.
    @return uint256 Claimed reward amount
  */
  function claim(address _user, uint256[] calldata _pids) external virtual returns (uint256) {
    if (msg.sender != _user) {
      require(!blockThirdPartyActions[_user], "Cannot claim on behalf of this account");
    }

    // calculate claimable amount
    uint256 pending;
    for (uint256 i = 0; i < _pids.length; i++) {
      uint256 pid = _pids[i];
      uint256 accRewardPerShare = updatePool(pid);
      UserInfo storage user = userInfo[pid][_user];
      uint256 rewardDebt = (user.shares * accRewardPerShare) / 1e12;
      pending += user.claimable + rewardDebt - user.rewardDebt;
      user.claimable = 0;
      user.rewardDebt = (user.shares * poolInfo[pid].accRewardPerShare) / 1e12;
    }
    return _safeRewardTransfer(_user, pending);
  }

  // Safe reward token transfer function, just in case if rounding error causes pool to not have enough
  function _safeRewardTransfer(address _user, uint256 _rewardAmt)
    internal
    virtual
    returns (uint256)
  {
    uint256 rewardBal = rewardToken.balanceOf(address(incentiveVoting));
    if (_rewardAmt > rewardBal) {
      _rewardAmt = rewardBal;
    }
    if (_rewardAmt > 0) {
      address receiver = claimReceiver[_user];
      if (receiver == address(0)) {
        receiver = _user;
      }
      rewardToken.transferFrom(address(incentiveVoting), receiver, _rewardAmt);
      emit ClaimedReward(msg.sender, _user, receiver, _rewardAmt);
    }
    return _rewardAmt;
  }

  function inCaseTokensGetStuck(address _token, uint256 _amount) public virtual onlyOwner {
    require(_token != address(rewardToken), "!safe");
    IERC20Upgradeable(_token).safeTransfer(msg.sender, _amount);
  }

  // Withdraw without caring about rewards. EMERGENCY ONLY.
  function emergencyWithdraw(uint256 _pid) public virtual nonReentrant {
    address _userAddress = msg.sender;
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_userAddress];

    uint256 wantLockedTotal = pool.strategy.wantLockedTotal();
    uint256 sharesTotal = pool.strategy.sharesTotal();
    uint256 amount = (user.shares * wantLockedTotal) / sharesTotal;

    pool.strategy.withdraw(_userAddress, amount);

    IERC20Upgradeable(pool.token).safeTransfer(_userAddress, amount);
    emit EmergencyWithdraw(_userAddress, _pid, amount);
    delete userInfo[_pid][_userAddress];
  }
}
