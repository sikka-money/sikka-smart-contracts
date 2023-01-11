// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import { IFarming } from "./interfaces/IFarming.sol";
import { IUniswapV3Factory } from "./uniswapv3/interfaces/IUniswapV3Factory.sol";
import { INonfungiblePositionManager } from "./uniswapv3/interfaces/INonfungiblePositionManager.sol";

contract UniV3ProxyForDeposit is Initializable, OwnableUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  event PoolAdded(address indexed pool, bool indexed added);

  IFarming public farming;
  INonfungiblePositionManager public router;
  IUniswapV3Factory public factory;

  mapping(address => bool) public supportedV3Pool;

  function initialize(
    IFarming _farming,
    INonfungiblePositionManager _router,
    IUniswapV3Factory _factory
  ) public initializer {
    __Ownable_init();
    farming = _farming;
    router = _router;
    factory = _factory;
  }

  function mintAndDeposit(
    address _tokenA,
    address _tokenB,
    uint24 _fee,
    int24 _tickLower,
    int24 _tickUpper,
    uint256 _amountA,
    uint256 _amountB,
    uint256 _amountAMin,
    uint256 _amountBMin
  ) external {
    IERC20Upgradeable(_tokenA).safeTransferFrom(msg.sender, address(this), _amountA);
    IERC20Upgradeable(_tokenB).safeTransferFrom(msg.sender, address(this), _amountB);

    // Approve the position manager
    IERC20Upgradeable(_tokenA).approve(address(router), _amountA);
    IERC20Upgradeable(_tokenB).approve(address(router), _amountB);

    require(supportedV3Pool[factory.getPool(_tokenA, _tokenB, _fee)], "unsupported pool");

    INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
      token0: _tokenA,
      token1: _tokenB,
      fee: _fee,
      tickLower: _tickLower,
      tickUpper: _tickUpper,
      amount0Desired: _amountA,
      amount1Desired: _amountB,
      amount0Min: _amountAMin,
      amount1Min: _amountBMin,
      recipient: address(this),
      deadline: block.timestamp
    });
    uint256 amountADeposited;
    uint256 amountBDeposited;
    {
      uint256 tokenId;
      (tokenId, , amountADeposited, amountBDeposited) = router.mint(params);

      router.approve(address(farming), tokenId);
      farming.depositUniV3(tokenId, false, msg.sender);
    }

    if (amountADeposited < _amountA) {
      uint256 refundA = _amountA - amountADeposited;
      IERC20Upgradeable(_tokenA).safeTransfer(msg.sender, refundA);
    }

    if (amountBDeposited < _amountB) {
      uint256 refundB = _amountB - amountBDeposited;
      IERC20Upgradeable(_tokenB).safeTransfer(msg.sender, refundB);
    }
  }

  function addSupportedPool(
    address _tokenA,
    address _tokenB,
    uint24 _fee
  ) external onlyOwner {
    address pool = factory.getPool(_tokenA, _tokenB, _fee);
    supportedV3Pool[pool] = true;
    emit PoolAdded(pool, true);
  }

  function removeSupportedPool(
    address _tokenA,
    address _tokenB,
    uint24 _fee
  ) external onlyOwner {
    address pool = factory.getPool(_tokenA, _tokenB, _fee);
    supportedV3Pool[pool] = false;
    emit PoolAdded(pool, false);
  }

  function onERC721Received(
    address operator,
    address,
    uint256 tokenId,
    bytes calldata
  ) external returns (bytes4) {
    return this.onERC721Received.selector;
  }
}
