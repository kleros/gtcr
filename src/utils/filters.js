import qs from 'qs'
import { CONTRACT_STATUS } from './item-status'

export const LIGHT_FILTER_KEYS = {
  ABSENT: 'absent',
  REGISTERED: 'registered',
  SUBMITTED: 'submitted',
  REMOVAL_REQUESTED: 'removalRequested',
  CHALLENGED_SUBMISSIONS: 'challengedSubmissions',
  CHALLENGED_REMOVALS: 'challengedRemovals',
  OLDEST_FIRST: 'oldestFirst',
  PAGE: 'page'
}

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

export const filterLabelLight = {
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

export const filterFunctions = {
  [FILTER_KEYS.ABSENT]: () => item => item.status !== 'Absent',
  [FILTER_KEYS.REGISTERED]: () => item => item.status !== 'Registered',
  [FILTER_KEYS.SUBMITTED]: () => item =>
    item.status !== 'RegistrationRequested' || item.disputed,
  [FILTER_KEYS.REMOVAL_REQUESTED]: () => item =>
    item.status !== 'ClearingRequested' || item.disputed,
  [FILTER_KEYS.CHALLENGED_SUBMISSIONS]: () => item =>
    item.status !== 'RegistrationRequested' || !item.disputed,
  [FILTER_KEYS.CHALLENGED_REMOVALS]: () => item =>
    item.status !== 'ClearingRequested' || !item.disputed,
  [FILTER_KEYS.MY_SUBMISSIONS]: account => item =>
    !item.requests.some(
      request => request.requester?.toLowerCase() === account
    ),
  [FILTER_KEYS.MY_CHALLENGES]: account => item =>
    !item.requests.some(
      request => request.challenger?.toLowerCase() === account
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

export const DEFAULT_FILTERS_LIGHT = {
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

export const P_FILTER_KEYS = {
  ABSENT: 'absent',
  REGISTERED: 'registered',
  DISPUTED: 'disputed',
  OLDEST_FIRST: 'oldestFirst',
  PAGE: 'page'
}

export const filterLabelPermanent = {
  [P_FILTER_KEYS.ABSENT]: 'Removed',
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

export const searchStrToFilterObjLight = search => {
  const queryObj = qs.parse(search.replace(/\?/g, ''))

  // Add default value filters and convert the string "true" and "false" to the boolean types.
  const {
    absent,
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
    mySubmissions,
    myChallenges,
    oldestFirst,
    page
  } = {
    ...DEFAULT_FILTERS_LIGHT,
    ...Object.keys(queryObj)
      .map(key =>
        queryObj[key] == null
          ? { key, value: DEFAULT_FILTERS_LIGHT[key] }
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

  // Must assume there's no multiselect possible.
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
    countField
  }
}

export const searchStrToFilterObjPermanent = search => {
  const queryObj = qs.parse(search.replace(/\?/g, ''))

  // Add default value filters and convert the string "true" and "false" to the boolean types.
  const { absent, registered, disputed, oldestFirst, page } = {
    ...DEFAULT_FILTERS_PERMANENT,
    ...Object.keys(queryObj)
      .map(key =>
        queryObj[key] == null
          ? { key, value: DEFAULT_FILTERS_PERMANENT[key] }
          : {
              key,
              value:
                key === P_FILTER_KEYS.PAGE
                  ? queryObj[P_FILTER_KEYS.PAGE]
                  : queryObj[key].toString() === 'true'
            }
      )
      .reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
  }

  // Must assume there's no multiselect possible.
  // It's NOT possible to track number of included and pending items.
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
    countField
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

export const updateLightFilter = ({ prevQuery: search, filter, checked }) => {
  const queryObj = qs.parse(search.replace(/\?/g, ''))
  // Remove previous filter. Combining states is not yet supported.
  delete queryObj[FILTER_KEYS.ABSENT]
  delete queryObj[FILTER_KEYS.REGISTERED]
  delete queryObj[FILTER_KEYS.SUBMITTED]
  delete queryObj[FILTER_KEYS.REMOVAL_REQUESTED]
  delete queryObj[FILTER_KEYS.CHALLENGED_SUBMISSIONS]
  delete queryObj[FILTER_KEYS.CHALLENGED_REMOVALS]

  // Adding filter
  queryObj[filter] = checked

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
