/**
 *  @authors: [@mtsalenc]
 *  @reviewers: []
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import { IArbitrable, Arbitrator } from "@kleros/erc-792/contracts/Arbitrator.sol";
import { IEvidence } from "@kleros/erc-792/contracts/erc-1497/IEvidence.sol";

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "solidity-rlp/contracts/RLPReader.sol";
import "./libraries/CappedMath.sol";

contract GTCRMock is IArbitrable, IEvidence{
    using CappedMath for uint; // Operations bounded between 0 and 2**256 - 1.
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;
    using BytesLib for bytes;

    /* Enums */

    enum ItemStatus {
        Absent,
        Registered,
        RegistrationRequested,
        ClearingRequested
    }

    enum Party {
        None,      // Party per default when there is no challenger or requester. Also used for unconclusive ruling.
        Requester, // Party that made the request to change an address status.
        Challenger // Party that challenges the request to change an address status.
    }

    /* Structs */

    struct Item {
        bytes data;
        ItemStatus status; // The status of the item.
        Request[] requests; // List of status change requests made for the item.
    }

    struct Request {
        bool disputed; // True if a dispute was raised.
        uint disputeID; // ID of the dispute, if any.
        uint submissionTime; // Time when the request was made. Used to track when the challenge period ends.
        bool resolved; // True if the request was executed and/or any disputes raised were resolved.
        address payable[3] parties; // Address of requester and challenger, if any.
        Round[] rounds; // Tracks each round of a dispute.
        Party ruling; // The final ruling given, if any.
        Arbitrator arbitrator; // The arbitrator trusted to solve disputes for this request.
        bytes arbitratorExtraData; // The extra data for the trusted arbitrator of this request.
    }

    struct Round {
        uint[3] paidFees; // Tracks the fees paid by each side on this round.
        bool[3] hasPaid; // True when the side has fully paid its fee. False otherwise.
        uint feeRewards; // Sum of reimbursable fees and stake rewards available to the parties that made contributions to the side that ultimately wins a dispute.
        mapping(address => uint[3]) contributions; // Maps contributors to their contributions for each side.
    }

    struct QueryResult {
        bytes32 ID;
        bytes data;
        ItemStatus status;
        bool disputed;
        bool resolved;
        uint disputeID;
        uint appealStart;
        uint appealEnd;
        address requester;
        address challenger;
        address arbitrator;
        bytes arbitratorExtraData;
        uint currentRuling;
        bool[3] hasPaid;
        uint feeRewards;
        uint submissionTime;
        uint[3] paidFees;
        Arbitrator.DisputeStatus disputeStatus;
    }

    /* Storage */

    // Constants

    uint RULING_OPTIONS = 2; // The amount of non 0 choices the arbitrator can give.

    // Settings
    address public governor; // The address that can make governance changes to the parameters of the TCR.
    address public relatedTCR; // The address of the TCR of TCRs related to this one.
    Arbitrator public arbitrator; // The arbitrator that will be used to resolve disputes on the next requests.
    bytes public arbitratorExtraData; // The arbitrator extra data used for the next requests.
    uint public requesterBaseDeposit; // The base deposit to make a request.
    uint public challengerBaseDeposit; // The base deposit to challenge a request.
    uint public challengePeriodDuration; // The time before a request becomes executable if not challenged.
    uint public metaEvidenceUpdates; // The number of times the meta evidence has been updated. Used to track the latest meta evidence ID.

    // The required fee stake that a party must pay depends on who won the previous round and is proportional to the arbitration cost such that the fee stake for a round is stake multiplier * arbitration cost for that round.
    // Multipliers are in basis points.
    uint public winnerStakeMultiplier; // Multiplier for calculating the fee stake paid by the party that won the previous round.
    uint public loserStakeMultiplier; // Multiplier for calculating the fee stake paid by the party that lost the previous round.
    uint public sharedStakeMultiplier; // Multiplier for calculating the fee stake that must be paid in the case where there isn't a winner and loser (e.g. when it's the first round or the arbitrator ruled "refused to rule"/"could not rule").
    uint public constant MULTIPLIER_DIVISOR = 10000; // Divisor parameter for multipliers.

    // Registry data.
    bytes32[] public itemIDs; // List of IDs of submitted items.
    mapping(bytes32 => Item) public items; // Maps the item ID to the item.
    mapping(address => mapping(uint => bytes32)) public arbitratorDisputeIDToItemID; // Maps a dispute ID to the ID of the item with the disputed request. On the form arbitratorDisputeIDToItemID[arbitrator][disputeID].

    /* Modifiers */

    modifier onlyGovernor {require(msg.sender == governor, "The caller must be the governor."); _;}

    constructor(
        Arbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        string memory _registrationMetaEvidence,
        string memory _clearingMetaEvidence,
        address _governor,
        uint _requesterBaseDeposit,
        uint _challengerBaseDeposit,
        uint _challengePeriodDuration,
        uint _sharedStakeMultiplier,
        uint _winnerStakeMultiplier,
        uint _loserStakeMultiplier
    ) public {
        emit MetaEvidence(0, _registrationMetaEvidence);
        emit MetaEvidence(1, _clearingMetaEvidence);

        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        governor = _governor;
        requesterBaseDeposit = _requesterBaseDeposit;
        challengerBaseDeposit = _challengerBaseDeposit;
        challengePeriodDuration = _challengePeriodDuration;
        sharedStakeMultiplier = _sharedStakeMultiplier;
        winnerStakeMultiplier = _winnerStakeMultiplier;
        loserStakeMultiplier = _loserStakeMultiplier;
    }

    function addItem(bytes calldata _item) external payable {
        bytes32 itemID = keccak256(_item);
        require(items[itemID].status == ItemStatus.Absent, "Item must be absent to be added.");
        requestStatusChange(_item);
    }

    function removeItem(bytes calldata _item) external payable {
        bytes32 itemID = keccak256(_item);
        require(items[itemID].status == ItemStatus.Registered, "Item must be registered to be removed.");
        requestStatusChange(_item);
    }

    /** @dev Executes a request if the challenge period passed and no one challenged the request.
     *  @param _item The item with the request to execute.
     */
    function executeRequest(bytes32 _item) external {
        Item storage addr = items[_item];
        Request storage request = addr.requests[addr.requests.length - 1];
        require(
            now - request.submissionTime > challengePeriodDuration,
            "Time to challenge the request must have passed."
        );
        require(!request.disputed, "The request should not be disputed.");

        if (addr.status == ItemStatus.RegistrationRequested)
            addr.status = ItemStatus.Registered;
        else if (addr.status == ItemStatus.ClearingRequested)
            addr.status = ItemStatus.Absent;
        else
            revert("There must be a request.");

        request.resolved = true;
        withdrawFeesAndRewards(request.parties[uint(Party.Requester)], _item, addr.requests.length - 1, 0); // Automatically withdraw for the requester.
    }

    /** @dev Challenges the latest request of a item. Accepts enough ETH to fund a potential dispute considering the current required amount. Reimburses unused ETH. TRUSTED.
     *  @param _itemID The ID of the item with the request to challenge.
     *  @param _evidence A link to an evidence using its URI. Ignored if not provided or if not enough funds were provided to create a dispute.
     */
    function challengeRequest(bytes32 _itemID, string calldata _evidence) external payable {
        Item storage item = items[_itemID];
        require(
            item.status == ItemStatus.RegistrationRequested || item.status == ItemStatus.ClearingRequested,
            "The item must have a pending request."
        );
        Request storage request = item.requests[item.requests.length - 1];
        require(now - request.submissionTime <= challengePeriodDuration, "Challenges must occur during the challenge period.");
        require(!request.disputed, "The request should not have already been disputed.");

        // Take the deposit and save the challenger's address.
        request.parties[uint(Party.Challenger)] = msg.sender;

        Round storage round = request.rounds[request.rounds.length - 1];
        uint arbitrationCost = request.arbitrator.arbitrationCost(request.arbitratorExtraData);
        uint totalCost = arbitrationCost.addCap((arbitrationCost.mulCap(sharedStakeMultiplier)) / MULTIPLIER_DIVISOR).addCap(challengerBaseDeposit);
        contribute(round, Party.Challenger, msg.sender, msg.value, totalCost);
        require(round.paidFees[uint(Party.Challenger)] >= totalCost, "You must fully fund your side.");
        round.hasPaid[uint(Party.Challenger)] = true;

        // Raise a dispute.
        request.disputeID = request.arbitrator.createDispute.value(arbitrationCost)(RULING_OPTIONS, request.arbitratorExtraData);
        arbitratorDisputeIDToItemID[address(request.arbitrator)][request.disputeID] = _itemID;
        request.disputed = true;
        request.rounds.length++;
        round.feeRewards = round.feeRewards.subCap(arbitrationCost);

        if (bytes(_evidence).length > 0)
            emit Evidence(request.arbitrator, uint(keccak256(abi.encodePacked(_itemID,item.requests.length - 1))), msg.sender, _evidence);
    }


    /** @dev Give a ruling for a dispute. Can only be called by the arbitrator. TRUSTED.
     *  Overrides parent function to account for the situation where the winner loses a case due to paying less appeal fees than expected.
     *  @param _disputeID ID of the dispute in the arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
     */
    function rule(uint _disputeID, uint _ruling) public {
        Party winner = Party(_ruling);
        bytes32 itemID = arbitratorDisputeIDToItemID[msg.sender][_disputeID];
        Item storage item = items[itemID];
        Request storage request = item.requests[item.requests.length - 1];
        Round storage round = request.rounds[request.rounds.length - 1];
        require(_ruling <= RULING_OPTIONS); // solium-disable-line error-reason
        require(address(request.arbitrator) == msg.sender); // solium-disable-line error-reason
        require(!request.resolved); // solium-disable-line error-reason

        // The ruling is inverted if the loser paid its fees.
        if (round.hasPaid[uint(Party.Requester)] == true) // If one side paid its fees, the ruling is in its favor. Note that if the other side had also paid, an appeal would have been created.
            winner = Party.Requester;
        else if (round.hasPaid[uint(Party.Challenger)] == true)
            winner = Party.Challenger;

        emit Ruling(Arbitrator(msg.sender), _disputeID, uint(winner));

        // Update the item's state
        if (winner == Party.Requester) { // Execute Request
            if (item.status == ItemStatus.RegistrationRequested)
                item.status = ItemStatus.Registered;
            else
                item.status = ItemStatus.Absent;
        } else { // Revert to previous state.
            if (item.status == ItemStatus.RegistrationRequested)
                item.status = ItemStatus.Absent;
            else if (item.status == ItemStatus.ClearingRequested)
                item.status = ItemStatus.Registered;
        }

        request.resolved = true;
        request.ruling = Party(winner);
        // Automatically withdraw.
        if (winner == Party.None) {
            withdrawFeesAndRewards(request.parties[uint(Party.Requester)], itemID, item.requests.length-1, 0);
            withdrawFeesAndRewards(request.parties[uint(Party.Challenger)], itemID, item.requests.length-1, 0);
        } else {
            withdrawFeesAndRewards(request.parties[uint(winner)], itemID, item.requests.length-1, 0);
        }
    }

    /** @dev Reimburses contributions if no disputes were raised. If a dispute was raised, sends the fee stake rewards and reimbursements proportional to the contributions made to the winner of a dispute.
     *  @param _beneficiary The address that made contributions to a request.
     *  @param _itemID The ID of the item with the request from which to withdraw.
     *  @param _request The request from which to withdraw.
     *  @param _round The round from which to withdraw.
     */
    function withdrawFeesAndRewards(address payable _beneficiary, bytes32 _itemID, uint _request, uint _round) public {
        Item storage item = items[_itemID];
        Request storage request = item.requests[_request];
        Round storage round = request.rounds[_round];
        // The request must be executed and there can be no disputes pending resolution.
        require(request.resolved); // solium-disable-line error-reason

        uint reward;
        if (!request.disputed || request.ruling == Party.None) {
            // No disputes were raised, or there isn't a winner and loser. Reimburse unspent fees proportionally.
            uint rewardRequester = round.paidFees[uint(Party.Requester)] > 0
                ? (round.contributions[_beneficiary][uint(Party.Requester)] * round.feeRewards) / (round.paidFees[uint(Party.Challenger)] + round.paidFees[uint(Party.Requester)])
                : 0;
            uint rewardChallenger = round.paidFees[uint(Party.Challenger)] > 0
                ? (round.contributions[_beneficiary][uint(Party.Challenger)] * round.feeRewards) / (round.paidFees[uint(Party.Challenger)] + round.paidFees[uint(Party.Requester)])
                : 0;

            reward = rewardRequester + rewardChallenger;
            round.contributions[_beneficiary][uint(Party.Requester)] = 0;
            round.contributions[_beneficiary][uint(Party.Challenger)] = 0;
        } else {
            // Reward the winner.
            reward = round.paidFees[uint(request.ruling)] > 0
                ? (round.contributions[_beneficiary][uint(request.ruling)] * round.feeRewards) / round.paidFees[uint(request.ruling)]
                : 0;

            round.contributions[_beneficiary][uint(request.ruling)] = 0;
        }

        _beneficiary.send(reward); // It is the user responsibility to accept ETH.
    }

    /** @dev Change the duration of the challenge period.
     *  @param _challengePeriodDuration The new duration of the challenge period.
     */
    function changeTimeToChallenge(uint _challengePeriodDuration) external onlyGovernor {
        challengePeriodDuration = _challengePeriodDuration;
    }

    /* Internal */

    function requestStatusChange(bytes memory _item) internal {
        bytes32 itemID = keccak256(_item);

        Item storage item = items[itemID];
        if (item.requests.length == 0) { // Initial item registration.
            itemIDs.push(itemID);
            item.data = _item;
        }

        // Update item status.
        if (item.status == ItemStatus.Absent)
            item.status = ItemStatus.RegistrationRequested;
        else if (item.status == ItemStatus.Registered)
            item.status = ItemStatus.ClearingRequested;
        else
            revert("Item already has a pending request.");

        // Setup request.
        Request storage request = item.requests[item.requests.length++];
        request.parties[uint(Party.Requester)] = msg.sender;
        request.submissionTime = now;
        request.arbitrator = arbitrator;
        request.arbitratorExtraData = arbitratorExtraData;
        Round storage round = request.rounds[request.rounds.length++];


        // Amount required to fully fund each side: requesterBaseDeposit + arbitration cost + (arbitration cost * multiplier).
        uint arbitrationCost = request.arbitrator.arbitrationCost(request.arbitratorExtraData);
        uint totalCost = arbitrationCost.addCap((arbitrationCost.mulCap(sharedStakeMultiplier)) / MULTIPLIER_DIVISOR).addCap(requesterBaseDeposit);
        contribute(round, Party.Requester, msg.sender, msg.value, totalCost);
        require(round.paidFees[uint(Party.Requester)] >= totalCost, "You must fully fund your side.");
        round.hasPaid[uint(Party.Requester)] = true;
    }

    /** @dev Returns the contribution value and remainder from available ETH and required amount.
     *  @param _available The amount of ETH available for the contribution.
     *  @param _requiredAmount The amount of ETH required for the contribution.
     *  @return taken The amount of ETH taken.
     *  @return remainder The amount of ETH left from the contribution.
     */
    function calculateContribution(uint _available, uint _requiredAmount)
        internal
        pure
        returns(uint taken, uint remainder)
    {
        if (_requiredAmount > _available)
            return (_available, 0); // Take whatever is available, return 0 as leftover ETH.

        remainder = _available - _requiredAmount;
        return (_requiredAmount, remainder);
    }

    /** @dev Make a fee contribution.
     *  @param _round The round to contribute.
     *  @param _side The side for which to contribute.
     *  @param _contributor The contributor.
     *  @param _amount The amount contributed.
     *  @param _totalRequired The total amount required for this side.
     */
    function contribute(Round storage _round, Party _side, address payable _contributor, uint _amount, uint _totalRequired) internal {
        // Take up to the amount necessary to fund the current round at the current costs.
        uint contribution; // Amount contributed.
        uint remainingETH; // Remaining ETH to send back.
        (contribution, remainingETH) = calculateContribution(_amount, _totalRequired.subCap(_round.paidFees[uint(_side)]));
        _round.contributions[_contributor][uint(_side)] += contribution;
        _round.paidFees[uint(_side)] += contribution;
        _round.feeRewards += contribution;

        // Reimburse leftover ETH.
        _contributor.send(remainingETH); // Deliberate use of send in order to not block the contract in case of reverting fallback.
    }

    /* Views */

    /** @dev Return true if the item is on the list.
     *  @param _itemID The ID of the item to be queried.
     *  @return allowed True if the item is allowed, false otherwise.
     */
    function isPermitted(bytes32 _itemID) external view returns (bool allowed) {
        Item storage item = items[_itemID];
        return item.status == ItemStatus.Registered || item.status == ItemStatus.ClearingRequested;
    }

    function itemCount() external view returns (uint) {
        return itemIDs.length;
    }

    function getItem(bytes32 _itemID) external view returns (QueryResult memory result) {
        Item storage item = items[_itemID];
        Request storage request = item.requests[item.requests.length - 1];
        Round storage round = request.rounds[request.rounds.length - 1];

        result = QueryResult({
            ID: _itemID,
            data: item.data,
            status: item.status,
            disputed: request.disputed,
            resolved: request.resolved,
            disputeID: request.disputeID,
            requester: request.parties[uint(Party.Requester)],
            challenger: request.parties[uint(Party.Challenger)],
            appealStart: 0,
            appealEnd: 0,
            arbitrator: address(request.arbitrator),
            arbitratorExtraData: request.arbitratorExtraData,
            submissionTime: request.submissionTime,
            hasPaid: [false,false,false],
            paidFees: [uint(0), uint(0), uint(0)],
            currentRuling: 0,
            feeRewards: 0,
            disputeStatus: Arbitrator.DisputeStatus.Waiting
        });
        if (request.disputed && request.arbitrator.disputeStatus(request.disputeID) == Arbitrator.DisputeStatus.Appealable) {
            result.currentRuling = request.arbitrator.currentRuling(request.disputeID);
            result.disputeStatus = request.arbitrator.disputeStatus(request.disputeID);
            (result.appealStart, result.appealEnd) = request.arbitrator.appealPeriod(request.disputeID);

            result.feeRewards = round.feeRewards;
            result.hasPaid = round.hasPaid;
            result.paidFees = round.paidFees;
        }
    }

    /** @dev Find an item by matching column values.
     *  - Example:
     *  Item [18, 'PNK', 'Pinakion', '0xca35b7d915458ef540ade6068dfe2f44e8fa733c']
     *  RLP encoded: 0xe383504e4b128850696e616b696f6e94ca35b7d915458ef540ade6068dfe2f44e8fa733c
     *  Input for remix: ["0xe3","0x83","0x50","0x4e","0x4b","0x12","0x88","0x50","0x69","0x6e","0x61","0x6b","0x69","0x6f","0x6e","0x94","0xca","0x35","0xb7","0xd9","0x15","0x45","0x8e","0xf5","0x40","0xad","0xe6","0x06","0x8d","0xfe","0x2f","0x44","0xe8","0xfa","0x73","0x3c"]
     *  @param _rlpEncodedMatch The RLP encoded item to match against the items on the list.
     *  @param _cursor The index from where to start looking for matches.
     *  @param _returnCount The size of the array to return with matching values.
     *  @param _count The number of items to iterate while searching.
     *  @return An array with items that match the query.
     */
    function findItem(bytes memory _rlpEncodedMatch, uint _cursor, uint _returnCount, uint _count) public view returns (bytes[] memory) {
        RLPReader.RLPItem[] memory matchItem = _rlpEncodedMatch.toRlpItem().toList();
        bytes[] memory results = new bytes[](_count);
        uint itemsFound;

        for(uint i = _cursor; i < (_count == 0 ? itemIDs.length : _count); i++) { // Iterate over every item in storage.
            bytes storage itemBytes = items[itemIDs[i]].data;
            RLPReader.RLPItem[] memory item = itemBytes.toRlpItem().toList();
            for (uint j = 0; j < matchItem.length; j++) { // Iterate over every column.
                if (item[j].toBytes().equal(matchItem[j].toBytes())) {
                    results[itemsFound] = itemBytes;
                    itemsFound++;
                    break;
                }
            }
        }
        return results;
    }

    /** @dev Return the values of the items the query finds. This function is O(n), where n is the number of items. This could exceed the gas limit, therefore this function should only be used for interface display and not by other contracts.
     *  @param _cursor The ID of the items from which to start iterating. To start from either the oldest or newest item.
     *  @param _count The number of items to return.
     *  @param _filter The filter to use. Each element of the array in sequence means:
     *  - Include absent items in result.
     *  - Include registered items in result.
     *  - Include items with registration requests that are not disputed in result.
     *  - Include items with clearing requests that are not disputed in result.
     *  - Include disputed items with registration requests in result.
     *  - Include disputed items with clearing requests in result.
     *  - Include items submitted by _party.
     *  - Include items challenged by _party.
     *  @param _oldestFirst Whether to sort from oldest to the newest item.
     *  @param _party The address to use if checking for items submitted or challenged by a specific party.
     *  @return The values of the tokens found and whether there are more tokens for the current filter and sort.
     */
    function queryItems(bytes32 _cursor, uint _count, bool[8] calldata _filter, bool _oldestFirst, address _party)
        external
        view
        returns (QueryResult[] memory results, bool hasMore)
    {
        uint cursorIndex;
        results = new QueryResult[](_count);

        uint index = 0;

        if (_cursor == 0)
            cursorIndex = 0;
        else {
            for (uint j = 0; j < itemIDs.length; j++) {
                if (itemIDs[j] == _cursor) {
                    cursorIndex = j;
                    break;
                }
            }
            require(cursorIndex != 0, "The cursor is invalid.");
        }

        for (
                uint i = cursorIndex == 0 ? (_oldestFirst ? 0 : 1) : (_oldestFirst ? cursorIndex + 1 : itemIDs.length - cursorIndex + 1);
                _oldestFirst ? i < itemIDs.length : i <= itemIDs.length;
                i++
            ) { // Oldest or newest first.
            bytes32 itemID = itemIDs[_oldestFirst ? i : itemIDs.length - i];
            Item storage item = items[itemID];
            Request storage request = item.requests[item.requests.length - 1];
            if (
                /* solium-disable operator-whitespace */
                (_filter[0] && item.status == ItemStatus.Absent) ||
                (_filter[1] && item.status == ItemStatus.Registered) ||
                (_filter[2] && item.status == ItemStatus.RegistrationRequested && !request.disputed) ||
                (_filter[3] && item.status == ItemStatus.ClearingRequested && !request.disputed) ||
                (_filter[4] && item.status == ItemStatus.RegistrationRequested && request.disputed) ||
                (_filter[5] && item.status == ItemStatus.ClearingRequested && request.disputed) ||
                (_filter[6] && request.parties[uint(Party.Requester)] == _party) ||
                (_filter[7] && request.parties[uint(Party.Challenger)] == _party)
                /* solium-enable operator-whitespace */
            ) {
                if (index < _count) {
                    QueryResult memory result = QueryResult({
                        ID: itemIDs[_oldestFirst ? i : itemIDs.length - i],
                        data: item.data,
                        status: item.status,
                        disputed: request.disputed,
                        resolved: request.resolved,
                        disputeID: request.disputeID,
                        requester: request.parties[uint(Party.Requester)],
                        challenger: request.parties[uint(Party.Challenger)],
                        appealStart: 0,
                        appealEnd: 0,
                        arbitrator: address(request.arbitrator),
                        arbitratorExtraData: request.arbitratorExtraData,
                        submissionTime: request.submissionTime,
                        hasPaid: [false,false,false],
                        paidFees: [uint(0), uint(0), uint(0)],
                        currentRuling: 0,
                        feeRewards: 0,
                        disputeStatus: Arbitrator.DisputeStatus.Waiting
                    });
                    if (request.disputed && request.arbitrator.disputeStatus(request.disputeID) == Arbitrator.DisputeStatus.Appealable) {
                        result.currentRuling = request.arbitrator.currentRuling(request.disputeID);
                        result.disputeStatus = request.arbitrator.disputeStatus(request.disputeID);
                        (result.appealStart, result.appealEnd) = request.arbitrator.appealPeriod(request.disputeID);

                        Round storage round = request.rounds[request.rounds.length - 1];
                        result.feeRewards = round.feeRewards;
                        result.hasPaid = round.hasPaid;
                        result.paidFees = round.paidFees;
                    }
                    results[index] = result;
                    index++;
                } else {
                    hasMore = true;
                    break;
                }
            }
        }
    }

}
