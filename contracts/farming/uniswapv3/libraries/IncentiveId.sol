// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { IUniswapV3Staker } from "../interfaces/IUniswapV3Staker.sol";

library IncentiveId {
  /// @notice Calculate the key for a staking incentive
  /// @param key The components used to compute the incentive identifier
  /// @return incentiveId The identifier for the incentive
  function compute(IUniswapV3Staker.IncentiveKey memory key)
    internal
    pure
    returns (bytes32 incentiveId)
  {
    return keccak256(abi.encode(key));
  }
}
