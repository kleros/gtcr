import { BigNumber } from 'ethers'
import { describe, expect, it, vi } from 'vitest'
import { exactAmount, formatTokenAmount, nativeText, tokenText } from './shell'

// The amounts never reach the wallet; keep AppKit out of the test.
vi.mock('config/wagmi', () => ({ appKitModal: null }))

const GWEI = 1_000_000_000n

describe('the amounts a Stake dialog asks someone to sign', () => {
  it('state a cost of a few thousand gwei, not "0"', () => {
    expect(nativeText(3_000n * GWEI, 'xDAI')).toBe('0.000003 xDAI')
    expect(nativeText(BigNumber.from(1), 'ETH')).toBe(
      '0.000000000000000001 ETH',
    )
  })

  it('keep every digit instead of cutting the amount short', () => {
    expect(tokenText('1000009000000000000', 18, 'sDAI')).toBe('1.000009 sDAI')
    expect(nativeText('36123456000000000000', 'xDAI')).toBe('36.123456 xDAI')
  })

  it("read the token's own decimals", () => {
    expect(tokenText(100_000_000n, 6, 'USDC')).toBe('100 USDC')
    expect(tokenText(1n, 6, 'USDC')).toBe('0.000001 USDC')
    // A token with no decimals keeps its zeros: 100 is not 1.
    expect(tokenText(100n, 0, 'TKN')).toBe('100 TKN')
    expect(tokenText(0, 18, 'sDAI')).toBe('0 sDAI')
  })

  it('wait for an amount that is not known yet', () => {
    expect(nativeText(undefined, 'xDAI')).toBe('… xDAI')
    expect(exactAmount(null)).toBe('…')
  })
})

describe('formatTokenAmount', () => {
  it('stays the short figure a card leads with', () => {
    expect(formatTokenAmount('1234567890000000000', 18)).toBe('1.2345')
    // The item page leaves a cost that reads as nothing here out of its
    // sentence; the dialog then states it exactly (above).
    expect(formatTokenAmount((3_000n * GWEI).toString(), 18, 5)).toBe('0')
  })
})
