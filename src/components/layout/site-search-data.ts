import { gql } from 'graphql-request'
import { nameEntry, oneLine, type EntryName } from 'utils/entry-name'
import { parseRichAddress } from 'utils/rich-address'
import type { StatusTone } from 'components/curate/primitives'
import type { DashboardRegistry, RegistryKind } from 'pages/dashboard/types'

/*
 * The site search (the app bar's magnifier, ⌘K): one box that finds lists,
 * entries on every list, and an address's profile. Lists are matched in the
 * browser from the dashboard load the app already keeps. Entries cost one
 * Envio request per settled term (all Standard lists on every chain asked)
 * plus one Stake subgraph request per chain, matched on the entries'
 * identifying fields (`key0`-`key4`), never on `keywords`, which starts with
 * the list's own address and would match every entry of a list whose
 * address is searched.
 *
 * Results are grouped by list, so the same address on several lists, or on
 * lists about unrelated things, reads as separate places, each named with
 * its network.
 */

/** Characters before entries are asked for (lists match from the first). */
export const MIN_ENTRY_TERM = 3
/** Entries read per term, across every list. */
export const ENTRY_LIMIT = 50
/** Stake entries read per chain and term. */
export const STAKE_ENTRY_LIMIT = 20
/**
 * Entries shown under each Standard list before "N more on this list". A
 * Stake list shows every entry read (at most STAKE_ENTRY_LIMIT): its own
 * search filters only the page on screen, so it could not show the rest.
 */
export const ENTRIES_PER_LIST = 4
/** Lists shown in the Lists group. */
export const LIST_LIMIT = 5

export const SITE_SEARCH_QUERY = gql`
  query SiteSearch($where: LItem_bool_exp!, $limit: Int!) {
    LItem(
      limit: $limit
      where: $where
      order_by: { latestRequestSubmissionTime: desc }
    ) {
      itemID
      status
      disputed
      chainId
      registry_id
      props {
        label
        value
        isIdentifier
        itemType
      }
    }
  }
`

export const SITE_SEARCH_STAKE_QUERY = gql`
  query SiteSearchStake($where: Item_filter!, $first: Int!) {
    items(
      first: $first
      where: $where
      orderBy: createdAt
      orderDirection: desc
    ) {
      itemID
      status
      registry {
        id
      }
      metadata {
        props {
          label
          value
          isIdentifier
          type
        }
      }
    }
  }
`

/** A term inside an ILIKE pattern, its wildcards taken literally. */
const likeTerm = (term: string) =>
  `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`

const KEYS = ['key0', 'key1', 'key2', 'key3', 'key4']

/** Standard entries on these chains whose identifying fields hold `term`. */
export const standardSearchWhere = (term: string, chainIds: number[]) => ({
  chainId: { _in: chainIds },
  _or: KEYS.map((key) => ({ [key]: { _ilike: likeTerm(term) } })),
})

/** Stake entries whose identifying fields hold `term` (one chain's subgraph). */
export const stakeSearchWhere = (term: string) => ({
  or: KEYS.map((key) => ({
    metadata_: { [`${key}_contains_nocase`]: term },
  })),
})

export interface RawStandardHit {
  itemID: string
  status: string
  disputed?: boolean | null
  chainId: number
  registry_id: string
  props?:
    | {
        label?: string
        value?: string
        isIdentifier?: boolean
        itemType?: string
      }[]
    | null
}

export interface RawStakeHit {
  itemID: string
  status: string
  registry?: { id: string } | null
  metadata?: {
    props?:
      | {
          label?: string
          value?: string
          isIdentifier?: boolean
          type?: string
        }[]
      | null
  } | null
}

export interface SearchStatus {
  tone: StatusTone
  label: string
}

/** A Standard entry's status, in the list page's words. */
export const standardHitStatus = (
  status: string,
  disputed: boolean | null | undefined,
): SearchStatus => {
  if (status === 'Registered')
    return { tone: 'registered', label: 'Registered' }
  if (status === 'Absent') return { tone: 'off', label: 'Rejected or removed' }
  if (disputed) return { tone: 'contested', label: 'Challenged' }
  if (status === 'ClearingRequested')
    return { tone: 'window', label: 'Removal requested' }
  return { tone: 'window', label: 'Submitted' }
}

/** A Stake entry's status, in the Stake list page's words. */
export const stakeHitStatus = (status: string): SearchStatus => {
  if (status === 'Disputed') return { tone: 'contested', label: 'Disputed now' }
  if (status === 'Absent') return { tone: 'off', label: 'Off the list' }
  return { tone: 'registered', label: 'Listed' }
}

export interface SearchHit {
  key: string
  chainId: number
  kind: RegistryKind
  /** List address, lowercase. */
  registry: string
  itemID: string
  name: EntryName
  status: SearchStatus
  href: string
}

/**
 * The entry's name (utils/entry-name.ts). An entry named by text that also
 * holds a rich address gets that address's network too, so "USD Coin" on
 * Ethereum and on Base read apart.
 */
const entryName = (
  props: { label?: string; value?: string; isIdentifier?: boolean }[],
  types: string[],
  itemID: string,
): EntryName => {
  const fields = props.map((prop, index) => ({
    label: oneLine(prop.label),
    value: oneLine(prop.value),
    type: types[index] ?? '',
    identifier: !!prop.isIdentifier,
  }))
  const name = nameEntry(fields).entry ?? {
    text: `Entry ${itemID.slice(0, 10)}…`,
  }
  if (name.network) return name
  const rich = fields.find(
    (field) => field.identifier && field.type === 'rich address',
  )
  const network = rich && parseRichAddress(rich.value)?.reference.name
  return network ? { ...name, network } : name
}

export const standardHit = (raw: RawStandardHit): SearchHit => {
  const props = raw.props ?? []
  const registry = raw.registry_id.toLowerCase()
  return {
    key: `standard:${raw.chainId}:${registry}:${raw.itemID}`,
    chainId: raw.chainId,
    kind: 'standard',
    registry,
    itemID: raw.itemID,
    name: entryName(
      props,
      props.map((prop) => String(prop.itemType ?? '')),
      raw.itemID,
    ),
    status: standardHitStatus(raw.status, raw.disputed),
    href: `/tcr/${raw.chainId}/${registry}/${raw.itemID}`,
  }
}

const stakeHit = (
  raw: RawStakeHit & { registry: { id: string } },
  chainId: number,
): SearchHit => {
  const props = raw.metadata?.props ?? []
  const registry = raw.registry.id.toLowerCase()
  return {
    key: `permanent:${chainId}:${registry}:${raw.itemID}`,
    chainId,
    kind: 'permanent',
    registry,
    itemID: raw.itemID,
    name: entryName(
      props,
      props.map((prop) => String(prop.type ?? '')),
      raw.itemID,
    ),
    status: stakeHitStatus(raw.status),
    href: `/tcr/${chainId}/${registry}/${raw.itemID}`,
  }
}

/** One chain's Stake answer as hits; an item with no list has no page. */
export const stakeHits = (raws: RawStakeHit[], chainId: number): SearchHit[] =>
  raws
    .filter((raw): raw is RawStakeHit & { registry: { id: string } } =>
      Boolean(raw.registry?.id),
    )
    .map((raw) => stakeHit(raw, chainId))

export interface ListInfo {
  title: string
  kind: RegistryKind
  itemCount?: number
  /** The list's logo (its MetaEvidence's), drawn as the board draws it. */
  logo?: string
}

export interface HitGroup {
  key: string
  chainId: number
  kind: RegistryKind
  registry: string
  title: string
  /** The list's logo, when the dashboard load knows the list. */
  logo?: string
  /**
   * The list page: searched for the term on a Standard list; plain on a
   * Stake list, whose search filters only the page on screen.
   */
  href: string
  hits: SearchHit[]
  /** Hits on this list beyond those shown (Standard lists only). */
  more: number
}

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`

export const registryKey = (chainId: number, address: string) =>
  `${chainId}:${address.toLowerCase()}`

/**
 * Hits grouped by list, the lists with the most hits first; ties keep the
 * order the hits came in (the Standard read, newest first, then each
 * chain's Stake read). A Standard list shows its first few, a Stake list
 * all of its own.
 */
export const groupHits = (
  hits: SearchHit[],
  lists: Map<string, ListInfo>,
  term: string,
): HitGroup[] => {
  const groups = new Map<string, HitGroup>()
  hits.forEach((hit) => {
    const key = registryKey(hit.chainId, hit.registry)
    let group = groups.get(key)
    if (!group) {
      const list = lists.get(key)
      group = {
        key,
        chainId: hit.chainId,
        kind: hit.kind,
        registry: hit.registry,
        title: list?.title || `List ${shortAddress(hit.registry)}`,
        logo: list?.logo,
        href:
          hit.kind === 'standard'
            ? `/tcr/${hit.chainId}/${hit.registry}?q=${encodeURIComponent(term)}`
            : `/tcr/${hit.chainId}/${hit.registry}`,
        hits: [],
        more: 0,
      }
      groups.set(key, group)
    }
    if (hit.kind === 'permanent' || group.hits.length < ENTRIES_PER_LIST)
      group.hits.push(hit)
    else group.more += 1
  })
  return [...groups.values()].sort(
    (a, b) => b.hits.length + b.more - (a.hits.length + a.more),
  )
}

/**
 * Titles shown more than once (old copies of a list keep its name): those
 * rows carry the list's short address to tell them apart.
 */
export const repeatedTitles = (
  items: { title: string; chainId: number; address: string }[],
): Set<string> => {
  const lists = new Map<string, Set<string>>()
  items.forEach(({ title, chainId, address }) => {
    const keys = lists.get(title) ?? new Set<string>()
    keys.add(registryKey(chainId, address))
    lists.set(title, keys)
  })
  return new Set(
    [...lists.entries()]
      .filter(([, keys]) => keys.size > 1)
      .map(([title]) => title),
  )
}

/**
 * Lists whose name holds the term, or whose address it is: names that start
 * with it first, then the busiest.
 */
export const matchLists = (
  registries: DashboardRegistry[],
  term: string,
): DashboardRegistry[] => {
  const needle = term.trim().toLowerCase()
  if (!needle) return []
  const matched = registries.filter(
    (registry) =>
      registry.title?.toLowerCase().includes(needle) ||
      registry.address.toLowerCase() === needle,
  )
  const starts = (registry: DashboardRegistry) =>
    registry.title?.toLowerCase().startsWith(needle) ? 0 : 1
  return matched
    .sort(
      (a, b) =>
        starts(a) - starts(b) || (b.itemCount ?? 0) - (a.itemCount ?? 0),
    )
    .slice(0, LIST_LIMIT)
}

/**
 * The address a term names, for its profile: a 0x address, or the address
 * inside a CAIP-10 value on an EVM network.
 */
export const termAddress = (term: string): string | undefined => {
  const value = term.trim()
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) return value
  const rich = parseRichAddress(value)
  if (
    rich?.reference.namespaceId === 'eip155' &&
    /^0x[0-9a-fA-F]{40}$/.test(rich.address)
  )
    return rich.address
  return undefined
}
