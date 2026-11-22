import { describe, expect, it } from 'vitest'
import { getAddressPage, getTxPage } from './network-utils'

const ADDRESS = '0x5aFE00000000000000000000000000000000c0De'
const TX_HASH =
  '0x8f1c4b2e0d9a7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b'

describe.each([
  [1, 'Ethereum', 'https://etherscan.io'],
  // Gnosisscan is being retired: Gnosis links go to Blockscout.
  [100, 'Gnosis', 'https://gnosis.blockscout.com'],
  [11155111, 'Sepolia', 'https://sepolia.etherscan.io'],
])('on chain %i (%s)', (networkId, _name, explorer) => {
  it('links an address to its explorer page', () => {
    expect(getAddressPage({ networkId, address: ADDRESS })).toBe(
      `${explorer}/address/${ADDRESS}`,
    )
  })

  it('links a transaction to its explorer page', () => {
    expect(getTxPage({ networkId, txHash: TX_HASH })).toBe(
      `${explorer}/tx/${TX_HASH}`,
    )
  })
})

describe('an unsupported chain', () => {
  it('falls back to Etherscan', () => {
    expect(getAddressPage({ networkId: 42161, address: ADDRESS })).toBe(
      `https://etherscan.io/address/${ADDRESS}`,
    )
    expect(getTxPage({ networkId: 0, txHash: TX_HASH })).toBe(
      `https://etherscan.io/tx/${TX_HASH}`,
    )
  })
})
