import { describe, expect, it } from 'vitest'
import { ethers } from 'ethers'
import typedAmountWeiDefault, { typedAmountWei } from './typed-amount'

describe('typedAmountWei', () => {
  it.each([
    ['1.5', '1.5'],
    ['0,5', '0.5'],
    ['1234,567', '1234.567'],
    [' 2 ', '2'],
    ['.5', '0.5'],
    ['5.', '5'],
    ['0', '0'],
    ['0.000000000000000001', '0.000000000000000001'],
  ])('sends %j as %s', (typed, ether) => {
    expect(typedAmountWei(typed)).toEqual(ethers.utils.parseEther(ether))
  })

  it('keeps every wei of an amount beyond Number precision', () => {
    expect(
      typedAmountWei(
        '123456789012345678901234567890.123456789012345678',
      ).toString(),
    ).toBe('123456789012345678901234567890123456789012345678')
  })

  // The confirm waits for a readable amount: none of these may send a value
  // the field does not show.
  it.each([
    ['an empty field', ''],
    ['spaces', '   '],
    ['a negative amount', '-1'],
    ['a negative comma decimal', '-0,5'],
    ['an exponent', '1e-3'],
    ['words', 'one'],
    // "1,000" could be one thousand or one.
    ['a thousands-looking comma', '1,000'],
    ['three digits after a comma', '2,375'],
    ['a thousands comma and a point', '1,000.5'],
    ['two points', '1.2.3'],
    ['more decimals than wei has', '0.0000000000000000001'],
    ['Infinity', 'Infinity'],
  ])('is zero for %s', (_, typed) => {
    expect(typedAmountWei(typed).isZero()).toBe(true)
  })

  it('is also the default export', () => {
    expect(typedAmountWeiDefault).toBe(typedAmountWei)
  })
})
