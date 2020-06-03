import qs from 'qs'
import { CONTRACT_STATUS } from './item-status'

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
  PAGE: 'page'
}

export const filterLabel = {
  [FILTER_KEYS.ABSENT]: 'Rejected',
  [FILTER_KEYS.REGISTERED]: 'Registered',
  [FILTER_KEYS.SUBMITTED]: 'Submitted',
  [FILTER_KEYS.REMOVAL_REQUESTED]: 'Removing',
  [FILTER_KEYS.CHALLENGED_SUBMISSIONS]: 'Challenged Submissions',
  [FILTER_KEYS.CHALLENGED_REMOVALS]: 'Challenged Removals',
  [FILTER_KEYS.MY_SUBMISSIONS]: 'My Submissions',
  [FILTER_KEYS.MY_CHALLENGES]: 'My Challenges',
  [FILTER_KEYS.OLDEST_FIRST]: 'Oldest First'
}

export const DEFAULT_FILTERS = {
  [FILTER_KEYS.ABSENT]: false,
  [FILTER_KEYS.REGISTERED]: true,
  [FILTER_KEYS.SUBMITTED]: true,
  [FILTER_KEYS.REMOVAL_REQUESTED]: true,
  [FILTER_KEYS.CHALLENGED_SUBMISSIONS]: false,
  [FILTER_KEYS.CHALLENGED_REMOVALS]: false,
  [FILTER_KEYS.MY_SUBMISSIONS]: true,
  [FILTER_KEYS.MY_CHALLENGES]: true,
  [FILTER_KEYS.OLDEST_FIRST]: false,
  [FILTER_KEYS.PAGE]: '1'
}

export const searchStrToFilterObj = search => {
  const queryObj = qs.parse(search.replace(/\?/g, ''))

  // Add default value filters and convert the string "true" and "false" to the boolean types.
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
    page
  } = {
    ...DEFAULT_FILTERS,
    ...Object.keys(queryObj)
      .map(key =>
        queryObj[key] == null
          ? { key, value: DEFAULT_FILTERS[key] }
          : {
              key,
              value:
                key === FILTER_KEYS.PAGE
                  ? queryObj[FILTER_KEYS.PAGE]
                  : queryObj[key].toString() === 'true'
            }
      )
      .reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
  }

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
    page
  }
}

export const queryOptionsToFilterArray = (queryOptions, account) => {
  const filterObj = {}
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

export const updateFilter = ({ prevQuery: search, filter, checked }) => {
  const queryObj = qs.parse(search.replace(/\?/g, ''))
  // Adding filter
  if (queryObj[filter] == null) queryObj[filter] = checked
  else delete queryObj[filter] // Removing filter.

  return qs.stringify(queryObj, { addPrefix: true })
}

export const applyOldActiveItemsFilter = (
  { submitted, removalRequested, challengedSubmissions, challengedRemovals },
  { status, disputed }
) => {
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
