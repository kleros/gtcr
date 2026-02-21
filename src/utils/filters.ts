import qs from 'qs'
import { CONTRACT_STATUS } from './item-status'

export const FILTER_KEYS = {
  ABSENT: 'absent',
  REGISTERED: 'registered',
  SUBMITTED: 'submitted',
  REMOVAL_REQUESTED: 'removalRequested',
  CHALLENGED_SUBMISSIONS: 'challengedSubmissions',
  CHALLENGED_REMOVALS: 'challengedRemovals',
  OLDEST_FIRST: 'oldestFirst',
  PAGE: 'page'
}

/** @deprecated Use FILTER_KEYS instead */
export const LIGHT_FILTER_KEYS = FILTER_KEYS

export const filterLabelLight = {
  [FILTER_KEYS.ABSENT]: 'Rejected/Removed',
  [FILTER_KEYS.REGISTERED]: 'Registered',
  [FILTER_KEYS.SUBMITTED]: 'Submitted',
  [FILTER_KEYS.REMOVAL_REQUESTED]: 'Removing',
  [FILTER_KEYS.CHALLENGED_SUBMISSIONS]: 'Challenged Submissions',
  [FILTER_KEYS.CHALLENGED_REMOVALS]: 'Challenged Removals',
  [FILTER_KEYS.MY_SUBMISSIONS]: 'My Submissions',
  [FILTER_KEYS.MY_CHALLENGES]: 'My Challenges',
  [FILTER_KEYS.OLDEST_FIRST]: 'Oldest First'
}

export const filterFunctions: Record<string, (account?: string) => (item: SubgraphItem) => boolean> = {
  [FILTER_KEYS.ABSENT]: () => (item: SubgraphItem) => item.status !== 'Absent',
  [FILTER_KEYS.REGISTERED]: () => (item: SubgraphItem) => item.status !== 'Registered',
  [FILTER_KEYS.SUBMITTED]: () => (item: SubgraphItem) =>
    item.status !== 'RegistrationRequested' || item.disputed,
  [FILTER_KEYS.REMOVAL_REQUESTED]: () => (item: SubgraphItem) =>
    item.status !== 'ClearingRequested' || item.disputed,
  [FILTER_KEYS.CHALLENGED_SUBMISSIONS]: () => (item: SubgraphItem) =>
    item.status !== 'RegistrationRequested' || !item.disputed,
  [FILTER_KEYS.CHALLENGED_REMOVALS]: () => (item: SubgraphItem) =>
    item.status !== 'ClearingRequested' || !item.disputed,
  [FILTER_KEYS.MY_SUBMISSIONS]: (account?: string) => (item: SubgraphItem) =>
    !item.requests?.some(
      (request: SubgraphRequest) => request.requester?.toLowerCase() === account
    ),
  [FILTER_KEYS.MY_CHALLENGES]: (account?: string) => (item: SubgraphItem) =>
    !item.requests?.some(
      (request: SubgraphRequest) => request.challenger?.toLowerCase() === account
    )
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
  [FILTER_KEYS.PAGE]: '1'
}

/** @deprecated Use DEFAULT_FILTERS instead */
export const DEFAULT_FILTERS_LIGHT = DEFAULT_FILTERS

export const P_FILTER_KEYS = {
  ABSENT: 'absent',
  REGISTERED: 'registered',
  DISPUTED: 'disputed',
  OLDEST_FIRST: 'oldestFirst',
  PAGE: 'page'
}

export const filterLabelPermanent = {
  [P_FILTER_KEYS.ABSENT]: 'Rejected/Removed',
  [P_FILTER_KEYS.REGISTERED]: 'Registered',
  [P_FILTER_KEYS.DISPUTED]: 'Disputed',
  [P_FILTER_KEYS.OLDEST_FIRST]: 'Oldest First'
}

export const DEFAULT_FILTERS_PERMANENT = {
  [P_FILTER_KEYS.ABSENT]: false,
  [P_FILTER_KEYS.REGISTERED]: false,
  [P_FILTER_KEYS.DISPUTED]: false,
  [FILTER_KEYS.OLDEST_FIRST]: false,
  [FILTER_KEYS.PAGE]: '1'
}

/**
 * Parse a query string into a filter object, applying defaults and type coercion.
 * @param {string} search - The query string (with or without leading '?')
 * @param {object} defaults - Default filter values
 * @param {string} pageKey - The key used for the page filter
 * @returns {object} Parsed filter values
 */
const parseSearchToFilters = (search: string, defaults: Record<string, string | boolean>, pageKey: string): Record<string, string | boolean> => {
  const queryObj = qs.parse(search.replace(/\?/g, ''))
  return {
    ...defaults,
    ...Object.keys(queryObj)
      .map(key =>
        queryObj[key] == null
          ? { key, value: defaults[key] }
          : {
              key,
              value:
                key === pageKey
                  ? queryObj[pageKey]
                  : queryObj[key].toString() === 'true'
            }
      )
      .reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
  }
}

export const searchStrToFilterObjLight = (search: string): Record<string, string | boolean> => {
  const filters = parseSearchToFilters(search, DEFAULT_FILTERS, FILTER_KEYS.PAGE)
  const {
    registered, submitted, removalRequested,
    challengedSubmissions, challengedRemovals,
    mySubmissions, myChallenges, absent, oldestFirst, page
  } = filters

  let countField = 'all'
  if (registered) countField = 'numberOfRegistered'
  else if (absent) countField = 'numberOfAbsent'
  else if (submitted) countField = 'numberOfRegistrationRequested'
  else if (removalRequested) countField = 'numberOfClearingRequested'
  else if (challengedSubmissions) countField = 'numberOfChallengedRegistrations'
  else if (challengedRemovals) countField = 'numberOfChallengedClearing'

  return {
    registered, submitted, removalRequested,
    challengedSubmissions, challengedRemovals,
    mySubmissions, myChallenges, absent,
    oldestFirst, page, countField
  }
}

export const searchStrToFilterObjPermanent = (search: string): Record<string, string | boolean> => {
  const filters = parseSearchToFilters(search, DEFAULT_FILTERS_PERMANENT, P_FILTER_KEYS.PAGE)
  const { absent, registered, disputed, oldestFirst, page } = filters

  let countField = 'all'
  if (registered) countField = 'numberOfSubmitted'
  else if (absent) countField = 'numberOfAbsent'
  else if (disputed) countField = 'numberOfDisputed'

  return { registered, disputed, absent, oldestFirst, page, countField }
}

export const queryOptionsToFilterArray = (queryOptions: Record<string, boolean | string>, account?: string): (boolean | string | undefined)[] => {
  const filterObj: Record<string, boolean | string> = {}
  Object.keys(queryOptions)
    .filter(key => key !== FILTER_KEYS.PAGE && key !== FILTER_KEYS.OLDEST_FIRST)
    .forEach(key => {
      filterObj[key] = queryOptions[key]
    })

  const {
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
    mySubmissions,
    myChallenges,
    absent
  } = filterObj

  return [
    absent,
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
    account && mySubmissions,
    account && myChallenges
  ]
}

export const updateLightFilter = ({ prevQuery: search, filter, checked }: { prevQuery: string; filter: string; checked: boolean }): string => {
  const queryObj: Record<string, string | boolean> = qs.parse(search.replace(/\?/g, '')) as Record<string, string | boolean>

  // Toggle the filter (multi-select supported)
  if (checked) queryObj[filter] = true
  else delete queryObj[filter]

  // Reset to page 1 when filters change
  queryObj[FILTER_KEYS.PAGE] = '1'

  return qs.stringify(queryObj, { addPrefix: true })
}

export const applyOldActiveItemsFilter = (
  { submitted, removalRequested, challengedSubmissions, challengedRemovals }: { submitted: boolean; removalRequested: boolean; challengedSubmissions: boolean; challengedRemovals: boolean },
  { status, disputed }: { status: string; disputed: boolean }
): boolean => {
  switch (status) {
    case CONTRACT_STATUS.ABSENT:
    case CONTRACT_STATUS.REGISTERED:
      return false
    case CONTRACT_STATUS.REGISTRATION_REQUESTED: {
      if (disputed) {
        if (challengedSubmissions) return true
      } else if (submitted) return true
      return false
    }
    case CONTRACT_STATUS.REMOVAL_REQUESTED: {
      if (disputed) {
        if (challengedRemovals) return true
      } else if (removalRequested) return true
      return false
    }
    default:
      throw new Error('Unsupported item status')
  }
}
