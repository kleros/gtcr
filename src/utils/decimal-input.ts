/*
 * An amount as people type it. Phones in comma-decimal regions offer no dot
 * on their decimal keypad, and many people write 0,5: one comma with no dot
 * is read as the decimal point. "1,000" is left as typed (one thousand, or
 * one with three decimals?) for the caller's own check to refuse, as is
 * anything else that is not a plain decimal. Surrounding spaces are dropped.
 */
export const normalizeDecimalInput = (text: string): string => {
  const trimmed = text.trim()
  if (trimmed.includes('.')) return trimmed
  const commas = trimmed.split(',').length - 1
  if (commas !== 1) return trimmed
  const [, fraction] = trimmed.split(',')
  if (/^\d{3}$/.test(fraction)) return trimmed
  return trimmed.replace(',', '.')
}
