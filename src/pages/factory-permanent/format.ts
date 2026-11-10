import { BigNumber, ethers, type BigNumberish } from 'ethers'
import { jurorsAndCourtIDFromExtraData } from 'utils/string'

/*
 * Amounts, durations and extra data for the Stake wizard. The typed minimum
 * stake is in tokens: the deploy call encodes it in the stake token's own
 * base units (parseUnits with the token's decimals), the same way the submit
 * dialog and the item pages read stakes. The challenger's share uses the
 * deploy call's rounding (the percent rounded up, times 100, over a divisor
 * of 10 000).
 */

const trimZeros = (text: string) => text.replace(/\.?0+$/, '')

/** "0.0309" from wei, trailing zeros trimmed (same rule as eth-amount). */
export const formatNative = (wei: BigNumberish): string =>
  trimZeros(ethers.utils.formatEther(wei))

/** Like formatNative, but null while the amount is unknown. */
export const formatMaybe = (
  wei: BigNumberish | null | undefined,
): string | null => {
  if (wei === null || wei === undefined) return null
  try {
    return formatNative(wei)
  } catch {
    return null
  }
}

/** Base units of a token as a token amount, trailing zeros trimmed. */
export const formatToken = (
  units: BigNumberish | null | undefined,
  decimals: number,
): string | null => {
  if (units === null || units === undefined) return null
  try {
    return trimZeros(ethers.utils.formatUnits(units, decimals))
  } catch {
    return null
  }
}

/**
 * A stored amount as a plain decimal string: the shortest form JavaScript
 * gives a number, with its exponent written out ("5e-14" becomes
 * "0.00000000000005"), so parseUnits reads it.
 */
export const plainDecimal = (value: unknown): string => {
  const text = String(value ?? '')
    .trim()
    .replace(/^\+/, '')
  const match = /^(-?)(\d*)(?:\.(\d*))?e([+-]?\d+)$/i.exec(text)
  if (!match || !`${match[2]}${match[3] ?? ''}`) return text
  const [, sign, wholeText, fraction = '', exponentText] = match
  const whole = wholeText || '0'
  const exponent = Number(exponentText)
  const digits = `${whole}${fraction}`
  const point = whole.length + exponent
  const plain =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
        ? `${digits}${'0'.repeat(point - digits.length)}`
        : `${digits.slice(0, point)}.${digits.slice(point)}`
  const tidy = plain.includes('.') ? trimZeros(plain) : plain
  return `${sign}${tidy.replace(/^0+(?=\d)/, '')}`
}

/**
 * A typed token amount in the token's base units, as the deploy call encodes
 * it, or null if it is not one (not a plain non-negative number, more decimal
 * places than the token has, or more than a uint256 holds).
 */
export const parseAmount = (
  value: unknown,
  decimals = 18,
): BigNumber | null => {
  if (value === '' || value === undefined || value === null) return null
  try {
    const parsed = ethers.utils.parseUnits(plainDecimal(value), decimals)
    return parsed.isNegative() || parsed.gt(ethers.constants.MaxUint256)
      ? null
      : parsed
  } catch {
    return null
  }
}

/**
 * Why a typed minimum stake cannot be encoded for a token, or null when it
 * can (or is empty: the form's own rules cover that).
 */
export const stakeProblem = (
  value: unknown,
  decimals: number,
): 'invalid' | 'precision' | 'too-large' | null => {
  if (value === '' || value === undefined || value === null) return null
  const plain = plainDecimal(value)
  if (!/^(\d+\.?\d*|\.\d+)$/.test(plain)) return 'invalid'
  const fraction = plain.split('.')[1] ?? ''
  if (trimZeros(`0.${fraction}`).length - 2 > decimals) return 'precision'
  try {
    const parsed = ethers.utils.parseUnits(plain, decimals)
    return parsed.gt(ethers.constants.MaxUint256) ? 'too-large' : null
  } catch {
    return 'invalid'
  }
}

/** The message for a stakeProblem, in the token's own terms. */
export const stakeProblemText = (
  problem: ReturnType<typeof stakeProblem>,
  symbol: string,
  decimals: number,
): string | null =>
  problem === 'precision'
    ? `${symbol} has ${decimals} decimals: use at most ${decimals} decimal places.`
    : problem === 'too-large'
      ? 'The minimum stake is too large.'
      : problem === 'invalid'
        ? 'Enter the minimum stake as a plain number, such as 0.05.'
        : null

/** The percent the deploy call sends: rounded up, or null if not a number. */
export const effectivePercent = (value: unknown): number | null => {
  if (value === '' || value === undefined || value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.ceil(parsed) : null
}

/** stake × percent, with the contract's basis-point arithmetic. */
export const shareOf = (stake: BigNumber, percent: number): BigNumber =>
  stake.mul(percent * 100).div(10_000)

/** The typed minimum stake as the contract will enforce it, in tokens. */
export const enforcedStake = (
  value: unknown,
  decimals: number,
): string | null => formatToken(parseAmount(value, decimals), decimals)

const grouped = (exact: string) => {
  const [whole, fraction] = exact.split('.')
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? withCommas : `${withCommas}.${fraction}`
}

/** An exact amount for display: the integer part grouped in thousands. */
export const groupAmount = (exact: string | null): string | null =>
  exact === null ? null : grouped(exact)

/** For a count-up: intermediate values at the amount's precision, then the exact string, grouped. */
export const amountFormat = (exact: string) => {
  const decimals = Math.min(6, (exact.split('.')[1] ?? '').length)
  const target = Number(exact)
  const format = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return (n: number) => (n === target ? grouped(exact) : format.format(n))
}

/** "84 hours", "1 hour". */
export const formatHours = (hours: number | string): string => {
  const count = Number(hours)
  if (Number.isNaN(count)) return `${hours} hours`
  return `${count} hour${count === 1 ? '' : 's'}`
}

/** Hours typed in a field as seconds, or null if not a valid duration. */
export const hoursToSeconds = (hours: unknown): number | null => {
  if (hours === '' || hours === undefined || hours === null) return null
  const parsed = Number(hours)
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round(parsed * 3600)
    : null
}

/** The court and juror count encoded in arbitrator extra data, if readable. */
export const readExtraData = (
  extraData?: string,
): { courtID: number; numberOfJurors: number } | null => {
  if (!extraData) return null
  try {
    return jurorsAndCourtIDFromExtraData(extraData)
  } catch {
    return null
  }
}

/** Builds the Kleros arbitrator extra data: court id then juror count, 32 bytes each. */
export const encodeExtraData = (courtID: number, numberOfJurors: number) =>
  `0x${courtID.toString(16).padStart(64, '0')}${Math.ceil(numberOfJurors)
    .toString(16)
    .padStart(64, '0')}`
