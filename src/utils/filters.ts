export const FILTER_KEYS = {
  ABSENT: 'absent',
  REGISTERED: 'registered',
  SUBMITTED: 'submitted',
  REMOVAL_REQUESTED: 'removalRequested',
  CHALLENGED_SUBMISSIONS: 'challengedSubmissions',
  CHALLENGED_REMOVALS: 'challengedRemovals',
  MY_SUBMISSIONS: 'mySubmissions',
  MY_CHALLENGES: 'myChallenges',
  OLDEST_FIRST: 'oldestFirst',
  PAGE: 'page',
  /** Every entry that has been to court at least once, whatever it is now. */
  DISPUTED_BEFORE: 'disputedBefore',
}

export const DEFAULT_FILTERS = {
  [FILTER_KEYS.ABSENT]: false,
  [FILTER_KEYS.REGISTERED]: false,
  [FILTER_KEYS.SUBMITTED]: false,
  [FILTER_KEYS.REMOVAL_REQUESTED]: false,
  [FILTER_KEYS.CHALLENGED_SUBMISSIONS]: false,
  [FILTER_KEYS.CHALLENGED_REMOVALS]: false,
  [FILTER_KEYS.MY_SUBMISSIONS]: false,
  [FILTER_KEYS.MY_CHALLENGES]: false,
  [FILTER_KEYS.OLDEST_FIRST]: false,
  [FILTER_KEYS.PAGE]: '1',
  [FILTER_KEYS.DISPUTED_BEFORE]: false,
}

export const P_FILTER_KEYS = {
  ABSENT: 'absent',
  REGISTERED: 'registered',
  DISPUTED: 'disputed',
  OLDEST_FIRST: 'oldestFirst',
  PAGE: 'page',
  /** Every entry that has been challenged at least once, whatever it is now. */
  DISPUTED_BEFORE: 'disputedBefore',
}

export const DEFAULT_FILTERS_PERMANENT = {
  [P_FILTER_KEYS.ABSENT]: false,
  [P_FILTER_KEYS.REGISTERED]: false,
  [P_FILTER_KEYS.DISPUTED]: false,
  [FILTER_KEYS.OLDEST_FIRST]: false,
  [FILTER_KEYS.PAGE]: '1',
  [P_FILTER_KEYS.DISPUTED_BEFORE]: false,
}

/**
 * Parse a query string into a filter object, applying defaults and type coercion.
 * @param {string} search - The query string (with or without leading '?')
 * @param {object} defaults - Default filter values
 * @param {string} pageKey - The key used for the page filter
 * @returns {object} Parsed filter values
 */
const parseSearchToFilters = (
  search: string,
  defaults: Record<string, string | boolean>,
  pageKey: string,
): Record<string, string | boolean> => {
  const params = new URLSearchParams(search)
  const parsed: Record<string, string | boolean> = {}
  params.forEach((value, key) => {
    parsed[key] = key === pageKey ? value : value === 'true'
  })
  return { ...defaults, ...parsed }
}

export const searchStrToFilterObjStandard = (
  search: string,
): Record<string, string | boolean> => {
  const filters = parseSearchToFilters(
    search,
    DEFAULT_FILTERS,
    FILTER_KEYS.PAGE,
  )
  const {
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
    mySubmissions,
    myChallenges,
    absent,
    oldestFirst,
    page,
    disputedBefore,
  } = filters

  let countField = 'all'
  if (registered) countField = 'numberOfRegistered'
  else if (absent) countField = 'numberOfAbsent'
  else if (submitted) countField = 'numberOfRegistrationRequested'
  else if (removalRequested) countField = 'numberOfClearingRequested'
  else if (challengedSubmissions) countField = 'numberOfChallengedRegistrations'
  else if (challengedRemovals) countField = 'numberOfChallengedClearing'

  return {
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
    mySubmissions,
    myChallenges,
    absent,
    oldestFirst,
    page,
    countField,
    disputedBefore,
  }
}

export const searchStrToFilterObjPermanent = (
  search: string,
): Record<string, string | boolean> => {
  const filters = parseSearchToFilters(
    search,
    DEFAULT_FILTERS_PERMANENT,
    P_FILTER_KEYS.PAGE,
  )
  const { absent, registered, disputed, oldestFirst, page, disputedBefore } =
    filters

  let countField = 'all'
  if (registered) countField = 'numberOfSubmitted'
  else if (absent) countField = 'numberOfAbsent'
  else if (disputed) countField = 'numberOfDisputed'

  return {
    registered,
    disputed,
    absent,
    oldestFirst,
    page,
    countField,
    disputedBefore,
  }
}

export const updateStandardFilter = ({
  prevQuery: search,
  filter,
  checked,
}: {
  prevQuery: string
  filter: string
  checked: boolean
}): string => {
  const params = new URLSearchParams(search)

  // Toggle the filter (multi-select supported)
  if (checked) params.set(filter, 'true')
  else params.delete(filter)

  // Reset to page 1 when filters change
  params.set(FILTER_KEYS.PAGE, '1')

  return `?${params.toString()}`
}

/**
 * The list page's one status choice (round 6: a dropdown, "All" first): the
 * chosen key alone in the URL, every other status key cleared, back to the
 * first page. "all" clears them all.
 */
export const selectStatusFilter = ({
  prevQuery: search,
  keys,
  value,
}: {
  prevQuery: string
  /** Every status key the page's menu offers. */
  keys: string[]
  value: string
}): string => {
  const params = new URLSearchParams(search)
  for (const key of keys) params.delete(key)
  if (value !== 'all') params.set(value, 'true')
  params.set(FILTER_KEYS.PAGE, '1')
  return `?${params.toString()}`
}
