import { describe, expect, it } from 'vitest'
import { truncateAtWord } from './truncate-at-word'

describe('truncateAtWord', () => {
  it('leaves text that fits as it is', () => {
    expect(truncateAtWord('Kleros Curate', 13)).toBe('Kleros Curate')
    expect(truncateAtWord('Kleros Curate', 60)).toBe('Kleros Curate')
    expect(truncateAtWord('', 0)).toBe('')
  })

  it.each([
    ['Kleros Curate registry', 10, 'Kleros...'],
    ['The quick brown fox jumps', 12, 'The quick...'],
    ['The quick brown fox jumps', 16, 'The quick brown...'],
    ['Tokens, NFTs and addresses', 9, 'Tokens,...'],
  ])('cuts "%s" at %i back to the last whole word', (text, max, result) => {
    expect(truncateAtWord(text, max)).toBe(result)
  })

  it('keeps a word that ends on the limit when a space follows the cut', () => {
    expect(truncateAtWord('Kleros Curate registry', 14)).toBe(
      'Kleros Curate...',
    )
  })

  it('cuts a single long word at the limit', () => {
    expect(truncateAtWord('Supercalifragilistic', 5)).toBe('Super...')
  })

  it('adds the ellipsis after a start of the text that stays within the limit', () => {
    const text = 'Curated lists of tokens, addresses and websites on Ethereum'
    for (const max of [5, 12, 20, 33, 47]) {
      const result = truncateAtWord(text, max)
      expect(result.endsWith('...')).toBe(true)
      const kept = result.slice(0, -3)
      expect(kept.length).toBeLessThanOrEqual(max)
      expect(text.startsWith(kept)).toBe(true)
    }
  })

  // Regression: when the limit fell exactly at the end of a word, that whole
  // word fit but was dropped: the cut text "Kleros Curate" ends the word, yet the
  // function backs up to the space before it (lastIndexOf on the cut text,
  // not a check of the character after the cut). One character more keeps it.
  it('keeps a whole word that ends exactly on the limit', () => {
    expect(truncateAtWord('Kleros Curate registry', 13)).toBe(
      'Kleros Curate...',
    )
  })
})
