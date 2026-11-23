import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import SmartContractWalletWarning from './smart-contract-wallet-warning'

// The connected account holds a Safe proxy's code: any code but 0x or an
// EIP-7702 delegation is a contract.
vi.mock('hooks/use-web3-context', () => ({
  useWeb3Context: () => ({
    account: '0x9999999999999999999999999999999999999999',
    library: {
      getCode: async () =>
        '0x608060405273ffffffffffffffffffffffffffffffffffffffff6000',
    },
  }),
}))

describe('SmartContractWalletWarning', () => {
  it('says what a contract wallet loses, with the words spaced', async () => {
    renderWithProviders(<SmartContractWalletWarning />)
    const notice = await screen.findByRole('status')
    // Text content, as a screen reader or a copy reads it: the spaces are
    // characters, not margins.
    expect(notice.textContent).toBe(
      'Smart contract wallet detected. Deposits and rewards a Standard list pays to most contract wallets are lost, and on Gnosis a Stake list cannot pay one at all (on Ethereum it pays WETH instead). Use an externally owned account. Learn more',
    )
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute(
      'target',
      '_blank',
    )
  })
})
