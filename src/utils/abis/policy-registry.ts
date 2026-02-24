/** ABI for the Kleros PolicyRegistry contract (inlined to avoid @kleros/kleros dep). */
export const PolicyRegistryABI = [
  {
    constant: true,
    inputs: [{ name: '', type: 'uint256' }],
    name: 'policies',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'governor',
    outputs: [{ name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
] as const
