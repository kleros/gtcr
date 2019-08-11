pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

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

/**
 * @dev A utility contract batch view requests.
 */
contract ArbitrableTCRView {

    struct QueryResult {
        address governor;
        address arbitrator;
        bytes arbitratorExtraData;
        uint requesterBaseDeposit;
        uint challengerBaseDeposit;
        uint challengePeriodDuration;
        uint metaEvidenceUpdates;
        uint winnerStakeMultiplier;
        uint loserStakeMultiplier;
        uint sharedStakeMultiplier;
        uint MULTIPLIER_DIVISOR;
    }

    function fetchData(address _address) external view returns (QueryResult memory result) {
        IArbitrableTCR tcr = IArbitrableTCR(_address);
        result.governor = tcr.governor();
        result.arbitrator = tcr.arbitrator();
        result.arbitratorExtraData = tcr.arbitratorExtraData();
        result.requesterBaseDeposit = tcr.requesterBaseDeposit();
        result.challengerBaseDeposit = tcr.challengerBaseDeposit();
        result.challengePeriodDuration = tcr.challengePeriodDuration();
        result.metaEvidenceUpdates = tcr.metaEvidenceUpdates();
        result.winnerStakeMultiplier = tcr.winnerStakeMultiplier();
        result.loserStakeMultiplier = tcr.loserStakeMultiplier();
        result.sharedStakeMultiplier = tcr.sharedStakeMultiplier();
        result.MULTIPLIER_DIVISOR = tcr.MULTIPLIER_DIVISOR();
    }
}