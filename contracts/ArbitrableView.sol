pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "./interfaces/IArbitrableTCR.sol";

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