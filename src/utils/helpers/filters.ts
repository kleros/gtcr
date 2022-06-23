import qs, { ParsedQs } from 'qs'
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
  [FILTER_KEYS.OLDEST_FIRST]: 'Oldest First'
}

export const DEFAULT_FILTERS_LIGHT = {
  [FILTER_KEYS.ABSENT]: false,
  [FILTER_KEYS.REGISTERED]: false,
  [FILTER_KEYS.SUBMITTED]: false,
  [FILTER_KEYS.REMOVAL_REQUESTED]: false,
  [FILTER_KEYS.CHALLENGED_SUBMISSIONS]: false,
  [FILTER_KEYS.CHALLENGED_REMOVALS]: false,
  [FILTER_KEYS.OLDEST_FIRST]: false,
  [FILTER_KEYS.PAGE]: '1'
}

export const searchStrToFilterObjLight = (
  search: string
): { [key: string]: boolean | string } => {
  const queryObj: ParsedQs = qs.parse(search.replace(/\?/g, ''))

  // Add default value filters and convert the string "true" and "false" to the boolean types.
  return {
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
                  : queryObj?.[key]?.toString() === 'true'
            }
      )
      .reduce<{ [key: string]: boolean | string }>(
        (acc, curr) => ({ ...acc, [curr.key]: curr.value as string }),
        {}
      )
  }
}

export const queryOptionsToFilterArray = (queryOptions: any, account: any) => {
  const filterObj: ParsedQs = {}
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

export const updateLightFilter = ({
  prevQuery: search,
  filter,
  checked
}: {
  prevQuery: string
  filter: string
  checked: boolean
}) => {
  const queryObj: ParsedQs = qs.parse(search.replace(/\?/g, ''))
  // Remove previous filter. Combining states is not yet supported.
  delete queryObj[FILTER_KEYS.ABSENT]
  delete queryObj[FILTER_KEYS.REGISTERED]
  delete queryObj[FILTER_KEYS.SUBMITTED]
  delete queryObj[FILTER_KEYS.REMOVAL_REQUESTED]
  delete queryObj[FILTER_KEYS.CHALLENGED_SUBMISSIONS]
  delete queryObj[FILTER_KEYS.CHALLENGED_REMOVALS]

  // Adding filter
  queryObj[filter] = checked.toString()

  return qs.stringify(queryObj, { addQueryPrefix: true })
}

export const applyOldActiveItemsFilter = (
  {
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals
  }: { [key: string]: boolean },
  { status, disputed }: { status: number; disputed: boolean }
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
