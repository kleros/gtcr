import { describe, expect, it } from 'vitest'
import { listSearchFrom, withListSearch } from './registry-shared-search'

describe('listSearchFrom', () => {
  it.each([
    ['?q=kleros', 'kleros'],
    ['?registered=true&q=Kleros%20Tokens', 'Kleros Tokens'],
    ['?q=a+b', 'a b'],
    ['?q=', ''],
    ['?page=2', ''],
    ['', ''],
  ])('%j searches %j', (search, term) => {
    expect(listSearchFrom(search)).toBe(term)
  })
})

describe('withListSearch', () => {
  it('starts a new search over the whole list from its first page', () => {
    expect(withListSearch('?registered=true&page=3', 'kleros')).toBe(
      '?registered=true&q=kleros',
    )
  })

  it('stays on the page when the search only filters the page on screen', () => {
    expect(
      withListSearch('?registered=true&page=3', 'kleros', { keepPage: true }),
    ).toBe('?registered=true&page=3&q=kleros')
  })

  it('replaces an earlier search', () => {
    expect(withListSearch('?q=old&oldestFirst=true', 'new')).toBe(
      '?q=new&oldestFirst=true',
    )
  })

  it('drops the search when it is cleared', () => {
    expect(withListSearch('?q=old&registered=true&page=2', '')).toBe(
      '?registered=true',
    )
  })

  it('encodes the term, and reads it back the same', () => {
    const search = withListSearch('', 'Kleros & co?')
    expect(listSearchFrom(search)).toBe('Kleros & co?')
    expect(new URLSearchParams(search).getAll('q')).toEqual(['Kleros & co?'])
  })

  it('leaves no parameters when there is nothing to keep', () => {
    expect(new URLSearchParams(withListSearch('?page=2', '')).toString()).toBe(
      '',
    )
  })
})
