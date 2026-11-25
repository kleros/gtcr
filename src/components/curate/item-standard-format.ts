import { BigNumber, type BigNumberish, utils } from 'ethers'

/*
 * Amount and time helpers for the item pages (DESIGN.md: money is always
 * legible, full precision, with the chain's currency).
 */

/**
 * A decimal without the zeros that end its fraction, nor a point left with
 * nothing after it: "1.50" is "1.5", "2.0" is "2". A whole "100" (a 0-decimal
 * token) keeps its zeros. Counted back from the end: /\.?0+$/ tries again
 * from every zero of a run, and a pasted "0.000…01" of 100,000 digits held
 * the Stake step for seconds.
 */
export const trimZeros = (decimal: string): string => {
  if (!decimal.includes('.')) return decimal
  let end = decimal.length
  while (decimal[end - 1] === '0') end -= 1
  if (end < decimal.length && decimal[end - 1] === '.') end -= 1
  return decimal.slice(0, end)
}

/** "51.6" from wei: full precision, trailing zeros stripped. */
export const formatEther = (value: BigNumberish): string =>
  trimZeros(utils.formatEther(BigNumber.from(value)))

/** "1234567" as "1,234,567": a run of digits, grouped from its end. */
const groupDigits = (digits: string): string => {
  const head = digits.length % 3 || 3
  const groups = [digits.slice(0, head)]
  for (let at = head; at < digits.length; at += 3)
    groups.push(digits.slice(at, at + 3))
  return groups.join(',')
}

/**
 * Thousands separators on the whole part; the decimals stay exact. Each run
 * of digits is grouped in one pass: /\B(?=(\d{3})+(?!\d))/g reads ahead to
 * the end of the run from every digit, and a long pasted deposit held the
 * factory's preview for seconds.
 */
export const groupThousands = (decimal: string): string => {
  const [whole, fraction] = decimal.split('.')
  const grouped = whole.replace(/\d+/g, groupDigits)
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/** "51.6 xDAI", "1,280.0 xDAI"; an em dash while the amount is unknown. */
export const formatAmount = (
  value: BigNumberish | null | undefined,
  currency: string,
): string =>
  value === null || value === undefined
    ? '—'
    : `${groupThousands(formatEther(value))} ${currency}`

/** Unix seconds from a subgraph string, a BigNumber or a number; 0 if unset. */
export const toSeconds = (value: unknown): number => {
  if (value === undefined || value === null) return 0
  if (BigNumber.isBigNumber(value)) return value.toNumber()
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Sum of two amounts when both are known. */
export const sumAmounts = (
  a: BigNumberish | null | undefined,
  b: BigNumberish | null | undefined,
): BigNumber | undefined =>
  a === null || a === undefined || b === null || b === undefined
    ? undefined
    : BigNumber.from(a).add(BigNumber.from(b))
