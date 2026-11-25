import { describe, expect, it } from 'vitest'
import { BigNumber } from 'ethers'
import { amountText, formatAmount, formatFileSize } from './amounts'

describe('formatAmount', () => {
  it.each([
    ['51600000000000000000', 18, '51.6'],
    ['1000000000000000000', 18, '1'],
    ['10000000000000000000', 18, '10'],
    ['1', 18, '0.000000000000000001'],
    ['0', 18, '0'],
    ['1500000', 6, '1.5'],
    ['1000000', 6, '1'],
    ['100', 1, '10'],
    // With 0 decimals there is no point: "100" must not become "1".
    ['100', 0, '100'],
    ['0', 0, '0'],
  ])('%s base units with %d decimals is %s', (value, decimals, text) => {
    expect(formatAmount(value, decimals)).toBe(text)
  })

  it('reads 18 decimals when none are given', () => {
    expect(formatAmount('51600000000000000000')).toBe('51.6')
  })

  it('reads numbers, BigNumbers and bigints', () => {
    // String(1e21) is "1e+21", which formatUnits cannot read.
    expect(formatAmount(1e21)).toBe('1000')
    expect(formatAmount(BigNumber.from('2500000'), 6)).toBe('2.5')
    expect(formatAmount(2_500_000n, 6)).toBe('2.5')
  })

  it('keeps every digit of an amount beyond Number precision', () => {
    expect(formatAmount(2n ** 256n - 1n, 18)).toBe(
      '115792089237316195423570985008687907853269984665640564039457.584007913129639935',
    )
    expect(formatAmount(2n ** 256n - 1n, 0)).toBe((2n ** 256n - 1n).toString())
  })
})

describe('amountText', () => {
  it.each([
    [
      '51.6 xDAI',
      { value: 51_600_000_000_000_000_000n, decimals: 18, symbol: 'xDAI' },
    ],
    ['1.5 USDC', { value: 1_500_000n, decimals: 6, symbol: 'USDC' }],
    ['100 TKN', { value: 100n, decimals: 0, symbol: 'TKN' }],
    ['0 ETH', { value: 0n, decimals: 18, symbol: 'ETH' }],
  ])('reads %s', (text, amount) => {
    expect(amountText(amount)).toBe(text)
  })

  it('is an em dash until the amount is known', () => {
    expect(amountText()).toBe('—')
    expect(amountText(undefined)).toBe('—')
  })
})

describe('formatFileSize', () => {
  it.each([
    [0, '1 KB'],
    [200, '1 KB'],
    [1024, '1 KB'],
    [1536, '2 KB'],
    [640 * 1024, '640 KB'],
    [1024 * 1024, '1.0 MB'],
    [1.25 * 1024 * 1024, '1.3 MB'],
    [12.3 * 1024 * 1024, '12.3 MB'],
  ])('%d bytes is %s', (bytes, text) => {
    expect(formatFileSize(bytes)).toBe(text)
  })
})
