/**
 *  @authors: [@mtsalenc]
 *  @reviewers: []
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

contract GTCRMock {

    bytes[] public items;
    mapping(bytes32 => bool) keys;

    event MetaEvidence(uint indexed _metaEvidenceID, string _evidence);

    constructor(string memory _registrationMetaEvidence, string memory _clearingMetaEvidence) public {
        emit MetaEvidence(0, _registrationMetaEvidence);
        emit MetaEvidence(1, _clearingMetaEvidence);
    }

    function addItem(bytes calldata _item) external {
        bytes32 key = keccak256(_item);
        require(!keys[key], "Item already added");
        items.push(_item);
        keys[key] = true;
    }

    function itemCount() external view returns (uint) {
        return items.length;
    }

    function getItems(uint _index) external view returns (bytes[100] memory results, bool hasMore){
        uint i = 0;
        for (; i < items.length && i < 100; i++) {
            results[i] = items[i+_index];
        }
        hasMore = items.length > i;
    }

}
