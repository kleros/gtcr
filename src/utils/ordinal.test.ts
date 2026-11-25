import { describe, expect, it } from 'vitest'
import toOrdinal from './ordinal'

describe('toOrdinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [9, '9th'],
    [10, '10th'],
  ])('writes %i as %s', (n, text) => {
    expect(toOrdinal(n)).toBe(text)
  })

  it.each([
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [14, '14th'],
    [19, '19th'],
  ])('gives the teens "th": %i is %s', (n, text) => {
    expect(toOrdinal(n)).toBe(text)
  })

  it.each([
    [20, '20th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [24, '24th'],
    [91, '91st'],
    [99, '99th'],
  ])('repeats st, nd, rd in every later ten: %i is %s', (n, text) => {
    expect(toOrdinal(n)).toBe(text)
  })

  it.each([
    [100, '100th'],
    [101, '101st'],
    [102, '102nd'],
    [111, '111th'],
    [112, '112th'],
    [113, '113th'],
    [121, '121st'],
    [1002, '1002nd'],
    [1011, '1011th'],
  ])('starts over each hundred: %i is %s', (n, text) => {
    expect(toOrdinal(n)).toBe(text)
  })

  it('writes 0 as 0th', () => {
    expect(toOrdinal(0)).toBe('0th')
  })
})
