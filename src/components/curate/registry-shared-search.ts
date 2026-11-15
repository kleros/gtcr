import { FILTER_KEYS } from 'utils/filters'

/*
 * A registry list's search box lives in the URL (?q=), as its filters, sort
 * and page do, so Back from an entry, a reload or a shared link keeps it.
 */

export const LIST_SEARCH_KEY = 'q'

/** The search the query string carries ('' for none). */
export const listSearchFrom = (search: string): string =>
  new URLSearchParams(search).get(LIST_SEARCH_KEY) ?? ''

/**
 * The query string with the search set to `term` (dropped when empty). A new
 * search over the whole list starts from its first page; a search that only
 * filters the page on screen (`keepPage`, the Stake list's) stays on it.
 */
export const withListSearch = (
  search: string,
  term: string,
  { keepPage = false }: { keepPage?: boolean } = {},
): string => {
  const params = new URLSearchParams(search)
  if (term) params.set(LIST_SEARCH_KEY, term)
  else params.delete(LIST_SEARCH_KEY)
  if (!keepPage) params.delete(FILTER_KEYS.PAGE)
  return `?${params.toString()}`
}
