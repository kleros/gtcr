import { describe, expect, it } from 'vitest'
import { BigNumber, ethers } from 'ethers'
import { formatNative, totalDeposit } from './amounts'

const ether = (text: string) => ethers.utils.parseEther(text)

describe('formatNative', () => {
  it.each([
    ['0', '0'],
    ['1', '0.000000000000000001'],
    ['50000000000000000', '0.05'],
    ['1000000000000000000', '1'],
    // Only the fraction's zeros go: 10 and 1230 keep theirs.
    ['10000000000000000000', '10'],
    ['1230000000000000000000', '1230'],
    ['1250000000000000000', '1.25'],
  ])('%s wei is %s', (wei, text) => {
    expect(formatNative(wei)).toBe(text)
  })

  it('reads BigNumbers and bigints', () => {
    expect(formatNative(BigNumber.from('30000000000000000'))).toBe('0.03')
    expect(formatNative(10n ** 18n * 7n)).toBe('7')
  })

  it('writes a large number without an exponent', () => {
    // String(1e21) is "1e+21", which formatEther cannot read.
    expect(formatNative(1e21)).toBe('1000')
  })

  it('keeps every digit of an amount beyond Number precision', () => {
    expect(formatNative((2n ** 256n - 1n).toString())).toBe(
      '115792089237316195423570985008687907853269984665640564039457.584007913129639935',
    )
  })

  it('is null while the amount is unknown', () => {
    expect(formatNative(null)).toBeNull()
    expect(formatNative(undefined)).toBeNull()
  })
})

describe('totalDeposit', () => {
  const COST = ether('0.03')

  it.each([
    ['a dot decimal', '0.05', '0.08'],
    ['a decimal comma', '0,05', '0.08'],
    ['a whole number', '2', '2.03'],
    ['a number', 0.5, '0.53'],
    // The form can hold numbers JavaScript writes with an exponent.
    ['a tiny number', 5e-7, '0.0300005'],
    ['zero', 0, '0.03'],
    ['one wei', '0.000000000000000001', '0.030000000000000001'],
  ])('adds %s to the arbitration cost', (_, base, total) => {
    expect(totalDeposit(base, COST)).toEqual(ether(total))
  })

  it('counts a missing base as 0', () => {
    expect(totalDeposit(undefined, COST)).toEqual(COST)
    expect(totalDeposit(null, COST)).toEqual(COST)
  })

  it('keeps every wei of amounts beyond Number precision', () => {
    expect(
      totalDeposit(
        '123456789012345678901234567890.123456789012345678',
        1,
      )?.toString(),
    ).toBe('123456789012345678901234567890123456789012345679')
  })

  it('reads the cost as a string, a number or a BigNumber', () => {
    expect(totalDeposit('1', '30000000000000000')).toEqual(ether('1.03'))
    expect(totalDeposit('1', 0)).toEqual(ether('1'))
    expect(totalDeposit('1', BigNumber.from(1))).toEqual(ether('1').add(1))
  })

  it.each([
    // "1,000" could be one thousand or one: it is never read as 1.
    ['a thousands-looking comma', '1,000'],
    ['words', 'one'],
    ['an emptied field', ''],
    ['more decimals than wei has', '0.0000000000000000001'],
  ])('is null for %s', (_, base) => {
    expect(totalDeposit(base, COST)).toBeNull()
  })

  it('is null while the arbitration cost is unknown or unreadable', () => {
    expect(totalDeposit('1', null)).toBeNull()
    expect(totalDeposit('1', undefined)).toBeNull()
    expect(totalDeposit('1', 'not a cost')).toBeNull()
  })

  // Regression: a negative base was subtracted from the cost instead of
  // reading as invalid. The schema refuses it ("The amount must not be negative."), but
  // while "-0.01" is in the field the deposit field and the live preview
  // (BaseDepositField, DepositTotalLine, preview.tsx) show a total of 0.02
  // xDAI for a 0.03 xDAI arbitration cost: less than the arbitration alone.
  // "-1" shows -0.97. The doc says null while the base is invalid.
  it('is null for a negative base', () => {
    expect(totalDeposit('-0.01', COST)).toBeNull()
  })
})
