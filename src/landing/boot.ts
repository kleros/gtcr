import { loadDashboardData } from 'pages/dashboard/data'
import type { DashboardRegistry } from 'pages/dashboard/types'
import {
  MAINNET_CHAIN_IDS,
  chainInfo,
  entryCount,
  formatUnits,
  scopedBounties,
  scopedFigures,
  scopedSeries,
} from 'pages/dashboard/view'
import { readRegistryMetadata } from 'utils/registry-metadata'
import { parseIpfs } from 'utils/ipfs-parse'

/*
 * Live figures for the standalone landing page (public/landing/landing.js).
 * The page draws the dated snapshot in public/landing/data.js at once and
 * swaps in this promise's figures when it answers. It is the app's
 * dashboard load (loadDashboardData) with the same scope ("All chains":
 * Ethereum and Gnosis) and the same figures (scopedFigures, scopedSeries,
 * scopedBounties), so both pages show the same numbers:
 *   - Kleros Verified by the one rule (components/curate/verified-rule.ts):
 *     the chain's Kleros lists of lists, Light and Classic, and the lists
 *     registered on any of them; the load stamps each list with it.
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

const DAY = 86_400

/** One coin challengers have won bounties in (never added across coins). */
export interface LandingBountyCoin {
  /** "<chainId>:native" or "<chainId>:<token address>", as scopedBounties keys it. */
  key: string
  chainId: number
  /** "Ethereum", "Gnosis". */
  chain: string
  /** Paid in a Stake list's token (the entry's stake), not the chain's coin. */
  stake: boolean
  symbol: string
  /** "30,690.1" (at most 4 decimals); absent when the token's decimals did not load. */
  amount?: string
  /** The same in whole coins, for the count-up. */
  value?: number
  /** Winning challenges paid in this coin. */
  won: number
  /** The UTC day (unix seconds / 86400) of each of those rulings, oldest first. */
  days: number[]
}

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
  /** Unresolved requests (Light and Classic; 0 on Stake lists). */
  open: number
}

/** The shape public/landing/data.js holds, plus `live`. */
export interface LandingData {
  live: true
  snapshotAt: string
  scope: string
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
  /** Bounties won by challengers, all time (the dashboard's "Bounties won"). */
  bounties: {
    won: number
    rulings: number
    /** A rulings ledger stopped at its page limit: every count is a lower bound. */
    capped: boolean
    coins: LandingBountyCoin[]
  }
}

const scopeName = (chains: number[]) =>
  chains
    .map((chainId) => chainInfo(chainId)?.name)
    .filter(Boolean)
    .join(' and ')

/** Resolves to null once `ms` has passed. */
const withinBudget = <T>(promise: Promise<T>, ms: number) =>
  Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])

/** "Registry 0x12ab...cdef": the indexer had no title for the list. */
const FALLBACK_TITLE = /^(permanent )?registry 0x[0-9a-f]{4}/i

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

const readLive = async (): Promise<LandingData | null> => {
  const chains = MAINNET_CHAIN_IDS
  // All chains (no testnet), no list metadata for every list (the page
  // needs counts), the challenge periods to place open requests.
  const data = await loadDashboardData({
    refreshCreationTimes: false,
    chains,
    enrichMetadata: false,
    challengeWindows: true,
  })
  // Any failed or timed-out query (the rulings ledger included) makes the
  // figures partial: rather than label partial numbers as live, the page
  // keeps the dated snapshot. So does a 30-day window cut at its page cap.
  if (data.failedChains.length > 0 || data.seriesTruncated) return null
  const series = scopedSeries(data, chains)
  if (series.length < 2 || data.registries.length === 0) return null
  const bounties = scopedBounties(data, chains)
  if (bounties.missing.length > 0) return null

  // Kleros Verified as the load stamped it (the shared rule).
  const registries = data.registries.filter((registry) =>
    chains.includes(registry.chainId),
  )
  const figures = scopedFigures(data, chains)
  const verified = registries.filter(
    (registry) => registry.trustStatus === 'verified',
  )

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

  // The day of each winning ruling, per coin, for the ledger drawing.
  const days = new Map<string, number[]>()
  for (const chainId of chains)
    for (const row of data.rulings[chainId] ?? []) {
      if (!row.challengerWon) continue
      const key = `${chainId}:${row.token ?? 'native'}`
      const list = days.get(key) ?? []
      list.push(Math.floor(row.resolvedAt / DAY))
      days.set(key, list)
    }

  return {
    live: true,
    snapshotAt: new Date(data.generatedAt).toISOString(),
    scope: scopeName(chains),
    figures: {
      registries: figures.registries,
      verified: figures.verified,
      community: registries.filter(
        (registry) => registry.trustStatus === 'unverified',
      ).length,
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
    bounties: {
      won: bounties.won,
      rulings: bounties.rulings,
      capped: bounties.capped,
      coins: bounties.coins.map((coin) => ({
        key: coin.key,
        chainId: coin.chainId,
        chain: chainInfo(coin.chainId)?.name ?? `Chain ${coin.chainId}`,
        stake: !!coin.token,
        symbol: coin.symbol,
        amount:
          coin.decimals === undefined
            ? undefined
            : formatUnits(coin.amount, coin.decimals),
        value: coin.value,
        won: coin.won,
        days: (days.get(coin.key) ?? []).sort((a, b) => a - b),
      })),
    },
  }
}

/** A list logo's URL: IPFS paths through the app's gateway, URLs as they are. */
const mediaUrl = (uri?: unknown): string | null => {
  if (typeof uri !== 'string' || !uri.trim()) return null
  if (/^https?:\/\//i.test(uri)) return uri
  return /^(\/?ipfs\/|ipfs:\/\/)/i.test(uri) ? parseIpfs(uri) : null
}

declare global {
  interface Window {
    CURATE_LANDING_LIVE?: Promise<LandingData | null>
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
