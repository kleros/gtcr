export const truncateAtWord = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  // A word that ends exactly at the limit fits whole.
  if (text[maxLength] === ' ') return `${truncated}...`
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > 0
    ? `${truncated.substring(0, lastSpace)}...`
    : `${truncated}...`
}
