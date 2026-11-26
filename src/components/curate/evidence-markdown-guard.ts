/*
 * Whether an evidence description is rendered as Markdown, or as the plain
 * text it was always shown as. Most evidence has no Markdown in it (about 94%
 * of 3,000 read in November 2026), and those never load the renderer.
 *
 * Anyone can publish evidence, of any length and shape, and every visitor of
 * the entry renders it, so the shapes the parser cannot take stay plain:
 *
 * - Deep nesting. Each `>`, `-`, `*`, `+` or `1.` at a line's start opens one
 *   more level, and a few hundred of them on one line overflow the stack
 *   (500 characters were enough); 20,000 characters of `- - - …` took 90
 *   seconds before failing. Indenting each line further nests as well (96
 *   levels of tab-indented items fit in 5,000 characters). Real evidence
 *   nests at most 3 levels and indents at most 14 columns.
 * - Size. Emphasis costs more than linear time (20,000 characters of `*a`
 *   took 1.6s) and every quote and list level is an element, so a piece
 *   that passes stays within 5,000 characters, 200 lines, 200 of `*`, `_`, a
 *   backtick or `[`, and 100 quote and list markers in all: under 25ms at
 *   worst (crafted and random shapes), where 5,000 characters alone allowed
 *   150ms, and many pieces on one entry add up. Real evidence: 4,459
 *   characters, 59 lines, 30 such signs and 16 markers at most; the composer
 *   allows 1,024 characters.
 */

export const MARKDOWN_MAX_LENGTH = 5000
export const MARKDOWN_MAX_LINES = 200
export const MARKDOWN_MAX_SIGNS = 200
export const MARKDOWN_MAX_MARKERS = 100
export const MARKDOWN_MAX_DEPTH = 8
/** Columns of indentation a line may open with (a tab runs to the next 4). */
export const MARKDOWN_MAX_INDENT = 32

/**
 * Something Markdown would change: emphasis, code, a link or image, or a
 * list, quote or heading marker opening a line. Anchored and bounded, so the
 * test is linear on any text.
 */
const MARKDOWN_SIGNS =
  /[*_`[]|^[ \t]{0,3}(?:[-+][ \t]|\d{1,9}[.)][ \t]|#{1,6}[ \t]|>)/m

const isBlank = (char: string | undefined) => char === ' ' || char === '\t'

// What may follow a list marker: a blank, or the line's end (an empty item,
// which opens its level all the same).
const endsMarker = (char: string | undefined) =>
  char === undefined || isBlank(char)

const isDigit = (char: string | undefined) =>
  char !== undefined && char >= '0' && char <= '9'

/** How many quote and list levels a line opens before its text. */
export const containerDepth = (line: string): number => {
  let depth = 0
  let at = 0
  for (;;) {
    while (isBlank(line[at])) at += 1
    const char = line[at]
    if (char === '>') {
      depth += 1
      at += 1
      continue
    }
    if (
      (char === '-' || char === '*' || char === '+') &&
      endsMarker(line[at + 1])
    ) {
      depth += 1
      at += 2
      continue
    }
    let end = at
    while (end < at + 9 && isDigit(line[end])) end += 1
    if (
      end > at &&
      (line[end] === '.' || line[end] === ')') &&
      endsMarker(line[end + 1])
    ) {
      depth += 1
      at = end + 2
      continue
    }
    return depth
  }
}

/** How many of the characters that open emphasis, code or links. */
const countSigns = (text: string): number => {
  let count = 0
  for (const char of text)
    if (char === '*' || char === '_' || char === '`' || char === '[') count += 1
  return count
}

/** The columns a line's leading blanks take (a tab runs to the next 4). */
export const indentOf = (line: string): number => {
  let columns = 0
  for (const char of line)
    if (char === ' ') columns += 1
    else if (char === '\t') columns += 4 - (columns % 4)
    else break
  return columns
}

export const rendersAsMarkdown = (text: string): boolean => {
  if (text.length > MARKDOWN_MAX_LENGTH || !MARKDOWN_SIGNS.test(text))
    return false
  const lines = text.split(/\r\n|\r|\n/)
  if (
    lines.length > MARKDOWN_MAX_LINES ||
    countSigns(text) > MARKDOWN_MAX_SIGNS
  )
    return false
  let markers = 0
  for (const line of lines) {
    const depth = containerDepth(line)
    markers += depth
    if (
      depth > MARKDOWN_MAX_DEPTH ||
      markers > MARKDOWN_MAX_MARKERS ||
      indentOf(line) > MARKDOWN_MAX_INDENT
    )
      return false
  }
  return true
}
