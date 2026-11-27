import { ItemTypes } from '@kleros/gtcr-encoder'
import { references } from 'utils/rich-address'
import { FILTER_KEYS } from 'utils/filters'

/*
 * A list's Network menu (Scout's chain filter, made general): on any list
 * whose first identifying column is a rich address (CAIP-10,
 * `eip155:8453:0x…`), entries can be narrowed to the networks their
 * addresses live on. The indexers keep that column's value as typed in
 * `key0`, so the filter is a prefix match added to the query the list
 * already sends: no extra request. Several networks can be chosen; they are
 * kept in the URL as `?network=eip155:8453,eip155:137`.
 *
 * Lists whose first identifier is anything else (a name, a plain address)
 * do not know an entry's network and get no menu.
 */

export const NETWORK_KEY = 'network'

export interface NetworkOption {
  /** CAIP-2 key kept in the URL: `namespace:reference`. */
  key: string
  name: string
  /** Every `namespace:reference:` prefix an entry on it may start with. */
  prefixes: string[]
}

/**
 * The networks the app can name, in its own order (the busiest first). A
 * network with a deprecated reference (Solana's older genesis id) is one
 * choice that matches both.
 */
export const NETWORK_OPTIONS: NetworkOption[] = (() => {
  const byName = new Map<string, NetworkOption>()
  references.forEach((reference) => {
    const group = `${reference.namespaceId}|${reference.name}`
    const prefix = `${reference.namespaceId}:${reference.id}:`
    const known = byName.get(group)
    if (known) {
      known.prefixes.push(prefix)
      if (!reference.deprecated)
        known.key = `${reference.namespaceId}:${reference.id}`
      return
    }
    byName.set(group, {
      key: `${reference.namespaceId}:${reference.id}`,
      name: reference.name,
      prefixes: [prefix],
    })
  })
  return [...byName.values()]
})()

const optionByKey = new Map(
  NETWORK_OPTIONS.map((option) => [option.key, option]),
)

interface ColumnLike {
  type?: string
  isIdentifier?: boolean
}

/**
 * Whether a list's entries can be told apart by network: its first
 * identifying column (the one the indexers keep as `key0`) holds rich
 * addresses.
 */
export const listHasNetworks = (columns: ColumnLike[] | undefined): boolean =>
  columns?.find((column) => column.isIdentifier)?.type ===
  ItemTypes.RICH_ADDRESS

/** The networks the query string chooses, known ones only, in menu order. */
export const networksFrom = (search: string): string[] => {
  const raw = new URLSearchParams(search).get(NETWORK_KEY)
  if (!raw) return []
  const asked = new Set(raw.split(',').map((key) => key.trim()))
  return NETWORK_OPTIONS.filter((option) => asked.has(option.key)).map(
    (option) => option.key,
  )
}

/**
 * The query string with `key` toggled among the chosen networks ('all'
 * clears them), back on the first page as any filter change is.
 */
export const withNetworkToggled = (search: string, key: string): string => {
  const params = new URLSearchParams(search)
  const chosen = new Set(networksFrom(search))
  if (key === 'all') chosen.clear()
  else if (chosen.has(key)) chosen.delete(key)
  else if (optionByKey.has(key)) chosen.add(key)
  const ordered = NETWORK_OPTIONS.filter((option) =>
    chosen.has(option.key),
  ).map((option) => option.key)
  if (ordered.length > 0) params.set(NETWORK_KEY, ordered.join(','))
  else params.delete(NETWORK_KEY)
  params.delete(FILTER_KEYS.PAGE)
  return `?${params.toString()}`
}

/** The `namespace:reference:` prefixes the chosen networks match. */
export const networkPrefixes = (keys: string[]): string[] =>
  keys.flatMap((key) => optionByKey.get(key)?.prefixes ?? [])

/** What the Network menu's trigger reads. */
export const networkSummary = (keys: string[]): string => {
  if (keys.length === 0) return 'All'
  if (keys.length === 1) return optionByKey.get(keys[0])?.name ?? keys[0]
  return `${keys.length} networks`
}

/** A prefix inside an ILIKE pattern, its wildcards taken literally. */
const likePrefix = (prefix: string) =>
  `${prefix.replace(/[\\%_]/g, (char) => `\\${char}`)}%`

/**
 * Standard lists (Envio): the clause that keeps entries on the chosen
 * networks, or undefined for all of them.
 */
export const standardNetworkWhere = (
  prefixes: string[],
): Record<string, unknown> | undefined => {
  if (prefixes.length === 0) return undefined
  const matches = prefixes.map((prefix) => ({
    key0: { _ilike: likePrefix(prefix) },
  }))
  return matches.length === 1 ? matches[0] : { _or: matches }
}

/**
 * Stake lists (The Graph): the same clause, on the entry's metadata. The
 * Graph takes `or` only beside nothing else, so the caller nests it in an
 * `and`.
 */
export const stakeNetworkWhere = (
  prefixes: string[],
): Record<string, unknown> | undefined => {
  if (prefixes.length === 0) return undefined
  const matches = prefixes.map((prefix) => ({
    metadata_: { key0_starts_with_nocase: prefix },
  }))
  return matches.length === 1 ? matches[0] : { or: matches }
}
