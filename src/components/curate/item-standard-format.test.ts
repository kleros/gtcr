import { describe, expect, it } from 'vitest'
import { BigNumber } from 'ethers'
import {
  formatAmount,
  formatEther,
  groupThousands,
  sumAmounts,
  toSeconds,
  trimZeros,
} from './item-standard-format'

const MAX_UINT256 = 2n ** 256n - 1n

/** Every string of `alphabet` up to `maxLength` characters, "" first. */
const allStrings = (alphabet: string, maxLength: number): string[] => {
  const strings = ['']
  let level = ['']
  for (let length = 1; length <= maxLength; length += 1) {
    level = level.flatMap((prefix) =>
      [...alphabet].map((char) => prefix + char),
    )
    strings.push(...level)
  }
  return strings
}

/** How long one call takes, in milliseconds. */
const timed = (run: () => unknown): number => {
  const start = performance.now()
  run()
  return performance.now() - start
}

/*
 * A pasted amount can be any length. 100,000 digits took the old patterns
 * seconds; a pass over them takes about a millisecond, so this leaves a wide
 * margin for a slow runner.
 */
const PASTE = 100_000
const PASTE_BUDGET_MS = 100

describe('trimZeros', () => {
  it.each([
    ['1.50', '1.5'],
    ['2.0', '2'],
    ['100.000', '100'],
    ['0.0', '0'],
    ['-0.50', '-0.5'],
    ['0.000001', '0.000001'],
    // Nothing to trim: a point with nothing after it stays.
    ['1.', '1.'],
    // A whole number (a 0-decimal token) keeps its own zeros.
    ['100', '100'],
    ['0', '0'],
    ['', ''],
  ])('%j as %j', (decimal, trimmed) => {
    expect(trimZeros(decimal)).toBe(trimmed)
  })

  // The pattern it replaces, on every short string of the characters that
  // matter to it.
  it('trims exactly as /\\.?0+$/ did after a point', () => {
    const byPattern = (text: string) =>
      text.includes('.') ? text.replace(/\.?0+$/, '') : text
    const differ = allStrings('01.-', 7).filter(
      (text) => trimZeros(text) !== byPattern(text),
    )
    expect(differ).toEqual([])
  })

  it('reads a long pasted amount at once', () => {
    const zeros = '0'.repeat(PASTE)
    expect(timed(() => trimZeros(`0.${zeros}1`))).toBeLessThan(PASTE_BUDGET_MS)
    expect(trimZeros(`0.${zeros}1`)).toBe(`0.${zeros}1`)
    expect(timed(() => trimZeros(`1${zeros}.0`))).toBeLessThan(PASTE_BUDGET_MS)
    expect(trimZeros(`1${zeros}.0`)).toBe(`1${zeros}`)
  })
})

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

  // The pattern it replaces, on every short string of digits, signs, points
  // and spaces: what amounts are made of. Only a letter or "_" before the
  // digits ever read otherwise: the pattern's \B could put a comma right
  // after it ("0x,123").
  it('groups exactly as /\\B(?=(\\d{3})+(?!\\d))/g did', () => {
    const byPattern = (decimal: string) => {
      const [whole, fraction] = decimal.split('.')
      const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return fraction === undefined ? grouped : `${grouped}.${fraction}`
    }
    const differ = allStrings('1-. ', 7).filter(
      (decimal) => groupThousands(decimal) !== byPattern(decimal),
    )
    expect(differ).toEqual([])
  })

  it('groups a long pasted amount at once', () => {
    const digits = '1'.repeat(PASTE)
    let grouped = ''
    expect(
      timed(() => {
        grouped = groupThousands(`${digits}.5`)
      }),
    ).toBeLessThan(PASTE_BUDGET_MS)
    expect(grouped.startsWith('1,111,111')).toBe(true)
    expect(grouped.endsWith('111,111.5')).toBe(true)
    expect(grouped.replace(/,/g, '')).toBe(`${digits}.5`)
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
