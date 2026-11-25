import { describe, expect, it } from 'vitest'
import {
  linkValueParams,
  readActionLink,
  submitPathFor,
} from './registry-shared-action-link'

const LIST = '0x1111111111111111111111111111111111111111'

describe('linkValueParams', () => {
  it('reads the values in column order, whatever their keys', () => {
    expect(
      linkValueParams('?action=submit&name=Kleros&symbol=PNK&b=3'),
    ).toEqual([
      ['name', 'Kleros'],
      ['symbol', 'PNK'],
      ['b', '3'],
    ])
  })

  it('reads a query string without its question mark', () => {
    expect(linkValueParams('name=Kleros')).toEqual([['name', 'Kleros']])
  })

  it('decodes values', () => {
    expect(
      linkValueParams(
        '?action=1&name=Hello%20World&sym=%26&plus=a+b&addr=0x12%2C34',
      ),
    ).toEqual([
      ['name', 'Hello World'],
      ['sym', '&'],
      ['plus', 'a b'],
      ['addr', '0x12,34'],
    ])
  })

  it('keeps a repeated key as two values', () => {
    expect(linkValueParams('?action=1&v=first&v=second')).toEqual([
      ['v', 'first'],
      ['v', 'second'],
    ])
  })

  it.each([
    'action',
    'cv-theme',
    'attachment',
    'isPolicy',
    'policyTx',
    'utm_source',
    'UTM_Campaign',
    'fbclid',
    'gclid',
  ])('never reads %s as a value, wherever it is', (key) => {
    expect(
      linkValueParams(`?${key}=x&name=Kleros&${key}=y&symbol=PNK`),
    ).toEqual([
      ['name', 'Kleros'],
      ['symbol', 'PNK'],
    ])
  })

  it('drops the list’s own state added after the values', () => {
    expect(
      linkValueParams(
        '?action=1&name=Kleros&page=2&q=token&registered=true&oldestFirst=true&disputed=true',
      ),
    ).toEqual([['name', 'Kleros']])
  })

  it('reads a key named like the list’s state as a value between two values', () => {
    // A column keyed "page": the values after it keep their columns.
    expect(
      linkValueParams('?action=1&name=Kleros&page=Home&symbol=PNK&page=3'),
    ).toEqual([
      ['name', 'Kleros'],
      ['page', 'Home'],
      ['symbol', 'PNK'],
    ])
  })

  it('reads nothing from a link of list state only', () => {
    expect(linkValueParams('?action=1&page=2&q=x')).toEqual([])
    expect(linkValueParams('')).toEqual([])
  })
})

describe('readActionLink', () => {
  it('is undefined for a URL that is not an ?action= link', () => {
    expect(readActionLink('?name=Kleros')).toBeUndefined()
    expect(readActionLink('?action=&name=Kleros')).toBeUndefined()
    expect(readActionLink('')).toBeUndefined()
  })

  it('carries the values and the theme to the submit page', () => {
    expect(
      readActionLink(
        '?action=submit&cv-theme=dark&name=Kleros&utm_source=x&page=2',
      ),
    ).toEqual({
      values: ['Kleros'],
      query: 'name=Kleros&cv-theme=dark',
    })
  })

  it('keeps values that need encoding intact', () => {
    const link = readActionLink(
      '?action=1&name=Hello%20World&url=https%3A%2F%2Fkleros.io%2F%3Fa%3D1',
    )
    expect(link?.values).toEqual(['Hello World', 'https://kleros.io/?a=1'])
    // What the submit page reads back from the query is what the link held.
    expect(
      linkValueParams(`?${link?.query}`).map(([, value]) => value),
    ).toEqual(link?.values)
  })

  it('reads a link with no values', () => {
    expect(readActionLink('?action=submit')).toEqual({ values: [], query: '' })
  })
})

describe('submitPathFor', () => {
  it('opens the full-page submit form', () => {
    expect(submitPathFor(100, LIST)).toBe(`/tcr/100/${LIST}/submit`)
    expect(submitPathFor('1', LIST, { values: [], query: '' })).toBe(
      `/tcr/1/${LIST}/submit`,
    )
  })

  it('carries the link’s values', () => {
    const link = readActionLink('?action=1&name=Kleros&symbol=PNK')
    expect(submitPathFor(100, LIST, link)).toBe(
      `/tcr/100/${LIST}/submit?name=Kleros&symbol=PNK`,
    )
  })
})
