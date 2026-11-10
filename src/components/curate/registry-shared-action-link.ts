import { FILTER_KEYS, P_FILTER_KEYS } from 'utils/filters'

/*
 * ?action= links: anyone can send people to a list with the values to
 * submit in the URL. Every parameter other than `action` is a field value,
 * in column order, except the list's own state (filters, sort, page) and
 * the app-wide theme preview (?cv-theme=), which rides along to the submit
 * page but is never a value.
 */

const THEME_KEY = 'cv-theme'

const LIST_STATE_KEYS = new Set<string>([
  ...Object.values(FILTER_KEYS),
  ...Object.values(P_FILTER_KEYS),
])

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
  const rest = new URLSearchParams()
  const values: string[] = []
  params.forEach((value, key) => {
    if (key === 'action' || LIST_STATE_KEYS.has(key)) return
    rest.append(key, value)
    if (key !== THEME_KEY) values.push(value)
  })
  return { values, query: rest.toString() }
}

/** The full-page submit form for a list, carrying the link's values. */
export const submitPathFor = (
  chainId: number | string,
  tcrAddress: string,
  link?: ActionLink,
): string =>
  `/tcr/${chainId}/${tcrAddress}/submit${link?.query ? `?${link.query}` : ''}`
