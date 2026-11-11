import { FILTER_KEYS, P_FILTER_KEYS } from 'utils/filters'

/*
 * ?action= links: anyone can send people to a list with the values to
 * submit in the URL. The keys are free: values map to columns by position,
 * as they always have, each parameter other than `action` filling the next
 * column. Some parameters are never values: the app-wide theme preview
 * (?cv-theme=, which rides along to the submit page), the policy viewer's
 * parameters and tracking tags. The list's own state (filters, sort, page)
 * is added after a link's values, so it is dropped only there: between two
 * values, a key named like it (a column keyed "page") is a value, and the
 * values after it keep their columns.
 */

const THEME_KEY = 'cv-theme'

// The attachment viewer's parameters (?attachment=…&isPolicy=true).
const VIEWER_KEYS = new Set(['attachment', 'isPolicy', 'policyTx'])

const LIST_STATE_KEYS = new Set<string>([
  ...Object.values(FILTER_KEYS),
  ...Object.values(P_FILTER_KEYS),
])

// Tracking tags that sites and newsletters append are never values either.
const isTrackingKey = (key: string) =>
  /^utm_/i.test(key) || key === 'fbclid' || key === 'gclid'

const isNeverValue = (key: string): boolean =>
  key === 'action' ||
  key === THEME_KEY ||
  VIEWER_KEYS.has(key) ||
  isTrackingKey(key)

/**
 * The parameters of an ?action= link (or of the submit page) that are field
 * values, as [key, value] pairs in column order.
 */
export const linkValueParams = (search: string): [string, string][] => {
  const params = [...new URLSearchParams(search)].filter(
    ([key]) => !isNeverValue(key),
  )
  let end = params.length
  while (end > 0 && LIST_STATE_KEYS.has(params[end - 1][0])) end -= 1
  return params.slice(0, end)
}

export interface ActionLink {
  /** The field values, in the link's order. */
  values: string[]
  /** The query string for the submit page: the values and the theme. */
  query: string
}

/** The link's values, or undefined when the URL is not a ?action= link. */
export const readActionLink = (search: string): ActionLink | undefined => {
  const params = new URLSearchParams(search)
  if (!params.get('action')) return undefined
  const valueParams = linkValueParams(search)
  const rest = new URLSearchParams(valueParams)
  const theme = params.get(THEME_KEY)
  if (theme !== null) rest.append(THEME_KEY, theme)
  return {
    values: valueParams.map(([, value]) => value),
    query: rest.toString(),
  }
}

/** The full-page submit form for a list, carrying the link's values. */
export const submitPathFor = (
  chainId: number | string,
  tcrAddress: string,
  link?: ActionLink,
): string =>
  `/tcr/${chainId}/${tcrAddress}/submit${link?.query ? `?${link.query}` : ''}`
