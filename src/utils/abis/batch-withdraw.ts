/**
 * ABI for Kleros' BatchWithdraw contract, inlined to avoid the @kleros/tcr
 * dep (it brought the whole truffle/web3 1.x tree for these two entries).
 * Copied from that package's build artifact; every deployment in
 * standardBatchWithdrawAddresses carries both selectors.
 */
export const BatchWithdrawABI = [
  {
    constant: false,
    inputs: [
      { name: '_address', type: 'address' },
      { name: '_contributor', type: 'address' },
      { name: '_itemID', type: 'bytes32' },
      { name: '_request', type: 'uint256' },
      { name: '_cursor', type: 'uint256' },
      { name: '_count', type: 'uint256' },
    ],
    name: 'batchRoundWithdraw',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_address', type: 'address' },
      { name: '_contributor', type: 'address' },
      { name: '_itemID', type: 'bytes32' },
      { name: '_cursor', type: 'uint256' },
      { name: '_count', type: 'uint256' },
      { name: '_roundCursor', type: 'uint256' },
      { name: '_roundCount', type: 'uint256' },
    ],
    name: 'batchRequestWithdraw',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const
