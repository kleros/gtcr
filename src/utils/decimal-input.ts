/*
 * An amount as people type it. Phones in comma-decimal regions offer no dot
 * on their decimal keypad, and many people write 0,5: one comma with no dot
 * is read as the decimal point. "1,000" or "2,375" is left as typed (a
 * thousands group, or three decimals?) for the caller's own check to refuse,
 * with AMBIGUOUS_COMMA saying why, as is anything else that is not a plain
 * decimal. "0,125" or "1234,567" cannot be a thousands group and read as
 * decimals. Surrounding spaces are dropped.
 */

/** One to three digits (not starting with 0), a comma, three digits. */
export const isAmbiguousComma = (text: string): boolean =>
  /^-?[1-9]\d{0,2},\d{3}$/.test(text.trim())

/** What to tell someone whose comma could be either. */
export const AMBIGUOUS_COMMA =
  'A comma before three digits could mean thousands: write 2.375 or 2375.'

export const normalizeDecimalInput = (text: string): string => {
  const trimmed = text.trim()
  if (trimmed.includes('.')) return trimmed
  const commas = trimmed.split(',').length - 1
  if (commas !== 1 || isAmbiguousComma(trimmed)) return trimmed
  return trimmed.replace(',', '.')
}
