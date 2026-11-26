import { describe, expect, it } from 'vitest'
import {
  MAX_TITLE_LENGTH,
  rulingChoiceOf,
  rulingTitle,
  rulingTitlesOf,
} from './ruling-titles'

const file = (titles: unknown) => ({ rulingOptions: { titles } })

describe('rulingTitlesOf', () => {
  it('reads the titles in choice order', () => {
    expect(rulingTitlesOf(file(['Yes, Add It', "No, Don't Add It"]))).toEqual([
      'Yes, Add It',
      "No, Don't Add It",
    ])
  })

  it.each([
    ['no file', undefined],
    ['a file that is not an object', 'Yes, Add It'],
    ['no ruling options', { title: 'Add a token' }],
    ['titles that are not a list', file('Yes, Add It')],
    ['one title', file(['Yes, Add It'])],
    ['a title that is not text', file([{ toString: 1 }, 'No'])],
    ['an empty title', file(['   ', "No, Don't Add It"])],
    ['the same title twice', file(['Yes', 'yes'])],
  ])('gives none for %s', (_, value) => {
    expect(rulingTitlesOf(value)).toBeUndefined()
  })

  it('keeps one plain line: no control or direction marks, spaces folded', () => {
    expect(
      rulingTitlesOf(file(['Yes,\n  Add\u202E It', 'No\u200B, Don\u0000t'])),
    ).toEqual(['Yes, Add It', 'No, Dont'])
  })

  it('cuts a long title with an ellipsis', () => {
    const long = 'Yes '.repeat(40)
    const [first] = rulingTitlesOf(file([long, 'No']))!
    expect(first.length).toBe(MAX_TITLE_LENGTH)
    expect(first.endsWith('…')).toBe(true)
  })

  it('never cuts a character in half', () => {
    // The cut falls on the emoji, two UTF-16 units long.
    const long = `${'a'.repeat(58)}\u{1F6AB} No, Don't Add It`
    const [first] = rulingTitlesOf(file([long, 'Yes']))!
    expect(first).toBe(`${'a'.repeat(58)}\u{1F6AB}…`)
    expect(first).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })

  it('drops bidirectional and invisible marks', () => {
    expect(
      rulingTitlesOf(file(['Yes\u061C, Add\u00AD It', 'No\u180E, Don\u034Ft'])),
    ).toEqual(['Yes, Add It', 'No, Dont'])
  })

  it('keeps a later choice’s place when its title is unusable', () => {
    expect(rulingTitlesOf(file(['Yes', 'No', 42, 'Maybe']))).toEqual([
      'Yes',
      'No',
      '',
      'Maybe',
    ])
  })
})

describe('rulingTitle', () => {
  const titles = ['Yes, Add It', "No, Don't Add It", '']
  it.each([
    [1, 'Yes, Add It'],
    [2, "No, Don't Add It"],
    [0, undefined],
    [3, undefined],
    [4, undefined],
    [undefined, undefined],
  ])('choice %s reads %j', (choice, title) => {
    expect(rulingTitle(titles, choice)).toBe(title)
  })

  it('gives nothing without titles', () => {
    expect(rulingTitle(undefined, 1)).toBeUndefined()
  })
})

describe('rulingChoiceOf', () => {
  it.each([
    ['Accept', 1],
    ['Reject', 2],
    ['None', undefined],
    [null, undefined],
    [undefined, undefined],
  ])('%s is choice %s', (ruling, choice) => {
    expect(rulingChoiceOf(ruling)).toBe(choice)
  })
})
