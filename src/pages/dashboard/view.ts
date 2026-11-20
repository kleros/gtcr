import { NETWORKS_INFO } from 'config/networks'
import { getNativeCurrency } from 'config/chains'
import type { StatusTone } from 'components/curate/primitives'
import { formatAgo } from 'utils/time'
import { countsAsVerifiedList } from 'components/curate/verified-rule'
import type {
  DashboardActivity,
  DashboardData,
  DashboardDay,
  DashboardRegistry,
  RulingRow,
  UnchallengedRow,
} from './types'

/* Pure view helpers for the dashboard: scopes, figures and board mapping. */

export type ChainFilter = 'all' | number
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

export const registryHref = (registry: DashboardRegistry) =>
  `/tcr/${registry.chainId}/${registry.address}`

export const validChain = (value: string | null): ChainFilter =>
  value && SUPPORTED_CHAIN_IDS.includes(Number(value)) ? Number(value) : 'all'

/**
 * Every entry a list holds, the figure its registry page shows. Standard
 * lists count settled entries in `itemCount` and the ones with an open
 * request in `pendingCount`; Stake (submitted, absent and disputed) already
 * counts every entry in `itemCount`.
 */
export const entryCount = (registry: DashboardRegistry): number =>
  registry.kind === 'standard'
    ? registry.itemCount + registry.pendingCount
    : registry.itemCount

/*
 * Challenge windows. A Standard request can be challenged while
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
 * An indexer amount in the coin's smallest unit: a request's deposit or a
 * ledger bounty, both built the same way (data.ts). Anything that is not a
 * plain integer string counts as no amount, in either place: the field is
 * the indexer's, and a decimal or an exponent (a JS number of 1000 xDAI
 * stringifies to "1e+21") would throw inside the page's memo and take the
 * whole dashboard down rather than leave one figure short. Exported for the
 * one other place that reads a ledger bounty, the ruling row's label
 * (index.tsx), which renders it and so would crash in the same way.
 */
export const toAmount = (value: string | undefined | null): bigint => {
  const text = (value ?? '').trim()
  return /^\d+$/.test(text) ? BigInt(text) : 0n
}

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
   * deposits of the open ones are summed per chain (each in its own coin),
   * with a deposit the indexer sent unreadably counting as none (toAmount).
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
          (inWindowDeposits[chainId] ?? 0n) + toAmount(row.deposit)
    }
  /*
   * The retired Classic lists' entry history in scope, summed from their
   * own figures (data.classicEntries) and never from a registry row: no
   * Classic list is in `data.registries`, so none can be browsed, linked or
   * counted among the lists this app shows.
   */
  let classicLists = 0
  let classicEntries = 0
  let classicCapped = false
  for (const chainId of chains) {
    const classic = data.classicEntries?.[chainId]
    if (!classic) continue
    classicLists += classic.lists
    classicEntries += classic.entries
    classicCapped ||= classic.capped
  }
  const entries = scoped.reduce((sum, r) => sum + entryCount(r), 0)
  return {
    registries: scoped.length,
    verified: scoped.filter(countsAsVerifiedList).length,
    /**
     * Entries the lists this app shows have ever held (settled on or off the
     * list) plus those with an open request: the live figure.
     */
    entries,
    /**
     * Every entry ever curated in scope: the above plus the retired Classic
     * lists' own total. The all-time panel's denominator, never the live
     * strip's figure, which stands beside a count of the lists Browse can
     * show.
     */
    entriesAllTime: entries + classicEntries,
    /** How many retired Classic lists that total is of, and their entries. */
    classicLists,
    classicEntries,
    /** The Classic read came back a full page: `entriesAllTime` is a floor. */
    classicCapped,
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
  /**
   * "<chainId>:native", "<chainId>:<token address>", or
   * "<chainId>:token-unknown" for a Stake list whose token did not load.
   */
  key: string
  chainId: number
  /** A Stake list's own ERC-20, rather than the chain's coin. */
  stake: boolean
  /** That ERC-20, lowercase; absent for the chain's coin and when it did not load. */
  token?: string
  /**
   * "xDAI", "ETH", "sDAI"; the short token address when the symbol did not
   * load, and empty when nothing names the coin at all.
   */
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
  /**
   * How many of those carried an amount: what `amount` is the sum of. Lower
   * than `won` when the indexer recorded no deposit for a ruling, so the
   * count a tile shows beside an amount answers the same question as it.
   */
  paid: number
}

/**
 * The resolved disputes a reader can open, in a scope of chains, newest
 * first: this is the FEED, the only source of the rulings a row, a card or
 * a link is built from (rulingCard below, the Disputes panel, the cards
 * "show more" reads). The counts are not this: they come from
 * scopedChallengeRecord, over the whole ledger.
 *
 * So a ruling on a retired Classic list is filtered out here. It is part of
 * the protocol's history and counts in the bounties and the disputed
 * requests (scopedBounties, scopedChallengeRecord), but the app has no
 * Classic page, so a row pointing at one could only lead nowhere.
 * There is deliberately no second export returning the unfiltered ledger:
 * the next reader cannot pick the wrong one.
 */
export const scopedRulings = (
  data: DashboardData,
  chains: number[],
): RulingRow[] =>
  chains
    .flatMap((chainId) => data.rulings?.[chainId] ?? [])
    .filter((row) => row.kind !== 'classic')
    .sort((a, b) => b.resolvedAt - a.resolvedAt || a.id.localeCompare(b.id))

/**
 * The bounties challengers have won, all time, in a scope of chains (the
 * dashboard's: "All chains" is Ethereum and Gnosis; one chain; Sepolia on
 * its own). One entry per coin, never added across coins: each chain's own
 * coin (Standard lists: the requester's base deposit of every
 * dispute the challenger won) and each Stake token (the entry's stake).
 * Coins are ordered by chain (scope order), the chain's coin before its
 * Stake tokens; coins nobody won are left out.
 *
 * A Stake bounty is paid in its list's own token, so a Stake row whose token
 * did not come through the subgraph gets a coin of its own rather than being
 * folded into the chain's coin (which would add an ERC-20 amount into the
 * chain's ETH or xDAI figure and count it as one more of its bounties).
 *
 *  - won: winning challenges (rulings for the challenger), all coins
 *  - winners: how many different challengers won them
 *  - rulings: every dispute the court closed (a ruling or a refusal)
 *  - listedRulings, listedWon: the same two on the Standard and Stake lists
 *    alone, the ones the Disputes panel can list. The share of disputes that
 *    went to the challenger is taken from these: round 4 counts the retired
 *    Classic lists in the bounties and the all-time entries "only", so a
 *    dispute share beside the panel's own ruling count reads the same 762
 *    rather than the ledger's 923.
 *  - classicBounties: the Classic wins that carried an amount, the share of
 *    the coins' counts (`paid`) the Classic lists account for, which the
 *    panel names in its Classic line
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
  let listedRulings = 0
  let listedWon = 0
  let classicBounties = 0
  for (const chainId of chains)
    for (const row of data.rulings?.[chainId] ?? []) {
      const classic = row.kind === 'classic'
      rulings += 1
      if (!classic) listedRulings += 1
      if (!row.challengerWon) continue
      won += 1
      if (!classic) listedWon += 1
      else if (toAmount(row.bounty) > 0n) classicBounties += 1
      if (row.challenger) winners.add(row.challenger)
      /*
       * Which coin this bounty is in: a Standard bounty is the chain's own
       * coin, a Stake bounty its list's token, and a Stake row whose token
       * did not load a coin of its own rather than the chain's. Keyed by the
       * row's own chain, the same one data.tokens is keyed by.
       */
      const stake = row.kind === 'permanent'
      const key = `${row.chainId}:${stake ? (row.token ?? 'token-unknown') : 'native'}`
      const coin = coins.get(key) ?? {
        key,
        chainId: row.chainId,
        stake,
        token: stake ? row.token : undefined,
        symbol: '',
        amount: 0n,
        won: 0,
        paid: 0,
      }
      const amount = toAmount(row.bounty)
      coin.amount += amount
      coin.won += 1
      if (amount > 0n) coin.paid += 1
      coins.set(key, coin)
    }
  for (const coin of coins.values()) {
    const info = coin.stake
      ? coin.token
        ? data.tokens?.[coin.key]
        : undefined
      : getNativeCurrency(coin.chainId)
    coin.symbol =
      info?.symbol ??
      (coin.token ? `${coin.token.slice(0, 6)}…${coin.token.slice(-4)}` : '')
    coin.decimals = info?.decimals
    if (coin.decimals !== undefined) {
      coin.display = `${formatUnits(coin.amount, coin.decimals)} ${coin.symbol}`
      coin.value = Number(
        formatUnits(coin.amount, coin.decimals, 6).replace(/,/g, ''),
      )
    }
  }
  const order = (coin: BountyCoin) =>
    chains.indexOf(coin.chainId) * 2 + (coin.stake ? 1 : 0)
  return {
    // Within a chain's Stake tokens: the named ones first, then the one
    // whose token did not load (it can say least about itself).
    coins: [...coins.values()].sort(
      (a, b) =>
        order(a) - order(b) ||
        Number(!a.token) - Number(!b.token) ||
        (a.token ?? '').localeCompare(b.token ?? ''),
    ),
    won,
    winners: winners.size,
    rulings,
    listedRulings,
    listedWon,
    classicBounties,
    capped: chains.some((chainId) => data.rulingsCapped?.[chainId]),
    loaded: chains.filter((chainId) => !!data.rulings?.[chainId]),
    missing: chains.filter((chainId) => !data.rulings?.[chainId]),
  }
}

/**
 * What the lists' verification record adds up to in a scope of chains: the
 * bounties above, plus how often anyone has disputed a request at all.
 *
 * Windows, said once: entries are every entry the lists have ever held,
 * while challenges and rulings are all time and never windowed. `challenged` is
 * every request someone disputed — the disputes the court has closed (the
 * ledger) plus the ones open right now — counted on `loaded` chains alone,
 * so one chain's open disputes are never added to another chain's missing
 * ledger. It reads as a lower bound ("n+") when `challengedPartial`. It
 * counts the retired Classic lists' disputes, because the entries it is set
 * against count their entries (every entry ever curated); the share of
 * disputes that went to the challenger does not (listedRulings above).
 */
export const scopedChallengeRecord = (
  data: DashboardData,
  chains: number[],
) => {
  const bounties = scopedBounties(data, chains)
  const openDisputes = data.openDisputes.filter((activity) =>
    bounties.loaded.includes(activity.chainId),
  ).length
  return {
    ...bounties,
    /** Requests anyone has disputed, all time: the rulings plus the open disputes. */
    challenged: bounties.rulings + openDisputes,
    /** A ledger capped, an open-dispute read at its limit, or a chain missing. */
    challengedPartial:
      bounties.capped ||
      bounties.loaded.some((chainId) => !!data.openDisputesCapped?.[chainId]) ||
      bounties.missing.length > 0,
  }
}

/**
 * Bounties won per challenger (lowercase address), all time, in a scope of
 * chains: how many of their challenges the court ruled for them.
 *
 * The retired Classic lists are left out, unlike the panel's own figures: a
 * figure attached to a PERSON has to match what their own profile page says
 * about them, and that page reads a load with no Classic in it. The
 * panel's figures describe the protocol's history, which is a different
 * question. Only two addresses span the two eras, so nothing visible
 * changes — which is the point.
 */
export const scopedWins = (
  data: DashboardData,
  chains: number[],
): Map<string, number> => {
  const wins = new Map<string, number>()
  for (const chainId of chains)
    for (const row of data.rulings?.[chainId] ?? [])
      if (row.kind !== 'classic' && row.challengerWon && row.challenger)
        wins.set(row.challenger, (wins.get(row.challenger) ?? 0) + 1)
  return wins
}

/**
 * Kleros Verified lists, newest to earn the badge first (the lists of
 * lists, which grant it, are not among them: countsAsVerifiedList).
 */
export const newestVerified = (
  registries: DashboardRegistry[],
): DashboardRegistry[] =>
  registries
    .filter(countsAsVerifiedList)
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
  const kind = registry.kind === 'standard' ? 16000 : 7000
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
  /** Submission or removal request (Standard). */
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
    activity.requestType === 'removal' ? 'removal requested' : 'submitted'
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

/* ---------- The chart's long ranges (round 7) ---------- */

/**
 * The chart's ranges: 30D is the load's own per-day series; the longer ones
 * bucket the whole history (data.ts fetchActivityHistory), by week for 6M
 * and 1Y and by month for 3Y. Three years is the longest (round 8): it
 * starts after a company wallet's bulk submissions of 2023, which no
 * curator ranking should carry, without singling out any address.
 */
export type ChartRange = '30d' | '6m' | '1y' | '3y'

/**
 * The chart ranges, as the switch over a chart names them (round 7), on the
 * dashboard and, since round 13, on a profile: one list, so the two read
 * alike.
 */
export const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: '30d', label: '30D' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '3y', label: '3Y' },
]

/** What each range's chart counts, over its legend. */
export const RANGE_LEGEND: Record<ChartRange, string> = {
  '30d': 'Per day · last 30 days',
  '6m': 'Per week · last 6 months',
  '1y': 'Per week · last year',
  '3y': 'Per month · last 3 years',
}

export const parseRange = (
  value: string | null,
  fallback: ChartRange,
): ChartRange =>
  RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as ChartRange)
    : fallback

export interface RangeSeries {
  /** Each bucket's start, in seconds, oldest first. */
  starts: number[]
  /** Requests (submissions and removal requests) per bucket. */
  up: number[]
  /** Challenges per bucket. */
  down: number[]
  unit: 'week' | 'month'
}

const WEEK = 7 * 86_400

/** The UTC Monday that starts the week holding `at` (seconds). */
const weekStart = (at: number) => {
  const day = Math.floor(at / 86_400) * 86_400
  const weekday = (new Date(day * 1000).getUTCDay() + 6) % 7
  return day - weekday * 86_400
}

/** The month index (years × 12 + month) of `at`, in UTC. */
const monthIndex = (at: number) => {
  const date = new Date(at * 1000)
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

const monthStart = (index: number) =>
  Date.UTC(Math.floor(index / 12), index % 12, 1) / 1000

/**
 * The history in buckets for one long range, the current bucket last (and
 * partial: the chart draws it dashed).
 */
export const historySeries = (
  events: { at: number; kind: 'submissions' | 'removals' | 'challenges' }[],
  range: Exclude<ChartRange, '30d'>,
  now: number,
): RangeSeries => {
  if (range === '6m' || range === '1y') {
    const count = range === '6m' ? 26 : 52
    const last = weekStart(now)
    const first = last - (count - 1) * WEEK
    const up = Array.from({ length: count }, () => 0)
    const down = Array.from({ length: count }, () => 0)
    for (const event of events) {
      const index = Math.floor((event.at - first) / WEEK)
      if (index < 0 || index >= count) continue
      if (event.kind === 'challenges') down[index] += 1
      else up[index] += 1
    }
    return {
      starts: Array.from({ length: count }, (_, i) => first + i * WEEK),
      up,
      down,
      unit: 'week',
    }
  }
  const last = monthIndex(now)
  const count = 36
  const first = last - (count - 1)
  const up = Array.from({ length: count }, () => 0)
  const down = Array.from({ length: count }, () => 0)
  for (const event of events) {
    const index = monthIndex(event.at) - first
    if (index < 0 || index >= count) continue
    if (event.kind === 'challenges') down[index] += 1
    else up[index] += 1
  }
  return {
    starts: Array.from({ length: count }, (_, i) => monthStart(first + i)),
    up,
    down,
    unit: 'month',
  }
}

/** Where a long range's first bucket starts, in seconds. */
export const rangeStart = (
  range: Exclude<ChartRange, '30d'>,
  now: number,
): number => historySeries([], range, now).starts[0] ?? now

/** A curator's figures over a range, from the history's events. */
export interface RangeCurator {
  address: string
  requests: number
  challenges: number
  lastActiveAt: number
}

/** Every curator's requests and challenges since `since`, on `chains`. */
export const curatorsSince = (
  events: {
    at: number
    chainId: number
    kind: 'submissions' | 'removals' | 'challenges'
    who?: string
  }[],
  since: number,
  chains: number[],
): RangeCurator[] => {
  const byAddress = new Map<string, RangeCurator>()
  for (const event of events) {
    if (!event.who || event.at < since || !chains.includes(event.chainId))
      continue
    const row = byAddress.get(event.who) ?? {
      address: event.who,
      requests: 0,
      challenges: 0,
      lastActiveAt: 0,
    }
    if (event.kind === 'challenges') row.challenges += 1
    else row.requests += 1
    row.lastActiveAt = Math.max(row.lastActiveAt, event.at)
    byAddress.set(event.who, row)
  }
  return [...byAddress.values()]
}
