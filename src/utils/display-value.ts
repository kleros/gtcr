/*
 * A field value as React can render it. Entry values come from files anyone
 * can write (a Light or Stake entry is its IPFS file); one that is not text,
 * a number or a boolean (an object in a hand-made file) would otherwise
 * reach React as a child and take the whole list or entry page down for
 * every visitor, so it is shown as its JSON text instead.
 */
export const displayableValue = (
  value: unknown,
): string | number | boolean | null | undefined => {
  if (value === null || value === undefined) return value
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value
  if (typeof value === 'bigint') return value.toString()
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
