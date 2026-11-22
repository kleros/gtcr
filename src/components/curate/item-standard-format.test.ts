import { describe, expect, it } from 'vitest'
import { BigNumber } from 'ethers'
import {
  formatAmount,
  formatEther,
  groupThousands,
  sumAmounts,
  toSeconds,
} from './item-standard-format'

const MAX_UINT256 = 2n ** 256n - 1n

describe('formatEther', () => {
  it.each([
    ['51600000000000000000', '51.6'],
    ['1000000000000000000', '1'],
    ['10000000000000000000', '10'],
    ['1280000000000000000000', '1280'],
    ['1', '0.000000000000000001'],
    ['0', '0'],
    ['-1500000000000000000', '-1.5'],
  ])('%s wei is %s', (wei, text) => {
    expect(formatEther(wei)).toBe(text)
  })

  it('keeps full precision beyond Number', () => {
    expect(formatEther(MAX_UINT256.toString())).toBe(
      '115792089237316195423570985008687907853269984665640564039457.584007913129639935',
    )
  })
})

describe('groupThousands', () => {
  it.each([
    ['1234567.891', '1,234,567.891'],
    ['1234', '1,234'],
    ['123', '123'],
    ['0.123456', '0.123456'],
    // The decimals stay exact: never grouped.
    ['1000.0001', '1,000.0001'],
    ['-1234567', '-1,234,567'],
    ['', ''],
  ])('%j as %j', (decimal, grouped) => {
    expect(groupThousands(decimal)).toBe(grouped)
  })
})

describe('formatAmount', () => {
  it.each([
    ['51600000000000000000', 'xDAI', '51.6 xDAI'],
    ['1280000000000000000000', 'xDAI', '1,280 xDAI'],
    ['1234567890000000000000000', 'ETH', '1,234,567.89 ETH'],
    ['0', 'ETH', '0 ETH'],
  ])('%s wei in %s is %s', (wei, currency, text) => {
    expect(formatAmount(wei, currency)).toBe(text)
  })

  it('reads BigNumbers and bigints', () => {
    expect(formatAmount(BigNumber.from('30000000000000000'), 'xDAI')).toBe(
      '0.03 xDAI',
    )
    expect(formatAmount(10n ** 21n, 'ETH')).toBe('1,000 ETH')
  })

  it('is an em dash while the amount is unknown', () => {
    expect(formatAmount(null, 'xDAI')).toBe('—')
    expect(formatAmount(undefined, 'xDAI')).toBe('—')
  })
})

describe('toSeconds', () => {
  it.each([
    ['1700000000', 1_700_000_000],
    [1_700_000_000, 1_700_000_000],
    [BigNumber.from(1_700_000_000), 1_700_000_000],
    ['0', 0],
    [undefined, 0],
    [null, 0],
    ['soon', 0],
    [Infinity, 0],
  ])('%j is %d', (value, seconds) => {
    expect(toSeconds(value)).toBe(seconds)
  })
})

describe('sumAmounts', () => {
  it('adds two known amounts exactly', () => {
    expect(
      sumAmounts('50000000000000000', BigNumber.from('1200000000000000000')),
    ).toEqual(BigNumber.from('1250000000000000000'))
    expect(sumAmounts(MAX_UINT256 - 1n, 1n)?.toString()).toBe(
      MAX_UINT256.toString(),
    )
    expect(sumAmounts(0, 0)).toEqual(BigNumber.from(0))
  })

  it('is undefined while either is unknown', () => {
    expect(sumAmounts(null, 1)).toBeUndefined()
    expect(sumAmounts(1, undefined)).toBeUndefined()
    expect(sumAmounts(undefined, null)).toBeUndefined()
  })
})
