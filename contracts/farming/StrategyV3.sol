// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import { IStrategy } from "./interfaces/IStrategy.sol";
import { TickMath } from "./uniswapv3/libraries/TickMath.sol";
import { IUniswapV3Pool } from "./uniswapv3/interfaces/IUniswapV3Pool.sol";
import { NFTPositionInfo } from "./uniswapv3/libraries/NFTPositionInfo.sol";
import { LiquidityAmounts } from "./uniswapv3/libraries/LiquidityAmounts.sol";
import { IUniswapV3Factory } from "./uniswapv3/interfaces/IUniswapV3Factory.sol";
import { INonfungiblePositionManager } from "./uniswapv3/interfaces/INonfungiblePositionManager.sol";

// solhint-disable max-states-count
contract StrategyV3 is
  IStrategy,
  OwnableUpgradeable,
  ReentrancyGuardUpgradeable,
  PausableUpgradeable
{
  using TickMath for int24;

  INonfungiblePositionManager public want;
  address public farming;
  IUniswapV3Factory public factory;
  uint256 public sharesTotal;

  mapping(uint256 => uint256) private _sharesById;

  modifier onlyHelioFarming() {
    require(msg.sender == farming, "!helio Farming");
    _;
  }

  function initialize(
    address _factory,
    address _want,
    address _farming
  ) public initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    __Pausable_init();
    factory = IUniswapV3Factory(_factory);
    want = INonfungiblePositionManager(_want);
    farming = _farming;
  }

  // Receives new deposits from user
  function deposit(address, uint256 _tokenId)
    public
    virtual
    onlyHelioFarming
    whenNotPaused
    returns (uint256)
  {
    want.transferFrom(address(msg.sender), address(this), _tokenId);
    (IUniswapV3Pool pool, int24 tickLower, int24 tickUpper, uint128 liquidity) = NFTPositionInfo
      .getPositionInfo(factory, want, _tokenId);
    (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
    uint160 sqrtRatioA = tickLower.getSqrtRatioAtTick();
    uint160 sqrtRatioB = tickUpper.getSqrtRatioAtTick();

    (uint amount0, uint amount1) = LiquidityAmounts.getAmountsForLiquidity(sqrtPriceX96, sqrtRatioA, sqrtRatioB, liquidity);
    uint sharesAdded = amount0 + amount1;

    sharesTotal += sharesAdded;
    _sharesById[_tokenId] = sharesAdded;

    return sharesAdded;
  }

  function withdraw(address, uint256 _tokenId)
    public
    virtual
    onlyHelioFarming
    nonReentrant
    returns (uint256)
  {
    uint256 sharesRemoved = _sharesById[_tokenId];
    sharesTotal -= sharesRemoved;
    delete _sharesById[_tokenId];

    want.transferFrom(address(this), msg.sender, _tokenId);

    return sharesRemoved;
  }

  function inCaseTokensGetStuck(
    address _token,
    uint256 _amount,
    address _to
  ) public virtual onlyOwner {
    IERC20Upgradeable(_token).transfer(_to, _amount);
  }

  function pause() public virtual onlyOwner {
    _pause();
  }

  function unpause() public virtual onlyOwner {
    _unpause();
  }

  function wantLockedTotal() external view virtual override returns (uint256) {
    return sharesTotal;
  }
}
