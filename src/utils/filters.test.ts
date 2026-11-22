import { describe, expect, it } from 'vitest'
import {
  FILTER_KEYS,
  P_FILTER_KEYS,
  searchStrToFilterObjPermanent,
  searchStrToFilterObjStandard,
  selectStatusFilter,
  updateStandardFilter,
} from './filters'

const params = (search: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(search))

/** The status menu of each list page, "Previously disputed" last. */
const STANDARD_MENU = [
  FILTER_KEYS.REGISTERED,
  FILTER_KEYS.SUBMITTED,
  FILTER_KEYS.REMOVAL_REQUESTED,
  FILTER_KEYS.CHALLENGED_SUBMISSIONS,
  FILTER_KEYS.CHALLENGED_REMOVALS,
  FILTER_KEYS.ABSENT,
  FILTER_KEYS.DISPUTED_BEFORE,
]
const STAKE_MENU = [
  P_FILTER_KEYS.REGISTERED,
  P_FILTER_KEYS.DISPUTED,
  P_FILTER_KEYS.ABSENT,
  P_FILTER_KEYS.DISPUTED_BEFORE,
]

describe('searchStrToFilterObjStandard', () => {
  it('starts with every filter off on the first page', () => {
    expect(searchStrToFilterObjStandard('')).toEqual({
      registered: false,
      submitted: false,
      removalRequested: false,
      challengedSubmissions: false,
      challengedRemovals: false,
      mySubmissions: false,
      myChallenges: false,
      absent: false,
      oldestFirst: false,
      page: '1',
      countField: 'all',
      disputedBefore: false,
    })
  })

  it('reads a filter as on only when its value is "true"', () => {
    expect(searchStrToFilterObjStandard('?registered=true').registered).toBe(
      true,
    )
    expect(searchStrToFilterObjStandard('registered=true').registered).toBe(
      true,
    )
    for (const value of ['false', '1', 'TRUE', 'yes', ''])
      expect(
        searchStrToFilterObjStandard(`?registered=${value}`).registered,
      ).toBe(false)
    expect(searchStrToFilterObjStandard('?registered').registered).toBe(false)
  })

  it('reads every filter of a link together, the page as written', () => {
    expect(
      searchStrToFilterObjStandard(
        '?challengedRemovals=true&oldestFirst=true&disputedBefore=true&mySubmissions=true&page=4',
      ),
    ).toMatchObject({
      challengedRemovals: true,
      oldestFirst: true,
      disputedBefore: true,
      mySubmissions: true,
      myChallenges: false,
      registered: false,
      page: '4',
    })
    expect(searchStrToFilterObjStandard('?page=abc').page).toBe('abc')
  })

  it('leaves out parameters that are not filters', () => {
    const filters = searchStrToFilterObjStandard(
      '?q=kleros&chain=100&registered=true',
    )
    expect(filters).not.toHaveProperty('q')
    expect(filters).not.toHaveProperty('chain')
    expect(filters.registered).toBe(true)
  })

  it.each([
    ['registered', 'numberOfRegistered'],
    ['absent', 'numberOfAbsent'],
    ['submitted', 'numberOfRegistrationRequested'],
    ['removalRequested', 'numberOfClearingRequested'],
    ['challengedSubmissions', 'numberOfChallengedRegistrations'],
    ['challengedRemovals', 'numberOfChallengedClearing'],
    ['mySubmissions', 'all'],
    ['myChallenges', 'all'],
    ['disputedBefore', 'all'],
    ['oldestFirst', 'all'],
  ])('counts with %s on from %s', (key, countField) => {
    expect(searchStrToFilterObjStandard(`?${key}=true`).countField).toBe(
      countField,
    )
  })

  it('counts from the first status in order when an old link has several', () => {
    expect(
      searchStrToFilterObjStandard('?absent=true&registered=true').countField,
    ).toBe('numberOfRegistered')
    expect(
      searchStrToFilterObjStandard('?challengedRemovals=true&submitted=true')
        .countField,
    ).toBe('numberOfRegistrationRequested')
  })
})

describe('searchStrToFilterObjPermanent', () => {
  it('starts with every filter off on the first page', () => {
    expect(searchStrToFilterObjPermanent('')).toEqual({
      registered: false,
      disputed: false,
      absent: false,
      oldestFirst: false,
      page: '1',
      countField: 'all',
      disputedBefore: false,
    })
  })

  it('reads the Stake filters and drops the Standard-only ones', () => {
    const filters = searchStrToFilterObjPermanent(
      '?disputed=true&submitted=true&challengedSubmissions=true&page=2',
    )
    expect(filters).toMatchObject({ disputed: true, page: '2' })
    expect(filters).not.toHaveProperty('submitted')
    expect(filters).not.toHaveProperty('challengedSubmissions')
  })

  it.each([
    ['registered', 'numberOfSubmitted'],
    ['absent', 'numberOfAbsent'],
    ['disputed', 'numberOfDisputed'],
    ['disputedBefore', 'all'],
  ])('counts with %s on from %s', (key, countField) => {
    expect(searchStrToFilterObjPermanent(`?${key}=true`).countField).toBe(
      countField,
    )
  })

  it('counts from the first status in order when an old link has several', () => {
    expect(
      searchStrToFilterObjPermanent(
        '?disputed=true&absent=true&registered=true',
      ).countField,
    ).toBe('numberOfSubmitted')
    expect(
      searchStrToFilterObjPermanent('?disputed=true&absent=true').countField,
    ).toBe('numberOfAbsent')
  })
})

describe('selectStatusFilter', () => {
  it('puts the chosen status alone in the link, back on the first page', () => {
    const search = selectStatusFilter({
      prevQuery: '?registered=true&absent=true&disputedBefore=true&page=3',
      keys: STANDARD_MENU,
      value: FILTER_KEYS.SUBMITTED,
    })
    expect(search.startsWith('?')).toBe(true)
    expect(params(search)).toEqual({ submitted: 'true', page: '1' })
  })

  it('clears every status for "all"', () => {
    expect(
      params(
        selectStatusFilter({
          prevQuery:
            '?registered=true&challengedRemovals=true&disputedBefore=true&page=2',
          keys: STANDARD_MENU,
          value: 'all',
        }),
      ),
    ).toEqual({ page: '1' })
  })

  it('keeps the search, the sort and anything the menu does not offer', () => {
    expect(
      params(
        selectStatusFilter({
          prevQuery:
            '?q=kleros&oldestFirst=true&mySubmissions=true&absent=true',
          keys: STANDARD_MENU,
          value: FILTER_KEYS.REGISTERED,
        }),
      ),
    ).toEqual({
      q: 'kleros',
      oldestFirst: 'true',
      mySubmissions: 'true',
      registered: 'true',
      page: '1',
    })
  })

  it('builds a link from an empty query', () => {
    expect(
      selectStatusFilter({
        prevQuery: '',
        keys: STANDARD_MENU,
        value: FILTER_KEYS.SUBMITTED,
      }),
    ).toBe('?submitted=true&page=1')
    expect(
      selectStatusFilter({ prevQuery: '', keys: STANDARD_MENU, value: 'all' }),
    ).toBe('?page=1')
  })

  it('narrows an old Stake link with several statuses to the one shown', () => {
    const search = selectStatusFilter({
      prevQuery: '?registered=true&disputed=true&oldestFirst=true&page=5',
      keys: STAKE_MENU,
      value: P_FILTER_KEYS.REGISTERED,
    })
    expect(searchStrToFilterObjPermanent(search)).toMatchObject({
      registered: true,
      disputed: false,
      absent: false,
      disputedBefore: false,
      oldestFirst: true,
      page: '1',
    })
  })
})

describe('updateStandardFilter', () => {
  it('turns a filter on next to the others, back on the first page', () => {
    expect(
      params(
        updateStandardFilter({
          prevQuery: '?registered=true&page=4',
          filter: 'absent',
          checked: true,
        }),
      ),
    ).toEqual({ registered: 'true', absent: 'true', page: '1' })
  })

  it('turns a filter off and leaves the others', () => {
    expect(
      params(
        updateStandardFilter({
          prevQuery: '?registered=true&absent=true&page=2',
          filter: 'absent',
          checked: false,
        }),
      ),
    ).toEqual({ registered: 'true', page: '1' })
  })

  it('writes a link the list reads back', () => {
    const search = updateStandardFilter({
      prevQuery: '?q=kleros&page=7',
      filter: FILTER_KEYS.OLDEST_FIRST,
      checked: true,
    })
    expect(search.startsWith('?')).toBe(true)
    expect(searchStrToFilterObjStandard(search)).toMatchObject({
      oldestFirst: true,
      page: '1',
    })
    expect(
      searchStrToFilterObjPermanent(
        updateStandardFilter({
          prevQuery: search,
          filter: P_FILTER_KEYS.DISPUTED,
          checked: true,
        }),
      ),
    ).toMatchObject({ disputed: true, oldestFirst: true, page: '1' })
  })
})
