/**
 *  @authors: [@mtsalenc]
 *  @reviewers: []
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity ^0.5.11;

interface IArbitrableTCR {
    function governor() external view returns (address);
    function arbitrator() external view returns (address);
    function arbitratorExtraData() external view returns (bytes memory);
    function requesterBaseDeposit() external view returns (uint);
    function challengerBaseDeposit() external view returns (uint);
    function challengePeriodDuration() external view returns (uint);
    function metaEvidenceUpdates() external view returns (uint);
    function winnerStakeMultiplier() external view returns (uint);
    function loserStakeMultiplier() external view returns (uint);
    function sharedStakeMultiplier() external view returns (uint);
    function MULTIPLIER_DIVISOR() external view returns (uint);
}