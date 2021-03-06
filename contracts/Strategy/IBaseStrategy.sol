//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBaseStrategy {

// to deposit funds to a destination contract
function deposit(uint256 amount) external returns(uint256);

function depositAll() external returns(uint256);

// to withdraw funds from the destination contract
function withdraw() external returns(uint256);

function withdraw(uint256 amount) external returns(uint256);

// actions to do before depositing the funds
function beforeDeposit() external returns (bool);

// claim or collect rewards functions
function harvest() external;

// to be triggered by the owner in the emergency case to send all available funds back to the MasterVault
function retireStrat() external;

// withdraw all funds from the destination contract
function panic() external returns (uint256);

// disable deposit
function pause() external;

// enable deposit
function unpause() external;

// calculate the total underlying token in the strategy contract and destination contract
function balanceOf() external view returns(uint256);

// calculate the total amount of tokens in the strategy contract
function balanceOfWant() external view returns(uint256);

// calculate the total amount of tokens in the destination contract
function balanceOfPool() external view returns(uint256);

// set amount of fee to be collected from the total amount of tokens received from the harvest
function setHarvestFeeBP(uint256 newHarvestFee) external;

// set the recipient address of the collected fee
function setFeeRecipient(address newFeeRecipient) external;
}