import { loadDashboardData } from 'pages/dashboard/data'
import { DASHBOARD_QUERY_KEY, DASHBOARD_STALE_MS } from 'pages/dashboard/query'
import { readSavedLoad, saveLoad } from 'pages/dashboard/saved-load'
import type { DashboardRegistry } from 'pages/dashboard/types'
import {
  MAINNET_CHAIN_IDS,
  entryCount,
  scopedFigures,
  scopedSeries,
} from 'pages/dashboard/view'
import { readRegistryMetadata } from 'utils/registry-metadata'
import { landingMoney, readTransit, type LandingMoney } from './money'
import { ipfsImageUrl } from 'utils/ipfs-parse'
import {
  countsAsCommunityList,
  countsAsVerifiedList,
} from 'components/curate/verified-rule'

/*
 * Live figures for the standalone landing page (public/landing/landing.js).
 * The page draws the dated snapshot in public/landing/data.js at once and
 * swaps in this promise's figures when it answers. It is the app's
 * dashboard load (loadDashboardData) with the same scope ("All chains":
 * Ethereum and Gnosis) and the same figures (scopedFigures, scopedSeries),
 * so both pages show the same numbers, plus the landing's own two dollar
 * figures (money.ts, round 14):
 *   - Kleros Verified by the one rule (components/curate/verified-rule.ts):
 *     the lists registered on the chain's Kleros list of lists (the list of
 *     lists itself grants the badge and is not counted among them); the
 *     load stamps each list with it.
 *   - Challenges per day on the day each challenge was made, including
 *     challenges to requests made before the window.
 * The Kleros Verified lists themselves come along (name, logo, chain), each
 * leading to its list. No React: this module and its imports are plain
 * reads. On any failure, or past its budget, it resolves to null and the
 * snapshot stays.
 */

/*
 * A cold load reads the main query, the 30-day curator pages, the all-time
 * rulings ledger and the challenge periods (about 6 to 9 s measured). The
 * snapshot is on screen meanwhile, labelled as such, so a slow answer only
 * arrives late.
 */
const LIVE_BUDGET_MS = 14000
/** List logos and names: a short wait; a list without one shows a glyph. */
const METADATA_BUDGET_MS = 4000
/**
 * The dollar figures wait at most this long from the start of the read,
 * inside LIVE_BUDGET_MS: past it they keep the snapshot's, and the other
 * figures still go live.
 */
const MONEY_BUDGET_MS = LIVE_BUDGET_MS - 1000

/** A Kleros Verified list, as the landing shows it. */
export interface LandingVerifiedList {
  chainId: number
  /** Lowercase; the list's page is /tcr/<chainId>/<address>. */
  address: string
  kind: DashboardRegistry['kind']
  title: string
  /** The logo's IPFS path ("/ipfs/<cid>/…") or URL, as the list published it. */
  logo?: string
  /** Every entry the list holds (its registry page's figure). */
  entries: number
  /** Unresolved requests (Standard; 0 on Stake lists). */
  open: number
}

/** The shape public/landing/data.js holds, plus `live`. */
export interface LandingData {
  live: true
  snapshotAt: string
  figures: {
    registries: number
    /** Kleros Verified lists, by the shared rule. */
    verified: number
    /** Every other list. */
    community: number
    entries: number
    requestsOpen: number
    /** Unresolved requests nobody has challenged. */
    unchallenged: number
    unchallengedCapped: boolean
    /** Of those, still inside their challenge period; absent when unknown. */
    openForVerification?: number
    inCourt: number
    curators30d: number
  }
  /** Most open requests first, then most entries. */
  verifiedLists: LandingVerifiedList[]
  series30d: { day: number; requests: number; challenges: number }[]
  /**
   * The two dollar figures (rounds 14 and 15, money.ts): bounties
   * challengers have won and everything paid in to a list, all time, at
   * today's prices. A figure that could not be read live is the
   * snapshot's.
   */
  money: Partial<LandingMoney>
}

/** Resolves to null once `ms` has passed. */
const withinBudget = <T>(promise: Promise<T>, ms: number) =>
  Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])

/** "List 0x12ab…cdef": the indexer had no title for the list. */
const FALLBACK_TITLE = /^(stake )?list 0x[0-9a-f]{4}/i

/** Names and logos the indexer lacks, from each list's MetaEvidence. */
const withMetadata = async (
  lists: LandingVerifiedList[],
  registries: DashboardRegistry[],
): Promise<LandingVerifiedList[]> => {
  const byKey = new Map(
    registries.map((registry) => [
      `${registry.chainId}:${registry.address.toLowerCase()}`,
      registry,
    ]),
  )
  return Promise.all(
    lists.map(async (list) => {
      if (list.logo && !FALLBACK_TITLE.test(list.title)) return list
      const registry = byKey.get(`${list.chainId}:${list.address}`)
      const metadata = await withinBudget(
        readRegistryMetadata(registry?.metadataURI).catch(() => null),
        METADATA_BUDGET_MS,
      )
      if (!metadata) return list
      return {
        ...list,
        title:
          FALLBACK_TITLE.test(list.title) && metadata.title
            ? metadata.title
            : list.title,
        logo: list.logo || metadata.logoURI || undefined,
      }
    }),
  )
}

/** This page's own load (no list metadata), kept apart from the app's. */
const LANDING_LOAD = 'landing'

/**
 * The live dollar figures, with the snapshot's (public/landing/data.js) in
 * place of one that did not come back.
 */
const withSnapshotMoney = (
  live: Partial<LandingMoney>,
): Partial<LandingMoney> & { dated: string[] } => {
  const snapshot = window.CURATE_LANDING_DATA?.money ?? {}
  return {
    // The figures taken from the snapshot keep its date and its day's
    // prices on the page (landing.js), though the rest of it is live.
    dated: [
      ...(live.bounties === undefined ? ['bounties'] : []),
      ...(live.transit === undefined ? ['transit'] : []),
    ],
    ...(live.bounties === undefined
      ? {
          bounties: snapshot.bounties,
          bountiesPaid: snapshot.bountiesPaid,
          bountiesCapped: snapshot.bountiesCapped,
        }
      : {}),
    ...(live.transit === undefined
      ? { transit: snapshot.transit, requests: snapshot.requests }
      : {}),
    ...live,
  }
}

const readLive = async (): Promise<LandingData | null> => {
  const started = Date.now()
  const chains = MAINNET_CHAIN_IDS
  // Everything paid in to a list, all time: read beside the dashboard
  // load, which it does not need. Its coin totals are kept across page
  // loads and shared with the app's dashboard (transit.ts readTransit), so
  // a visit within the hour reads storage, not the indexer.
  const transit = readTransit(chains)
  transit.catch(() => undefined)
  // All chains (no testnet), no list metadata for every list (the page
  // needs counts), the challenge periods to place open requests.
  // The same read the app's dashboard makes (with list metadata on top): a
  // load either page saved in the last few minutes is used as it is.
  const saved = (
    await Promise.all([
      readSavedLoad(DASHBOARD_QUERY_KEY[1]),
      readSavedLoad(LANDING_LOAD),
    ])
  ).find((load) => load && Date.now() - load.generatedAt < DASHBOARD_STALE_MS)
  const data =
    saved ??
    (await loadDashboardData({
      refreshCreationTimes: false,
      chains,
      enrichMetadata: false,
      challengeWindows: true,
    }))
  if (!saved) saveLoad(LANDING_LOAD, data)
  // Any failed or timed-out query (the rulings ledger included) makes the
  // figures partial: rather than label partial numbers as live, the page
  // keeps the dated snapshot. So does a 30-day window cut at its page cap.
  if (data.failedChains.length > 0 || data.seriesTruncated) return null
  const series = scopedSeries(data, chains)
  if (series.length < 2 || data.registries.length === 0) return null
  // The dollar figures, each on its own (money.ts): one that cannot be read
  // or priced in time keeps the snapshot's, and the other figures still go
  // live. Read beside the list metadata below.
  const moneyRead = withinBudget(
    landingMoney(data, chains, transit),
    Math.max(0, started + MONEY_BUDGET_MS - Date.now()),
  )

  // Kleros Verified as the load stamped it (the shared rule).
  const registries = data.registries.filter((registry) =>
    chains.includes(registry.chainId),
  )
  const figures = scopedFigures(data, chains)
  const verified = registries.filter(countsAsVerifiedList)

  const verifiedLists = await withMetadata(
    verified
      .map(
        (registry): LandingVerifiedList => ({
          chainId: registry.chainId,
          address: registry.address.toLowerCase(),
          kind: registry.kind,
          title: registry.title,
          logo: registry.logoURI || undefined,
          entries: entryCount(registry),
          open: registry.kind === 'permanent' ? 0 : registry.pendingCount,
        }),
      )
      .sort(
        (a, b) =>
          b.open - a.open ||
          b.entries - a.entries ||
          a.title.localeCompare(b.title),
      ),
    registries,
  )

  const money = withSnapshotMoney((await moneyRead) ?? {})

  return {
    live: true,
    snapshotAt: new Date(data.generatedAt).toISOString(),
    figures: {
      registries: figures.registries,
      verified: figures.verified,
      community: registries.filter(countsAsCommunityList).length,
      entries: figures.entries,
      requestsOpen: figures.requestsOpen,
      unchallenged: figures.unchallenged,
      unchallengedCapped: figures.unchallengedCapped,
      ...(figures.windowsKnown && !figures.unchallengedCapped
        ? { openForVerification: figures.inWindow }
        : {}),
      inCourt: figures.inCourt,
      curators30d: figures.curators,
    },
    verifiedLists,
    series30d: series.map((day) => ({
      day: day.day,
      requests: day.submissions + day.removals,
      challenges: day.challenges,
    })),
    money,
  }
}

/** A list logo's URL, on the app's IPFS gateway only (ipfsImageUrl). */
const mediaUrl = (uri?: unknown): string | null => ipfsImageUrl(uri) ?? null

declare global {
  interface Window {
    CURATE_LANDING_LIVE?: Promise<LandingData | null>
    /** The dated snapshot (public/landing/data.js); only its money is read. */
    CURATE_LANDING_DATA?: { money?: Partial<LandingMoney> }
    /** Resolves a logo path for the page (the snapshot's logos too). */
    CURATE_LANDING_MEDIA?: (uri?: unknown) => string | null
  }
}

window.CURATE_LANDING_MEDIA = mediaUrl
window.CURATE_LANDING_LIVE = Promise.race([
  readLive().catch(() => null),
  new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), LIVE_BUDGET_MS),
  ),
])
