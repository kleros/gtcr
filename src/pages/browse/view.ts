import { NETWORKS_INFO } from 'config/networks'
import { VERIFIED_LIST_OF_LISTS_ADDRESSES } from 'config/list-of-lists'
import { parseIpfs } from 'utils/ipfs-parse'
import type {
  DashboardActivity,
  DashboardRegistry,
  RegistryKind,
} from 'pages/dashboard/types'
import type { StatusTone } from 'components/curate/primitives'
import {
  MAINNET_CHAIN_IDS,
  TESTNET_CHAIN_IDS,
  sortRegistries as rankRegistries,
} from 'pages/dashboard/view'

/*
 * Pure view helpers for /browse: URL parameter parsing, filters, sorts and
 * the links a registry row needs. Nothing here fetches or invents data.
 */

/**
 * Which lists the explorer shows: the Kleros Verified ones (the default),
 * the Community ones (every other list), or all of them. A list whose
 * standing is not known yet ("unknown": its chain's lists of lists did not
 * answer) shows only under All.
 */
export type TrustMode = 'verified' | 'community' | 'all'
export type BrowseSort =
  | 'recent-submission'
  | 'recent-creation'
  | 'activity'
  | 'items'
  | 'disputes'
  | 'name'

export const PAGE_SIZE = 15

/**
 * The creation date a row may show: only while sorting by newest, and only
 * when it is the list's real creation block (the factory event), not its
 * first request.
 */
export const shownCreation = (
  registry: DashboardRegistry,
  sort: BrowseSort,
): number | null =>
  sort === 'recent-creation' && registry.createdAtExact && registry.createdAt
    ? registry.createdAt
    : null

export const SUPPORTED_CHAIN_IDS = Object.values(NETWORKS_INFO).map((info) =>
  Number(info.chainId),
)

export const chainInfo = (chainId: number) =>
  NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]

export const chainName = (chainId: number): string =>
  chainInfo(chainId)?.name ?? `Chain ${chainId}`

const listFormat = new Intl.ListFormat('en-GB', {
  style: 'long',
  type: 'conjunction',
})

const isTestnet = (chainId: number) => TESTNET_CHAIN_IDS.includes(chainId)

/**
 * The chains a `chain` filter covers. None chosen is "All chains": Ethereum
 * and Gnosis, as on the dashboard. Sepolia is a testnet, picked on its own
 * (`?chain=11155111`) or next to others (`?chain=1,100,11155111`).
 */
export const scopeChainIds = (chains: number[]): number[] =>
  chains.length === 0 ? MAINNET_CHAIN_IDS : chains

/** Whether a chain is in the scope a `chain` filter covers. */
export const inScope = (chains: number[], chainId: number): boolean =>
  scopeChainIds(chains).includes(chainId)

/**
 * A chain's name as it reads after "on", marked as a testnet where it is
 * one: "Gnosis", "the Sepolia testnet".
 */
const scopeName = (chainId: number): string =>
  isTestnet(chainId) ? `the ${chainName(chainId)} testnet` : chainName(chainId)

/**
 * The chains in scope, to follow "on": "Ethereum and Gnosis" for no chain
 * filter, else the chosen chains ("the Sepolia testnet", "Ethereum, Gnosis
 * and the Sepolia testnet").
 */
export const scopeText = (chains: number[]): string =>
  listFormat.format(scopeChainIds(chains).map(scopeName))

/** Chains with a Light Kleros list of lists, where new lists are submitted. */
export const VERIFICATION_CHAIN_IDS = Object.keys(
  VERIFIED_LIST_OF_LISTS_ADDRESSES,
).map(Number)

export const kindLabel = (kind: RegistryKind): string =>
  kind === 'light' ? 'Light' : kind === 'permanent' ? 'Stake' : 'Classic'

export const registryHref = (registry: DashboardRegistry): string =>
  `/tcr/${registry.chainId}/${registry.address}`

/** Submission form of the chain's Light Kleros list of lists, or null. */
export const verificationHref = (chainId: number): string | null => {
  const address =
    VERIFIED_LIST_OF_LISTS_ADDRESSES[
      chainId as keyof typeof VERIFIED_LIST_OF_LISTS_ADDRESSES
    ]
  return address ? `/tcr/${chainId}/${address}/submit` : null
}

export const mediaUrl = (uri?: string | null): string | null => {
  if (!uri) return null
  return /^https?:\/\//i.test(uri) ? uri : parseIpfs(uri)
}

/* ---------- URL parameters ---------- */

/** `chain` is a comma-separated list of chain ids; unknown ids are ignored. */
export const parseChains = (value: string | null): number[] =>
  (value ?? '')
    .split(',')
    .map(Number)
    .filter((chainId) => SUPPORTED_CHAIN_IDS.includes(chainId))

/**
 * `trust` is absent for Kleros Verified, `community` or `all`. Links from
 * before the Community name used `unverified`; they still open Community.
 */
export const parseTrust = (value: string | null): TrustMode =>
  value === 'community' || value === 'unverified'
    ? 'community'
    : value === 'all'
      ? 'all'
      : 'verified'

/** The `trust` parameter for a mode: none for the default. */
export const trustParam = (mode: TrustMode): string | null =>
  mode === 'verified' ? null : mode

const isKind = (value: string): value is RegistryKind =>
  value === 'classic' || value === 'light' || value === 'permanent'

export const KIND_OPTIONS: { value: RegistryKind; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'classic', label: 'Classic' },
  { value: 'permanent', label: 'Stake' },
]

/** `kind` is a comma-separated list of registry types; none means every type. */
export const parseKinds = (value: string | null): RegistryKind[] => [
  ...new Set((value ?? '').split(',').filter(isKind)),
]

/**
 * Every entry a registry holds, whatever its status, so the figure matches
 * the registry page's own "Entries". Light lists report registered and absent
 * entries in `itemCount` and their entries with an open request in
 * `pendingCount`; Classic (`numberOfItems`) and Stake (submitted plus absent)
 * already count every entry in `itemCount`.
 */
export const entryCount = (registry: DashboardRegistry): number =>
  registry.kind === 'light'
    ? registry.itemCount + registry.pendingCount
    : registry.itemCount

/**
 * What a registry's `pendingCount` counts: open requests for Light and
 * Classic lists, but the entries currently listed for Stake lists (the
 * subgraph's numberOfSubmitted), which are not requests.
 */
export const pendingLabel = (kind: RegistryKind): string =>
  kind === 'permanent' ? 'Listed' : 'Open requests'

/**
 * Open requests, the same measure the dashboard ranks by: Stake lists have no
 * requests, so their `pendingCount` (entries listed) counts as none.
 */
export const openRequests = (registry: DashboardRegistry): number =>
  registry.kind === 'permanent' ? 0 : registry.pendingCount

/** A list whose title is only its address (the indexer had no name for it). */
export const hasAddressTitle = (registry: DashboardRegistry): boolean =>
  /^(Permanent registry|Registry) 0x[0-9a-f]{4}(\.\.\.|…)[0-9a-f]{4}$/i.test(
    registry.title,
  )

/**
 * The description a row or card may show, or null: placeholders such as "-"
 * or "..." are not descriptions.
 */
export const registryBlurb = (registry: DashboardRegistry): string | null => {
  const description = registry.description?.trim()
  return description && !/^[\s.\-–—]*$/.test(description) ? description : null
}

/** Sort orders, each with what it ranks by. */
export const SORT_OPTIONS: {
  value: BrowseSort
  label: string
  hint?: string
}[] = [
  {
    value: 'recent-submission',
    label: 'Latest activity',
    hint: 'Most recent request first',
  },
  { value: 'recent-creation', label: 'Newest lists', hint: 'By creation date' },
  {
    value: 'activity',
    label: 'Most open requests',
    hint: 'Unresolved requests now',
  },
  { value: 'items', label: 'Most entries', hint: 'Entries of any status' },
  { value: 'disputes', label: 'Most in court', hint: 'Disputes open now' },
  { value: 'name', label: 'Name A to Z' },
]

export const parseSort = (value: string | null): BrowseSort =>
  SORT_OPTIONS.some((option) => option.value === value)
    ? (value as BrowseSort)
    : 'recent-submission'

export const parsePage = (value: string | null): number =>
  Math.max(1, Math.floor(Number(value)) || 1)

/* ---------- Filters and sorts ---------- */

const includes = (needle: string, values: Array<string | number | undefined>) =>
  !needle ||
  values.some(
    (value) =>
      value !== undefined && String(value).toLowerCase().includes(needle),
  )

export const filterRegistries = (
  registries: DashboardRegistry[],
  filters: {
    chains: number[]
    trust: TrustMode
    kinds: RegistryKind[]
    search: string
  },
): DashboardRegistry[] => {
  const needle = filters.search.trim().toLowerCase()
  return registries.filter((registry) => {
    if (!inScope(filters.chains, registry.chainId)) return false
    if (filters.trust === 'verified' && registry.trustStatus !== 'verified')
      return false
    if (filters.trust === 'community' && registry.trustStatus !== 'unverified')
      return false
    if (filters.kinds.length > 0 && !filters.kinds.includes(registry.kind))
      return false
    return includes(needle, [
      registry.title,
      registry.description,
      registry.address,
      kindLabel(registry.kind),
      chainInfo(registry.chainId)?.name,
    ])
  })
}

/** 1 for a list with no entry yet, 0 otherwise: empty lists sort last. */
const emptyLast = (registry: DashboardRegistry): number =>
  entryCount(registry) === 0 ? 1 : 0

/**
 * The explorer's order. Lists with no entry yet come after the lists that
 * have some, except by name or by creation date, where the reader asked
 * for that order itself.
 */
export const sortRegistries = (
  registries: DashboardRegistry[],
  sort: BrowseSort,
): DashboardRegistry[] =>
  [...registries].sort((a, b) => {
    if (sort !== 'name' && sort !== 'recent-creation') {
      const empty = emptyLast(a) - emptyLast(b)
      if (empty) return empty
    }
    // 'activity' keeps its URL value; it ranks by open requests right now.
    if (sort === 'activity')
      return (
        openRequests(b) - openRequests(a) ||
        b.disputeCount - a.disputeCount ||
        (b.lastActivityAt || 0) - (a.lastActivityAt || 0)
      )
    if (sort === 'items') return entryCount(b) - entryCount(a)
    if (sort === 'disputes')
      return (
        b.disputeCount - a.disputeCount || openRequests(b) - openRequests(a)
      )
    if (sort === 'name') return a.title.localeCompare(b.title)
    if (sort === 'recent-creation')
      return (
        (b.createdAt || 0) - (a.createdAt || 0) ||
        (b.lastActivityAt || 0) - (a.lastActivityAt || 0) ||
        entryCount(b) - entryCount(a)
      )
    return (
      (b.lastActivityAt || 0) - (a.lastActivityAt || 0) ||
      openRequests(b) - openRequests(a) ||
      entryCount(b) - entryCount(a)
    )
  })

/**
 * Counts for the chain scope the app bar chose; every figure is a sum of the
 * data. Stake lists are left out of openRequests because their pendingCount
 * is the entries currently listed, not requests.
 */
export const summarize = (
  registries: DashboardRegistry[],
  chains: number[],
) => {
  const scoped = registries.filter((registry) =>
    inScope(chains, registry.chainId),
  )
  return {
    verified: scoped.filter((registry) => registry.trustStatus === 'verified')
      .length,
    community: scoped.filter(
      (registry) => registry.trustStatus === 'unverified',
    ).length,
    entries: scoped.reduce((sum, registry) => sum + entryCount(registry), 0),
    openRequests: scoped.reduce(
      (sum, registry) => sum + openRequests(registry),
      0,
    ),
  }
}

/**
 * The Kleros Verified lists in scope for the figures panel's logos, in the
 * dashboard's order: most open requests first (then disputes, then the
 * dashboard's own ranking), so both pages show them the same way.
 */
export const verifiedShowcase = (
  registries: DashboardRegistry[],
  chains: number[],
  count: number,
): DashboardRegistry[] =>
  rankRegistries(
    registries.filter(
      (registry) =>
        registry.trustStatus === 'verified' &&
        inScope(chains, registry.chainId),
    ),
    'activity',
  ).slice(0, count)

export const activityTone = (activity: DashboardActivity): StatusTone =>
  activity.kind === 'challenge'
    ? 'contested'
    : activity.kind === 'resolution'
      ? activity.outcome === 'registered' || activity.outcome === 'kept'
        ? 'registered'
        : activity.outcome === 'no-ruling'
          ? 'neutral'
          : 'off'
      : 'window'
