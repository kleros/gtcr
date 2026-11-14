import { NETWORKS_INFO } from 'config/networks'
import { getNativeCurrency } from 'config/chains'
import type { StatusTone } from 'components/curate/primitives'
import { formatAgo } from 'utils/time'
import type {
  DashboardActivity,
  DashboardData,
  DashboardDay,
  DashboardRegistry,
  RegistryKind,
  RulingRow,
  UnchallengedRow,
} from './types'

/* Pure view helpers for the dashboard: filters, sorts and board mapping. */

export type ChainFilter = 'all' | number
export type TrustFilter = 'all' | 'verified' | 'unverified'
export type KindFilter = 'all' | RegistryKind
export type RegistrySort = 'signal' | 'activity' | 'items' | 'recent'

export const SUPPORTED_CHAIN_IDS = Object.values(NETWORKS_INFO).map((info) =>
  Number(info.chainId),
)

/** Sepolia is a testnet: it is selectable, but never part of "All chains". */
export const TESTNET_CHAIN_IDS = [11155111]
export const MAINNET_CHAIN_IDS = SUPPORTED_CHAIN_IDS.filter(
  (chainId) => !TESTNET_CHAIN_IDS.includes(chainId),
)

/** Chains a filter value covers: 'all' ("All chains") means every mainnet. */
export const scopeChains = (chain: ChainFilter): number[] =>
  chain === 'all' ? MAINNET_CHAIN_IDS : [chain]

export const chainInfo = (chainId: number) =>
  NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]

export const kindLabel = (kind: RegistryKind): string =>
  kind === 'light' ? 'Light' : kind === 'permanent' ? 'Stake' : 'Classic'

export const registryHref = (registry: DashboardRegistry) =>
  `/tcr/${registry.chainId}/${registry.address}`

export const validTrust = (value: string | null): TrustFilter =>
  value === 'verified' || value === 'unverified' ? value : 'all'

export const validKind = (value: string | null): KindFilter =>
  value === 'classic' || value === 'light' || value === 'permanent'
    ? value
    : 'all'

export const validSort = (value: string | null): RegistrySort =>
  value === 'activity' || value === 'items' || value === 'recent'
    ? value
    : 'signal'

export const validChain = (value: string | null): ChainFilter =>
  value && SUPPORTED_CHAIN_IDS.includes(Number(value)) ? Number(value) : 'all'

/**
 * Every entry a list holds, the figure its registry page shows. Light
 * lists count settled entries in `itemCount` and the ones with an open
 * request in `pendingCount`; Classic (`numberOfItems`) and Stake (submitted,
 * absent and disputed) already count every entry in `itemCount`.
 */
export const entryCount = (registry: DashboardRegistry): number =>
  registry.kind === 'light'
    ? registry.itemCount + registry.pendingCount
    : registry.itemCount

/*
 * Challenge windows. A Light or Classic request can be challenged while
 * now <= submissionTime + its list's challengePeriodDuration (the
 * contracts' own check, against the list's current period); past that it
 * only waits to be executed. Periods are read on chain (data.ts).
 */

/** True when every row's list period is known, so each can be placed. */
export const rowsPlaced = (
  rows: UnchallengedRow[],
  periods: Record<string, number> | undefined,
): boolean =>
  !!periods &&
  rows.every((row) => row.submittedAt > 0 && periods[row.registry] >= 0)

/** The rows still inside their window at `now`, closing soonest first. */
export const openWindows = (
  rows: UnchallengedRow[],
  periods: Record<string, number>,
  now: number,
): { row: UnchallengedRow; closes: number }[] =>
  rows
    .filter((row) => periods[row.registry] >= 0 && row.submittedAt > 0)
    .map((row) => ({ row, closes: row.submittedAt + periods[row.registry] }))
    .filter(({ closes }) => now <= closes)
    .sort((a, b) => a.closes - b.closes || a.row.id.localeCompare(b.row.id))

/** True when a chain's unchallenged requests can all be placed in their windows. */
export const chainWindowsKnown = (
  data: DashboardData,
  chainId: number,
): boolean => {
  const rows = data.unchallengedRows?.[chainId] ?? []
  return rows.length === 0 || rowsPlaced(rows, data.challengePeriods?.[chainId])
}

/** True when a chain still misses a period or its closing-soon cards. */
export const windowsPending = (data: DashboardData, chainId: number): boolean =>
  (data.unchallengedRows?.[chainId]?.length ?? 0) > 0 &&
  (!chainWindowsKnown(data, chainId) || !data.closingSoon?.[chainId])

/**
 * Every figure the dashboard (and the landing page) shows for a scope of
 * chains, from one load of the data: one definition for both pages.
 * `now` (unix seconds) places unchallenged requests in their windows.
 */
export const scopedFigures = (
  data: DashboardData,
  chains: number[],
  now: number = Math.floor(Date.now() / 1000),
) => {
  const scoped = data.registries.filter((r) => chains.includes(r.chainId))
  // Curators active in the 30-day window, on a chain in scope.
  const curators = data.users.filter((user) =>
    Object.keys(user.chains).some((id) => chains.includes(Number(id))),
  ).length
  let unchallenged = 0
  let unchallengedCapped = false
  for (const chainId of chains) {
    unchallenged += data.unchallengedCount[chainId]?.count ?? 0
    unchallengedCapped ||= !!data.unchallengedCount[chainId]?.capped
  }
  /*
   * The unchallenged requests split by their challenge window: still open
   * (anyone can challenge and win the deposit) or past it (nobody can
   * challenge any more; they only wait to be executed). Only when every one
   * of them could be placed: otherwise the windows are unknown. The
   * deposits of the open ones are summed per chain (each in its own coin).
   */
  const windowsKnown = chains.every((chainId) =>
    chainWindowsKnown(data, chainId),
  )
  let inWindow = 0
  let pastWindow = 0
  const inWindowDeposits: Record<number, bigint> = {}
  if (windowsKnown)
    for (const chainId of chains) {
      const rows = data.unchallengedRows?.[chainId] ?? []
      const open = openWindows(
        rows,
        data.challengePeriods?.[chainId] ?? {},
        now,
      )
      inWindow += open.length
      pastWindow += rows.length - open.length
      for (const { row } of open)
        inWindowDeposits[chainId] =
          (inWindowDeposits[chainId] ?? 0n) + BigInt(row.deposit || '0')
    }
  return {
    registries: scoped.length,
    verified: scoped.filter((r) => r.trustStatus === 'verified').length,
    entries: scoped.reduce((sum, r) => sum + entryCount(r), 0),
    // Stake Curate has no requests (its counter is listed items).
    requestsOpen: scoped
      .filter((r) => r.kind !== 'permanent')
      .reduce((sum, r) => sum + r.pendingCount, 0),
    inCourt: data.openDisputes.filter((a) => chains.includes(a.chainId)).length,
    /** The open-dispute read hit its limit: "In court" is a lower bound. */
    inCourtCapped: chains.some((chainId) => data.openDisputesCapped?.[chainId]),
    unchallenged,
    unchallengedCapped,
    windowsKnown,
    inWindow,
    pastWindow,
    inWindowDeposits,
    curators,
  }
}

/* ---------- Rulings and bounties (all time) ---------- */

/** "30,690.1", "22.586", "0.0001": grouped, at most `fraction` decimals (rounded). */
export const formatUnits = (
  amount: bigint,
  decimals: number,
  fraction = 4,
): string => {
  let value = amount
  let places = decimals
  if (decimals > fraction) {
    const scale = 10n ** BigInt(decimals - fraction)
    value = (amount + scale / 2n) / scale
    places = fraction
  }
  const base = 10n ** BigInt(places)
  const whole = new Intl.NumberFormat('en-US').format(value / base)
  const rest = (value % base)
    .toString()
    .padStart(places, '0')
    .replace(/0+$/, '')
  return rest ? `${whole}.${rest}` : whole
}

/** One coin bounties were paid in, in a scope of chains. */
export interface BountyCoin {
  /** "<chainId>:native" or "<chainId>:<token address>". */
  key: string
  chainId: number
  /** Stake lists' ERC-20, lowercase; absent for the chain's own coin. */
  token?: string
  /** "xDAI", "ETH", "sDAI"; the short token address when its symbol did not load. */
  symbol: string
  /** Unknown when a token's decimals did not load: show the count, not an amount. */
  decimals?: number
  /** The total, in the coin's smallest unit. */
  amount: bigint
  /** The total in whole coins (approximate), for count-up animations. */
  value?: number
  /** "30,690.1 xDAI" (at most 4 decimals), or undefined when decimals are unknown. */
  display?: string
  /** Winning challenges paid in this coin. */
  won: number
}

/** Every resolved dispute in a scope of chains, newest first. */
export const scopedRulings = (
  data: DashboardData,
  chains: number[],
): RulingRow[] =>
  chains
    .flatMap((chainId) => data.rulings?.[chainId] ?? [])
    .sort((a, b) => b.resolvedAt - a.resolvedAt || a.id.localeCompare(b.id))

/**
 * The bounties challengers have won, all time, in a scope of chains (the
 * dashboard's: "All chains" is Ethereum and Gnosis; one chain; Sepolia on
 * its own). One entry per coin, never added across coins: each chain's own
 * coin (Light and Classic lists: the requester's base deposit of every
 * dispute the challenger won) and each Stake token (the entry's stake).
 * Coins are ordered by chain (scope order), the chain's coin before its
 * Stake tokens; coins nobody won are left out.
 *
 *  - won: winning challenges (rulings for the challenger), all coins
 *  - winners: how many different challengers won them
 *  - rulings: every dispute the court closed (a ruling or a refusal)
 *  - capped: some ledger stopped at its page limit: counts are lower bounds
 *  - loaded: chains whose ledger loaded (the figures cover these)
 *  - missing: chains whose ledger did not load (their bounties are absent)
 *
 * The landing page reads this to show the all-time bounty figure.
 */
export const scopedBounties = (data: DashboardData, chains: number[]) => {
  const coins = new Map<string, BountyCoin>()
  const winners = new Set<string>()
  let won = 0
  let rulings = 0
  for (const chainId of chains)
    for (const row of data.rulings?.[chainId] ?? []) {
      rulings += 1
      if (!row.challengerWon) continue
      won += 1
      if (row.challenger) winners.add(row.challenger)
      const key = `${chainId}:${row.token ?? 'native'}`
      const coin = coins.get(key) ?? {
        key,
        chainId,
        token: row.token,
        symbol: '',
        amount: 0n,
        won: 0,
      }
      coin.amount += BigInt(row.bounty || '0')
      coin.won += 1
      coins.set(key, coin)
    }
  for (const coin of coins.values()) {
    const info = coin.token
      ? data.tokens?.[coin.key]
      : getNativeCurrency(coin.chainId)
    coin.symbol =
      info?.symbol ?? `${coin.token?.slice(0, 6)}…${coin.token?.slice(-4)}`
    coin.decimals = info?.decimals
    if (coin.decimals !== undefined) {
      coin.display = `${formatUnits(coin.amount, coin.decimals)} ${coin.symbol}`
      coin.value = Number(
        formatUnits(coin.amount, coin.decimals, 6).replace(/,/g, ''),
      )
    }
  }
  const order = (coin: BountyCoin) =>
    chains.indexOf(coin.chainId) * 2 + (coin.token ? 1 : 0)
  return {
    coins: [...coins.values()].sort(
      (a, b) =>
        order(a) - order(b) || (a.token ?? '').localeCompare(b.token ?? ''),
    ),
    won,
    winners: winners.size,
    rulings,
    capped: chains.some((chainId) => data.rulingsCapped?.[chainId]),
    loaded: chains.filter((chainId) => !!data.rulings?.[chainId]),
    missing: chains.filter((chainId) => !data.rulings?.[chainId]),
  }
}

/**
 * Bounties won per challenger (lowercase address), all time, in a scope of
 * chains: how many of their challenges the court ruled for them.
 */
export const scopedWins = (
  data: DashboardData,
  chains: number[],
): Map<string, number> => {
  const wins = new Map<string, number>()
  for (const chainId of chains)
    for (const row of data.rulings?.[chainId] ?? [])
      if (row.challengerWon && row.challenger)
        wins.set(row.challenger, (wins.get(row.challenger) ?? 0) + 1)
  return wins
}

/**
 * Kleros Verified lists, newest to earn the badge first; the lists of
 * lists (which grant it, so have no date) last, by entries.
 */
export const newestVerified = (
  registries: DashboardRegistry[],
): DashboardRegistry[] =>
  registries
    .filter((registry) => registry.trustStatus === 'verified')
    .sort(
      (a, b) =>
        (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0) ||
        entryCount(b) - entryCount(a) ||
        a.title.localeCompare(b.title),
    )

const RULING_LABEL: Record<RulingRow['outcome'], string> = {
  registered: 'Registered by ruling',
  rejected: 'Rejected by ruling',
  removed: 'Removed by ruling',
  kept: 'Kept by ruling',
  'no-ruling': 'Court refused to rule',
}

/**
 * A ruling's row, from the ledger alone or with its loaded card (which adds
 * the entry's identifiers). `bounty` is what the challenger won, formatted.
 */
export const rulingCard = (
  row: RulingRow,
  now: number,
  card?: DashboardActivity,
  bounty?: string,
): DashboardCard => ({
  id: row.id,
  href: row.itemID
    ? `/tcr/${row.chainId}/${row.registry}/${row.itemID}`
    : `/tcr/${row.chainId}/${row.registry}`,
  registry: card?.registryTitle ?? '',
  registryAddress: row.registry,
  identifiers: card?.previewProps ?? [],
  chainId: row.chainId,
  actor: card?.actor,
  when: `decided ${formatAgoLong(row.resolvedAt, now)}`,
  at: row.resolvedAt,
  detail: RULING_LABEL[row.outcome],
  bounty,
  tone:
    row.outcome === 'registered' || row.outcome === 'kept'
      ? 'registered'
      : row.outcome === 'no-ruling'
        ? 'neutral'
        : 'off',
})

/** The 30-day series summed over a scope of chains, oldest day first. */
export const scopedSeries = (
  data: DashboardData,
  chains: number[],
): DashboardDay[] =>
  data.series.map((day, index) => {
    const sum = { ...day, submissions: 0, removals: 0, challenges: 0 }
    for (const chainId of chains) {
      const other = data.seriesByChain[chainId]?.[index]
      if (!other) continue
      sum.submissions += other.submissions
      sum.removals += other.removals
      sum.challenges += other.challenges
    }
    return sum
  })

const signalScore = (registry: DashboardRegistry): number => {
  const trust = registry.trustStatus === 'verified' ? 100000 : 0
  const kind =
    registry.kind === 'light'
      ? 16000
      : registry.kind === 'classic'
        ? 12000
        : 7000
  const recent = registry.lastActivityAt
    ? Math.min(6000, registry.lastActivityAt / 1000000)
    : 0
  return (
    trust +
    kind +
    Math.min(registry.activeCount, 300) * 150 +
    Math.min(registry.pendingCount, 200) * 80 +
    Math.min(entryCount(registry), 12000) +
    recent
  )
}

/* Stake Curate has no requests: its "submitted" state is not an open request. */
const openRequests = (registry: DashboardRegistry) =>
  registry.kind === 'permanent' ? 0 : registry.pendingCount

export const sortRegistries = (
  registries: DashboardRegistry[],
  sort: RegistrySort,
): DashboardRegistry[] =>
  [...registries].sort((a, b) => {
    if (sort === 'items')
      return entryCount(b) - entryCount(a) || signalScore(b) - signalScore(a)
    if (sort === 'recent')
      return (
        (b.lastActivityAt || 0) - (a.lastActivityAt || 0) ||
        signalScore(b) - signalScore(a)
      )
    if (sort === 'activity')
      return (
        openRequests(b) - openRequests(a) ||
        b.disputeCount - a.disputeCount ||
        signalScore(b) - signalScore(a)
      )
    return signalScore(b) - signalScore(a)
  })

const includes = (needle: string, values: Array<string | number | undefined>) =>
  !needle ||
  values.some(
    (value) =>
      value !== undefined && String(value).toLowerCase().includes(needle),
  )

export const filterRegistries = (
  registries: DashboardRegistry[],
  filters: {
    chain: ChainFilter
    trust: TrustFilter
    kind: KindFilter
    search: string
  },
): DashboardRegistry[] => {
  const needle = filters.search.trim().toLowerCase()
  return registries.filter((registry) => {
    if (filters.chain !== 'all' && registry.chainId !== filters.chain)
      return false
    if (filters.trust !== 'all' && registry.trustStatus !== filters.trust)
      return false
    if (filters.kind !== 'all' && registry.kind !== filters.kind) return false
    return includes(needle, [
      registry.title,
      registry.description,
      registry.address,
      kindLabel(registry.kind),
      chainInfo(registry.chainId)?.name,
    ])
  })
}

/** One row of the Happening now board. */
export interface DashboardCard {
  id: string
  /** Registry logo (IPFS or http URL), shown as the row avatar. */
  logo?: string | null
  href: string
  registry: string
  /** List address (lowercase), to tell lists apart. */
  registryAddress: string
  identifiers: { label: string; value: string }[]
  chainId: number
  actor?: string
  /** "submitted 3h ago", "challenged 2 years ago" */
  when: string
  /** "Dispute", "Kept by ruling"; empty for none. */
  detail: string
  /** An identifier set in mono after the detail, e.g. "#1040". */
  detailId?: string
  tone: StatusTone
  /** Submission or removal request (Light and Classic). */
  request?: 'submission' | 'removal'
  /** The request's base deposit in wei: what a winning challenger takes. */
  deposit?: string
  /** A ruling for the challenger: what they won, e.g. "30 xDAI". */
  bounty?: string
  /** The list is Kleros Verified (the row shows the seal). */
  verified?: boolean
  /** The request's challenge window, when its list's period is known. */
  windowStart?: number
  windowEnd?: number
  /** When the row's event happened (unix seconds), for the time line. */
  at: number
}

const DAY = 86400

/**
 * "3h ago", "4d 6h ago"; past a week "12 days ago", past two months
 * "5 months ago", "2 years ago".
 */
export const formatAgoLong = (timestamp: number, now: number): string => {
  const days = Math.floor((now - timestamp) / DAY)
  if (days < 7) return formatAgo(timestamp, now)
  if (days < 60) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? 'a year ago' : `${years} years ago`
}

const toCard = (
  activity: DashboardActivity,
  now: number,
  verb: string,
  detail: string = activity.status,
  window?: { start: number; end: number },
): DashboardCard => ({
  id: activity.id,
  href: activity.href,
  registry: activity.registryTitle,
  registryAddress: activity.registryAddress,
  identifiers: activity.previewProps ?? [],
  chainId: activity.chainId,
  actor: activity.actor,
  when: `${verb} ${formatAgoLong(activity.timestamp, now)}`,
  at: activity.timestamp,
  detail,
  request: activity.requestType,
  deposit: activity.deposit,
  windowStart: window?.start,
  windowEnd: window?.end,
  tone:
    activity.kind === 'resolution'
      ? activity.outcome === 'registered' || activity.outcome === 'kept'
        ? 'registered'
        : activity.outcome === 'no-ruling'
          ? 'neutral'
          : 'off'
      : activity.kind === 'challenge'
        ? 'contested'
        : 'window',
})

/** A list that holds open requests, with how many. */
export interface OpenList {
  chainId: number
  registry: string
  count: number
}

/**
 * The board, all in the page's chain scope:
 *  - open: when every window is known, the requests still inside their
 *    challenge window, closing soonest first, as far as the loaded cards
 *    keep that order exact; otherwise the newest unchallenged requests,
 *    with no claim about their window.
 *  - openLists: every list holding those requests, most first (the whole
 *    count, not only the loaded cards).
 *  - live: every dispute open right now.
 * Rulings are all time and come from the ledger (scopedRulings, rulingCard).
 */
export const buildBoard = (
  data: DashboardData,
  now: number,
  chains: number[],
) => {
  const inScope = (activity: DashboardActivity) =>
    chains.includes(activity.chainId)
  const unique = () => {
    const seen = new Set<string>()
    return (activity: DashboardActivity) => {
      if (seen.has(activity.id)) return false
      seen.add(activity.id)
      return true
    }
  }
  const verb = (activity: DashboardActivity) =>
    activity.requestType === 'removal' ? 'removal asked' : 'submitted'
  const windowsKnown = chains.every((chainId) =>
    chainWindowsKnown(data, chainId),
  )

  let open: DashboardCard[]
  if (windowsKnown) {
    const placed = chains.map((chainId) => {
      const periods = data.challengePeriods?.[chainId] ?? {}
      const soon = data.closingSoon?.[chainId]
      const cards = (
        soon ?? data.unchallenged.filter((a) => a.chainId === chainId)
      )
        .filter(unique())
        .map((activity) => {
          const period = periods[activity.registryAddress]
          return {
            activity,
            start: activity.timestamp,
            end: period >= 0 ? activity.timestamp + period : -1,
          }
        })
        .filter(({ start, end }) => start > 0 && now <= end)
      const total = openWindows(
        data.unchallengedRows?.[chainId] ?? [],
        periods,
        now,
      ).length
      // Past the last loaded card a chain may close others first: rows
      // from other chains stop there, so the order shown stays exact.
      const bound =
        soon && total > cards.length && cards.length > 0
          ? Math.max(...cards.map(({ end }) => end))
          : Infinity
      return { cards, bound }
    })
    const cutoff = Math.min(...placed.map(({ bound }) => bound))
    open = placed
      .flatMap(({ cards }) => cards)
      .filter(({ end }) => end <= cutoff)
      .sort((a, b) => a.end - b.end)
      .map(({ activity, start, end }) =>
        toCard(activity, now, verb(activity), '', { start, end }),
      )
  } else
    open = data.unchallenged
      .filter(inScope)
      .filter(unique())
      .map((activity) => toCard(activity, now, verb(activity), ''))

  const byList = new Map<string, OpenList>()
  for (const chainId of chains) {
    const rows = data.unchallengedRows?.[chainId] ?? []
    const counted = windowsKnown
      ? openWindows(rows, data.challengePeriods?.[chainId] ?? {}, now).map(
          ({ row }) => row,
        )
      : rows
    for (const row of counted) {
      const key = `${chainId}:${row.registry}`
      const list = byList.get(key) ?? {
        chainId,
        registry: row.registry,
        count: 0,
      }
      list.count += 1
      byList.set(key, list)
    }
  }
  const openLists = [...byList.values()].sort((a, b) => b.count - a.count)

  const live = data.openDisputes
    .filter(inScope)
    .filter(unique())
    .map((activity) => ({
      ...toCard(activity, now, 'challenged', 'Dispute'),
      detailId: activity.disputeID ? `#${activity.disputeID}` : undefined,
    }))
  return { open, openLists, windowsKnown, live }
}
