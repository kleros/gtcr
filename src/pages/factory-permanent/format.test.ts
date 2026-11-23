import { describe, expect, it } from 'vitest'
import { BigNumber, ethers } from 'ethers'
import {
  effectivePercent,
  enforcedStake,
  formatHours,
  formatMaybe,
  formatNative,
  formatToken,
  groupAmount,
  hoursToSeconds,
  parseAmount,
  plainDecimal,
  shareOf,
  stakeProblem,
  stakeProblemText,
  typedNumber,
  typedText,
} from './format'

const MAX_UINT256 = ethers.constants.MaxUint256.toString()
const MAX_UINT256_PLUS_ONE = ethers.constants.MaxUint256.add(1).toString()

describe('formatNative', () => {
  it.each([
    ['30900000000000000', '0.0309'],
    ['0', '0'],
    ['1000000000000000000', '1'],
    ['10000000000000000000', '10'],
  ])('%s wei is %s', (wei, text) => {
    expect(formatNative(wei)).toBe(text)
  })
})

describe('formatMaybe', () => {
  it('formats a known amount', () => {
    expect(formatMaybe(BigNumber.from('30900000000000000'))).toBe('0.0309')
  })

  it('is null while unknown or unreadable', () => {
    expect(formatMaybe(null)).toBeNull()
    expect(formatMaybe(undefined)).toBeNull()
    expect(formatMaybe('not wei')).toBeNull()
  })
})

describe('formatToken', () => {
  it.each([
    ['1500000', 6, '1.5'],
    ['1000000', 6, '1'],
    ['10000000', 6, '10'],
    ['1', 18, '0.000000000000000001'],
    ['12345678', 2, '123456.78'],
    [
      MAX_UINT256,
      18,
      '115792089237316195423570985008687907853269984665640564039457.584007913129639935',
    ],
  ])('%s base units with %d decimals is %s', (units, decimals, text) => {
    expect(formatToken(units, decimals)).toBe(text)
  })

  it('is null while unknown or unreadable', () => {
    expect(formatToken(null, 6)).toBeNull()
    expect(formatToken(undefined, 6)).toBeNull()
    expect(formatToken('not units', 6)).toBeNull()
  })

  // Regression: with a 0-decimal token formatUnits writes no point ("100"), and
  // trimZeros strips the whole number's own zeros: 100 tokens read "1", 50
  // read "5", 0 reads "". The Stake wizard shows these figures as the
  // minimum stake, the challenger's share and the grown stake (tcr-params'
  // "enforced" line, preview.tsx, the deploy review) before the deploy
  // encodes the right 100. submit-item/amounts.ts formatAmount guards this.
  it('keeps the zeros of a whole number of a 0-decimal token', () => {
    expect(formatToken('100', 0)).toBe('100')
    expect(formatToken('0', 0)).toBe('0')
  })
})

describe('typedText', () => {
  it.each([
    ['0,5', '0.5'],
    ['1,000', '1,000'],
    [' 3 ', '3'],
    ['12.5', '12.5'],
    [5e-14, '5e-14'],
    [12, '12'],
    [undefined, ''],
    [null, ''],
  ])('%j as %j', (value, text) => {
    expect(typedText(value)).toBe(text)
  })
})

describe('typedNumber', () => {
  it.each([
    ['0,5', 0.5],
    ['12.5', 12.5],
    [3, 3],
  ])('reads %j as %d', (value, number) => {
    expect(typedNumber(value)).toBe(number)
  })

  it.each([[''], ['1,000'], ['abc'], [undefined], [null]])(
    'reads %j as no number',
    (value) => {
      expect(typedNumber(value)).toBeNaN()
    },
  )
})

describe('plainDecimal', () => {
  it.each([
    // Numbers JavaScript writes with an exponent, written out.
    [5e-14, '0.00000000000005'],
    [1e-7, '0.0000001'],
    [1e21, '1000000000000000000000'],
    [1.5e21, '1500000000000000000000'],
    // Typed exponents, with what the point and the zeros become.
    ['1.5e3', '1500'],
    ['1.5E-3', '0.0015'],
    ['2.50e1', '25'],
    ['100e-2', '1'],
    ['5e-1', '0.5'],
    ['.5e1', '5'],
    ['0.000e5', '0'],
    ['-1e-3', '-0.001'],
    // A decimal comma reads as the point; a thousands comma stays.
    ['0,5', '0.5'],
    ['1,000', '1,000'],
    ['+5', '5'],
    // Plain text needs nothing: it stays exactly as typed.
    ['12.50', '12.50'],
    [1.23, '1.23'],
    ['e5', 'e5'],
    ['abc', 'abc'],
    ['', ''],
    [undefined, ''],
  ])('%j as %j', (value, plain) => {
    expect(plainDecimal(value)).toBe(plain)
  })
})

describe('parseAmount', () => {
  it.each([
    ['1.5', 18, '1500000000000000000'],
    ['1.5', 6, '1500000'],
    ['0,5', 6, '500000'],
    [5e-14, 18, '50000'],
    ['1e3', 6, '1000000000'],
    ['100', 0, '100'],
    ['0', 6, '0'],
    [MAX_UINT256, 0, MAX_UINT256],
  ])('encodes %j with %d decimals as %s', (value, decimals, units) => {
    expect(parseAmount(value, decimals)?.toString()).toBe(units)
  })

  it('encodes in the token’s own decimals', () => {
    // One USDC is 10^6 base units, not the 10^18 parseEther would send.
    expect(parseAmount('1', 6)).toEqual(BigNumber.from(10).pow(6))
    expect(parseAmount('1', 18)).toEqual(BigNumber.from(10).pow(18))
  })

  it.each([
    ['more decimals than the token has', '1.1234567', 6],
    ['a fraction of a 0-decimal token', '1.5', 0],
    ['a negative amount', '-1', 18],
    ['a thousands-looking comma', '1,000', 18],
    ['words', 'abc', 18],
    ['an empty field', '', 18],
    ['more than a uint256 holds', MAX_UINT256_PLUS_ONE, 0],
  ])('is null for %s', (_, value, decimals) => {
    expect(parseAmount(value, decimals)).toBeNull()
  })

  it('is null while there is no value', () => {
    expect(parseAmount(undefined)).toBeNull()
    expect(parseAmount(null)).toBeNull()
  })
})

describe('stakeProblem', () => {
  it.each([
    ['0.05', 18],
    ['0,05', 6],
    ['1.123456', 6],
    // Trailing zeros are not decimal places the token needs.
    ['1.1000000', 6],
    ['1.0', 0],
    ['100', 0],
    ['1.', 6],
    ['.5', 6],
    ['1e3', 6],
    [MAX_UINT256, 0],
  ])('takes %j for a token with %d decimals', (value, decimals) => {
    expect(stakeProblem(value, decimals)).toBeNull()
  })

  it('leaves an empty field to the form’s own rules', () => {
    expect(stakeProblem('', 18)).toBeNull()
    expect(stakeProblem(undefined, 18)).toBeNull()
    expect(stakeProblem(null, 18)).toBeNull()
  })

  it.each([
    ['1.1234567', 6, 'precision'],
    [1e-7, 6, 'precision'],
    ['1.5', 0, 'precision'],
    ['1e-400', 18, 'precision'],
    [MAX_UINT256_PLUS_ONE, 0, 'too-large'],
    ['1e60', 18, 'too-large'],
    ['1e400', 18, 'too-large'],
    ['-1', 18, 'invalid'],
    ['1,000', 18, 'invalid'],
    ['abc', 18, 'invalid'],
    ['Infinity', 18, 'invalid'],
  ])('%j with %d decimals is %s', (value, decimals, problem) => {
    expect(stakeProblem(value, decimals)).toBe(problem)
  })

  // Regression: plainDecimal wrote an exponent out digit by digit with no bound,
  // and stakeProblem calls it outside its try. "1e999999999" throws a
  // RangeError (Invalid string length) from the Stake step's render
  // (tcr-params.tsx calls stakeProblem while drawing the field), and the
  // draft with it is saved, so the step can fail again on reload. Smaller
  // exponents such as 1e300000000 build a 300 MB string instead and hang
  // the tab. Such a stake is simply too large.
  it('calls an absurd exponent too large instead of throwing', () => {
    expect(stakeProblem('1e999999999', 18)).toBe('too-large')
  })

  // Where a point may sit, read as before the patterns became linear.
  it.each([
    ['5.', null],
    ['+.5', null],
    ['00.50', null],
    ['1.e5', null],
    ['.5e-1', null],
    ['.', 'invalid'],
    ['1..5', 'invalid'],
    ['-.5', 'invalid'],
    ['1.5.e5', 'invalid'],
    ['1e', 'invalid'],
    ['1e+', 'invalid'],
    ['1 5', 'invalid'],
    ['x1.5', 'invalid'],
    ['1.5x', 'invalid'],
    // No number, but the exponent test has always taken a bare point (the
    // form's own rules refuse it first).
    ['.e5', 'too-large'],
    ['1E400', 'too-large'],
  ])('%j is %s', (value, problem) => {
    expect(stakeProblem(value, 18)).toBe(problem)
  })

  // Regression: the checks retried from every digit of a long run (an
  // optional point between two runs of digits, /\.?0+$/ in trimZeros), and
  // 100,000 pasted digits took 15 to 19 s each time the Stake step drew.
  it('judges a long pasted stake at once', () => {
    const digits = '1'.repeat(100_000)
    const timed = (value: string) => {
      const start = performance.now()
      const problem = stakeProblem(value, 18)
      return { problem, ms: performance.now() - start }
    }
    for (const [value, problem] of [
      [`${digits}x`, 'invalid'],
      [`${digits}e`, 'invalid'],
      [`0.${'0'.repeat(100_000)}1`, 'precision'],
    ] as const) {
      const result = timed(value)
      expect(result.problem).toBe(problem)
      expect(result.ms).toBeLessThan(100)
    }
  })
})

describe('stakeProblemText', () => {
  it.each([
    [
      'precision' as const,
      'USDC has 6 decimals: use at most 6 decimal places.',
    ],
    ['too-large' as const, 'The minimum stake is too large.'],
    [
      'invalid' as const,
      'Enter the minimum stake as a plain number, such as 0.05 or 0,05.',
    ],
    [null, null],
  ])('%s says %j', (problem, text) => {
    expect(stakeProblemText(problem, 'USDC', 6)).toBe(text)
  })
})

describe('effectivePercent', () => {
  it.each([
    ['12.5', 12.5],
    ['12,5', 12.5],
    [100, 100],
    ['0', 0],
    // The deploy sends basis points: a third decimal rounds.
    ['33.333', 33.33],
    ['12.345', 12.35],
  ])('%j sends %d percent', (value, percent) => {
    expect(effectivePercent(value)).toBe(percent)
  })

  it.each([[''], ['-5'], ['abc'], ['1,000'], [undefined]])(
    '%j is not a percent',
    (value) => {
      expect(effectivePercent(value)).toBeNull()
    },
  )
})

describe('shareOf', () => {
  const ether = (text: string) => ethers.utils.parseEther(text)

  it.each([
    ['1', 50, '0.5'],
    ['1', 12.5, '0.125'],
    ['1', 0.01, '0.0001'],
    ['1', 0, '0'],
    ['2', 150, '3'],
    // 0.07 × 100 is 7.000000000000001 in floating point: 7 basis points.
    ['1', 0.07, '0.0007'],
  ])('%s × %d%% is %s', (stake, percent, share) => {
    expect(shareOf(ether(stake), percent)).toEqual(ether(share))
  })

  it('rounds down like the contract’s integer division', () => {
    expect(shareOf(BigNumber.from(99), 0.01).toNumber()).toBe(0)
    // 12345 × 3333 / 10000 = 4114.5885
    expect(shareOf(BigNumber.from(12_345), 33.33).toNumber()).toBe(4114)
  })

  it('keeps every unit of stakes beyond Number precision', () => {
    const stake = BigNumber.from(2).pow(200)
    expect(shareOf(stake, 100)).toEqual(stake)
    expect(shareOf(stake, 150).toString()).toBe(
      ((2n ** 200n * 15_000n) / 10_000n).toString(),
    )
  })
})

describe('enforcedStake', () => {
  it.each([
    ['1.50', 18, '1.5'],
    ['0,05', 6, '0.05'],
    [5e-14, 18, '0.00000000000005'],
    ['10', 6, '10'],
    ['0', 18, '0'],
  ])('%j with %d decimals is enforced as %s', (value, decimals, text) => {
    expect(enforcedStake(value, decimals)).toBe(text)
  })

  it.each([
    ['1.1234567', 6],
    ['', 18],
    ['abc', 18],
    ['1,000', 18],
  ])('is null for %j with %d decimals', (value, decimals) => {
    expect(enforcedStake(value, decimals)).toBeNull()
  })

  // Regression: the same trimZeros fault as formatToken. A creator who types 100
  // for a 0-decimal stake token reads "1" as the stake the contract will
  // enforce, while the deploy encodes 100.
  it('shows a 0-decimal token’s stake with its zeros', () => {
    expect(enforcedStake('100', 0)).toBe('100')
  })
})

describe('groupAmount', () => {
  it.each([
    ['1234567.891', '1,234,567.891'],
    ['1000', '1,000'],
    ['999', '999'],
    ['0.000001', '0.000001'],
    [null, null],
  ])('%j as %j', (exact, text) => {
    expect(groupAmount(exact)).toBe(text)
  })
})

describe('formatHours', () => {
  it.each([
    [84, '84 hours'],
    [1, '1 hour'],
    ['1', '1 hour'],
    [1.5, '1.5 hours'],
    [0, '0 hours'],
    ['soon', 'soon hours'],
  ])('%j as %j', (hours, text) => {
    expect(formatHours(hours)).toBe(text)
  })
})

describe('hoursToSeconds', () => {
  it.each([
    ['84', 302_400],
    ['1,5', 5400],
    [0.5, 1800],
    ['0', 0],
    [1 / 3600, 1],
    [87_600, 315_360_000],
  ])('%j hours is %d seconds', (hours, seconds) => {
    expect(hoursToSeconds(hours)).toBe(seconds)
  })

  it.each([[''], ['-1'], ['abc'], ['1,000'], [undefined]])(
    '%j is not a duration',
    (hours) => {
      expect(hoursToSeconds(hours)).toBeNull()
    },
  )
})
