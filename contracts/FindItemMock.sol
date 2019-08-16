
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "solidity-rlp/contracts/RLPReader.sol";

contract FindItemMock {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;
    using BytesLib for bytes;

    bytes[] public items;

    // Item [18, 'PNK', 'Pinakion', '0xca35b7d915458ef540ade6068dfe2f44e8fa733c']
    // RLP encoded: 0xe383504e4b128850696e616b696f6e94ca35b7d915458ef540ade6068dfe2f44e8fa733c
    // Input for remix: ["0xe3","0x83","0x50","0x4e","0x4b","0x12","0x88","0x50","0x69","0x6e","0x61","0x6b","0x69","0x6f","0x6e","0x94","0xca","0x35","0xb7","0xd9","0x15","0x45","0x8e","0xf5","0x40","0xad","0xe6","0x06","0x8d","0xfe","0x2f","0x44","0xe8","0xfa","0x73","0x3c"]
    constructor (bytes memory rlpEncodedItem) public {
        items.push(rlpEncodedItem);
    }

    function findItem(bytes memory _rlpEncodedMatch, uint _count) public view returns (bytes[] memory) {
        RLPReader.RLPItem[] memory matchItem = _rlpEncodedMatch.toRlpItem().toList();
        bytes[] memory results = new bytes[](_count);
        uint itemsFound;
        for(uint i = 0; i < items.length; i++) { // Iterate over every item in storage.
            RLPReader.RLPItem[] memory item = items[i].toRlpItem().toList();
            for (uint j = 0; j < matchItem.length; j++) { // Iterate over every column.
                if (item[j].toBytes().equal(matchItem[j].toBytes())) {
                    results[itemsFound] = items[i];
                    itemsFound++;
                    break;
                }
            }
        }
        return results;
    }
}
