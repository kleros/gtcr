import React, { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import { ipfsImageUrl } from 'utils/ipfs-parse'
import { formatAgo } from 'utils/time'
import { CurateIcon } from 'components/curate/icons'
import { useLaunchChainId } from 'components/layout/launch-chain'
import ChainLogo from 'components/chain-logo'
import {
  ButtonLink,
  ChainChip,
  HeroStatement,
  Label,
  Page,
  SegmentedControl,
  SkeletonBlock,
  Small,
  Surface,
  Table,
  TableScroller,
  VisuallyHidden,
  truncateMiddle,
} from 'components/curate/primitives'
import { ActivityWave } from 'components/curate/motion/activity-wave'
import { LaneBar } from 'components/curate/lane-bar'
import { Odometer } from 'components/curate/motion/odometer'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { reveal } from 'components/curate/motion/reveal'
import RotatingWord from 'components/curate/rotating-word'
import { VerifiedBadge } from 'components/curate/verified-badge'
import { KindTag } from 'components/curate/stake-tag'
import { getNativeCurrency } from 'config/chains'
import {
  completeChallengeWindows,
  readActivityHistory,
  fetchDashboardData,
  fetchTestnetDashboardData,
  loadRulingCards,
} from './data'
import {
  DASHBOARD_QUERY_KEY,
  dashboardRefreshIn,
  DASHBOARD_STALE_MS,
  TESTNET_DASHBOARD_QUERY_KEY,
  isLiveLoad,
} from './query'
import { useMediaQuery } from 'pages/guide/hooks'
import { useSavedLoadsReady } from './saved-load'
import { useUsdPrices } from './use-usd-prices'
import { readTransit, totalInDollars } from './transit'
import { LiveBoard, type RulingsView } from './happening-now'
import { OpenForVerification } from './open-for-verification'
import type { OpenListChip } from './board-rows'
import { SectionHead, SectionTitle } from './section'
import { HeroMoney, VerificationRecord } from './bounties'
import { VerifiedLists } from './verified-lists'
import { LoadStatePill, loadState } from './live-pill'
import type {
  DashboardActivity,
  DashboardData,
  DashboardRegistry,
  RulingRow,
} from './types'
import {
  TESTNET_CHAIN_IDS,
  buildBoard,
  scopeChains,
  chainInfo,
  entryCount,
  formatUnits,
  registryHref,
  newestVerified,
  rulingCard,
  scopedChallengeRecord,
  scopedFigures,
  scopedRulings,
  scopedSeries,
  scopedWins,
  historySeries,
  curatorsSince,
  RANGE_LEGEND,
  RANGE_OPTIONS,
  rangeStart,
  type ChartRange,
  sortRegistries,
  toAmount,
  windowsPending,
  type ChainFilter,
  type DashboardCard,
} from './view'
import { Avatar as ListLogo } from 'pages/browse/avatar'

/*
 * Dashboard: a short statement, one strip of live figures over the 30-day
 * wave, then the self-sustaining mechanism, what is happening now — the
 * money anyone can go and claim, then two columns beside each other — the
 * Kleros Verified lists, and the most active registries and curators. Every
 * figure comes from the indexers or the chain.
 *
 * Round 3 set that order and round 4 closed it up. The 30-day chart and the
 * record of how the lists sustain themselves are the two boxes a reader
 * meets first, because they say whether any of this works. Then one section,
 * "Happening now": the figures of what is open for verification
 * (open-for-verification.tsx), and under them the board they belong to — the
 * submissions on one side, the disputes and the rulings on the other
 * (happening-now.tsx). Those figures had a section and a 30px heading of
 * their own until round 4, which read as dropped between two boxes they
 * belong to neither of; they describe the submissions column, so they sit
 * on top of it.
 *
 * Each section that owns a file heads itself and holds its own skeletons
 * (open-for-verification.tsx, happening-now.tsx, bounties.tsx), so no
 * heading waits on a load.
 *
 * Round 4 also gave two of those figures — the bounties challengers have won,
 * and the collateral behind the requests open for verification — what they are
 * worth in dollars, read from a Chainlink feed on each coin's own chain
 * (prices.ts) in a query of its own, never in the load the page saves. Round
 * 5 puts those dollars first: where a feed answers they lead the figure and
 * the exact coin amount sits under them, and where no price can be read the
 * coin amount is the figure, as before. They are the only two on the site
 * that carry a dollar value: a figure somebody is about to sign for keeps its
 * coin alone, and nothing adds dollars across coins (DESIGN.md, Data rules).
 *
 * Round 1, item 7: the "Entries by chain" ring is gone. On several chains
 * it drew two segments whose leader the hero's own Entries figure already
 * implied; on one chain it turned into "Entries by list" and repeated the
 * Most active table's entries column. Nobody could act on either.
 */

const integer = new Intl.NumberFormat('en-US')
const formatInt = (value: number) => integer.format(Math.round(value))
const plural = (value: number, one: string, many: string) =>
  `${formatInt(value)} ${value === 1 ? one : many}`

/**
 * Rulings the Disputes box is handed first, and how many more each "show
 * more" adds. Beside the submissions it draws the whole rows that fit the
 * height they set (happening-now.tsx), so it is handed more than ever fit:
 * four fit under three rows in court at 1440, about eight with none. Alone
 * on the board (nothing open) the first page is these too, two to a line.
 */
const RULINGS_FIRST = 8
const RULINGS_STEP = 8
/**
 * With nothing in court, the rulings are the whole right column: a longer
 * first page fills the height the submissions column sets with rows, as far
 * as the scope has rulings to fill it with (happening-now.tsx).
 */
const RULINGS_FIRST_QUIET = 12
/**
 * In one column (below 900px) every ruling handed in is drawn, so the first
 * page is the short one it was: 4 under rows in court, 8 with none.
 */
const RULINGS_FIRST_STACKED = 4
const RULINGS_FIRST_STACKED_QUIET = 8

const RANGE_WORDS: Record<ChartRange, string> = {
  '30d': 'per day over the last 30 days, today so far included',
  '6m': 'per week over the last 6 months, this week so far included',
  '1y': 'per week over the last year, this week so far included',
  '3y': 'per month over the last 3 years, this month so far included',
}

/** Top curators' window, as their label names it (round 8: the range's). */
const RANGE_SPAN: Record<ChartRange, string> = {
  '30d': 'last 30 days',
  '6m': 'last 6 months',
  '1y': 'last year',
  '3y': 'last 3 years',
}

/** Curators beside the chart: few, so the panel keeps the chart's height. */
const TOP_CURATORS = 5

/** A logo, on the IPFS gateway only (ipfsImageUrl says why). */
const mediaUrl = (uri?: string | null): string | null =>
  ipfsImageUrl(uri) ?? null

/* ---------- Hero (YMax composition) ---------- */

/*
 * Left-aligned since the headline's first line ends in a word that changes
 * (Fortunato, 20 Nov: centred, the whole line slid sideways at each word).
 * The money sits on the right, beside the "earn" it backs; at 820px and
 * under (a portrait tablet, a phone) it moves below the buttons, its two
 * figures side by side. A phone held sideways (844 to 932px) keeps both
 * columns, so the figures stay in view.
 */
const Hero = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 40px clamp(40px, 6vw, 96px);
  /* Starts where every page does: Page's own top padding, nothing more. */
  padding: 0 0 8px;

  @media (max-width: 820px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const HeroMain = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 22px;
  min-width: 0;

  > * {
    ${reveal}
  }
`

const HeroAside = styled.div`
  min-width: 0;
  ${reveal}

  /* Nothing to show (a testnet whose rulings did not load): no column. */
  &:empty {
    display: none;
  }

  /* Wide enough for the figures, never for a long note: a note wraps
     rather than squeezing the headline. */
  @media (min-width: 821px) {
    min-width: 220px;
    max-width: 300px;
  }
`

/*
 * Round 11: the title names both ways in, one per line. Since 20 Nov 2026
 * the first runs through examples of what can be verified (RotatingWord,
 * HERO_WORDS) and rests on "anything"; the accent marks that word and
 * "earn". It is a sentence, not a slogan, so it is set smaller than
 * --fs-hero (84px would wrap it to five lines); the second clause wraps on
 * its own, balanced, on a phone.
 */
const Headline = styled(HeroStatement)`
  max-width: 24ch;
  font-size: clamp(34px, 3.4vw + 14px, 64px);
  line-height: 1.02;

  /* Each clause on its own line. The first never wraps, so the changing
     word cannot push the second line down. */
  > [data-line] {
    display: block;
    text-wrap: balance;
  }

  > [data-line='first'] {
    white-space: nowrap;
  }
`

/*
 * The examples the headline runs through, once: the kinds of entry the
 * largest lists hold first, then a wider one, resting on "anything".
 */
const HERO_WORDS = [
  'tokens',
  'contracts',
  'domains',
  'addresses',
  'markets',
  'documents',
  'anything',
] as const

const Lede = styled.p`
  margin: 0;
  max-width: 54ch;
  color: var(--color-muted);
  font-size: 18px;
  line-height: 28px;
  text-wrap: balance;
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 10px;
  margin-top: 6px;
`

/*
 * Round 7, on trial ("the top curators could go next to the initial chart
 * … on the right"): the panel holds the figures and the chart, and beside
 * them, behind a hairline, the top four curators over the chart's range,
 * each with an LED bar of their activity against the top curator's, so the
 * panel keeps the chart's height (round 8). Below 900px they stack.
 */
const Featured = styled(Surface)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  margin-top: 64px;
  padding: 28px 28px 20px;
  ${reveal}

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr) 260px;
  }

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }

  @media (max-width: 720px) {
    padding: 20px 16px 16px;
  }
`

const FeaturedMain = styled.div`
  min-width: 0;
`

const CuratorsAside = styled.section`
  display: flex;
  flex-direction: column;
  min-width: 0;

  /* A curator's counts stay on one line under the bar. */
  a [data-counts] {
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  margin-left: 28px;
  padding-left: 24px;
  border-left: 1px solid var(--glass-border);

  @media (max-width: 1100px) {
    margin-left: 20px;
    padding-left: 18px;
  }

  @media (max-width: 900px) {
    margin: 20px 0 0;
    padding: 20px 0 0;
    border-left: 0;
    border-top: 1px solid var(--glass-border);
  }
`

/* A curator's bar, under the address. */
const CuratorBar = styled.span`
  display: block;
  margin: 8px 0 6px;
`

/* The chart's head (round 9): its legend on the left, the range switch on
   the right (round 7: the chain switch it replaced is hidden; the page is
   always every mainnet), right above the chart it sets. */
const ScopeBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-bottom: 8px;
`

const FeaturedTop = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 24px 40px;
  margin-bottom: 20px;
`

const HeadlineFigure = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const InlineStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px 36px;
  margin-right: auto;
  padding-bottom: 6px;
`

const InlineStat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 18px;
    line-height: 22px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

const SeriesLegend = styled.ul`
  display: flex;
  gap: 18px;
  margin: 0;
  padding: 0 0 6px;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-muted);
    font-size: 13px;
  }

  i {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    box-shadow: 0 0 10px currentColor;
  }
`

const Big = styled.span<{ $hero?: boolean }>`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: ${({ $hero }) =>
    $hero
      ? 'clamp(48px, 3.6vw + 24px, 80px)'
      : 'clamp(30px, 1.6vw + 20px, 44px)'};
  line-height: 0.95;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
`

/* ---------- Sections ---------- */

/*
 * The two columns of the "Happening now" board. The section opens at the full
 * 80px its heading carries (section.ts), and what holds the three parts
 * together is the strip between them: the figures of what is open for
 * verification sit 16px above these columns (open-for-verification.tsx's
 * Band), so the heading, the figures and the rows those figures count read as
 * one block.
 */
/* The 80px a section heading carries (section.ts), for the board's section,
   whose title is the Open for verification band's own. */
const BoardOpening = styled.div`
  margin-top: 80px;
`

/* Most active takes the page's width (round 7 trial: Top curators moved
   beside the chart). */
const ActiveFrame = styled(TableScroller)``

/*
 * The curators' rows share what the panel has beyond their own height, each
 * at most 88px tall: a short list keeps its rows near their size and leaves
 * the rest under them rather than spread rows apart.
 */
const CuratorList = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  margin-top: 8px;

  > a {
    flex: 1 0 auto;
    max-height: 88px;
  }
`

/*
 * Phones: identity on the left, Entries and Open on the right in tabular
 * figures; Chain moves under the name and In court gives way, so nothing
 * hides behind a sideways scroll.
 */
const ActiveTable = styled(Table)`
  .phone-only {
    display: none;
  }

  @media (max-width: 720px) {
    min-width: 0;
    table-layout: fixed;

    th:nth-child(2),
    td:nth-child(2),
    th:nth-child(5),
    td:nth-child(5) {
      display: none;
    }

    th.num,
    td.num {
      width: 76px;
      padding: 0 12px;
    }

    th:first-child,
    td:first-child {
      padding-right: 4px;
    }

    .phone-only {
      display: inline-flex;
    }
  }
`

const RowMeta = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const RegistryCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

const NameLine = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`

const RegistryName = styled(Link)`
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-weight: 500;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--color-primary);
  }
`

const SeeAll = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  font-weight: 500;
  text-decoration: none;

  &:hover {
    color: var(--color-text);
  }
`

/* The panel's two columns and their windows, said once. */
const CuratorsHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  flex-wrap: wrap;
`

const CuratorRow = styled(Link)`
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--glass-border);
  color: inherit;
  text-decoration: none;

  &:last-child {
    border-bottom: 0;
  }

  &:hover strong {
    color: var(--color-primary);
  }

  strong {
    display: block;
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
  }
`

const Rank = styled.span`
  color: var(--color-muted);
  font-family: var(--font-figure);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
`

/* A curator's bounties won, all time: the bounty glyph lights when any. */
const Won = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  svg {
    color: var(--status-window);
  }

  &[data-none] {
    color: var(--color-muted);
    font-weight: 400;

    svg {
      color: var(--color-faint);
    }
  }
`

const EmptyNote = styled.p`
  margin: 12px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const ChartEmpty = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  border-top: 1px solid var(--glass-border);
  color: var(--color-muted);
  font-size: var(--fs-small);
`

/** A board row with its list's logo, best known name and trust seal. */
const withRegistry = (
  card: DashboardCard,
  lists: Map<string, DashboardRegistry>,
): DashboardCard => {
  const registry = lists.get(`${card.chainId}:${card.registryAddress}`)
  return {
    ...card,
    registry:
      registry?.title || card.registry || truncateMiddle(card.registryAddress),
    logo: mediaUrl(registry?.logoURI),
    verified: registry?.trustStatus === 'verified',
  }
}

/**
 * "30 xDAI": what the challenger won on a ruling, when they won. The ledger's
 * amount goes through the same guard as every other indexer amount (toAmount:
 * a malformed one is no amount rather than a crash in this render), and a
 * win that paid nothing has no label: a list that asks no base deposit, or a
 * Stake entry with no stake, leaves no bounty to take, so the row shows only
 * the ruling and its age rather than "0 xDAI".
 */
const bountyLabel = (
  row: RulingRow,
  tokens: DashboardData['tokens'],
): string | undefined => {
  if (!row.challengerWon) return undefined
  const coin = row.token
    ? tokens[`${row.chainId}:${row.token}`]
    : getNativeCurrency(row.chainId)
  if (!coin) return undefined
  const amount = toAmount(row.bounty)
  if (amount === 0n) return undefined
  return `${formatUnits(amount, coin.decimals)} ${coin.symbol}`
}

const RegistryLogo = ({ registry }: { registry: DashboardRegistry }) => (
  <ListLogo uri={registry.logoURI} seed={registry.address} size={34} />
)

const Dashboard = () => {
  useDocumentHead(
    'Kleros Curate',
    'Browse Kleros Curate lists, follow entries in a challenge window or in court, and earn by challenging entries that break a list policy.',
  )
  const navigate = useNavigate()
  // Always every mainnet (round 7: "just leave all chain and hide the
  // possibility of browsing per chain for now"). The scopes stay wired
  // through the page, so the chain switch can come back.
  const chain: ChainFilter = 'all'
  // The chart opens on six months (round 16: "the standard timeframe
  // should be 6m"); 30 days is one click away.
  const [range, setRange] = useState<ChartRange>('6m')
  const now = useNow(30_000)
  const launchChain = useLaunchChainId()
  // The board's one-column width (happening-now.tsx STACKED).
  const stackedBoard = useMediaQuery('(max-width: 900px)')

  // Every scope is either the mainnets ("All chains" or one of them) or the
  // Sepolia testnet alone: the testnet is its own load, read only when chosen.
  const testnetScope = chain !== 'all' && TESTNET_CHAIN_IDS.includes(chain)
  const loadKey = testnetScope
    ? TESTNET_DASHBOARD_QUERY_KEY
    : DASHBOARD_QUERY_KEY
  // A load saved by an earlier page load is looked up first (saved-load.ts).
  const savedReady = useSavedLoadsReady()
  const query = useQuery({
    queryKey: loadKey,
    queryFn: testnetScope ? fetchTestnetDashboardData : fetchDashboardData,
    enabled: savedReady,
    staleTime: DASHBOARD_STALE_MS,
    refetchInterval: dashboardRefreshIn,
    // Back from another tab: refresh only a load older than the stale time.
    refetchOnWindowFocus: true,
  })
  const data = query.data
  const loading = query.isLoading || !data

  /*
   * When a load could not place every challenge window in time (a slow or
   * failing node), read them once more on its own, outside the load's
   * budget, and fill the result into the dashboard's data: the guide's
   * live figure reads the same query.
   */
  const queryClient = useQueryClient()
  const windowsMissing =
    !!data &&
    Object.keys(data.unchallengedRows ?? {}).some((chainId) =>
      windowsPending(data, Number(chainId)),
    )
  const windowsRetry = useQuery({
    queryKey: ['curateDashboardWindows', data?.generatedAt],
    queryFn: async () => {
      if (!data) return false
      const next = await completeChallengeWindows(data)
      queryClient.setQueryData<DashboardData>(loadKey, (current) =>
        current?.generatedAt === data.generatedAt ? next : current,
      )
      return true
    },
    enabled: windowsMissing,
    staleTime: Infinity,
    retry: false,
  })
  const checkingWindows = windowsMissing && windowsRetry.isFetching

  const chains = useMemo(() => scopeChains(chain), [chain])
  // The history since the 3Y range's start, kept across page loads (data.ts
  // readActivityHistory): Top curators and the chart over 6M, 1Y and 3Y,
  // which the page opens on. It is read alongside the page's own load, not
  // after it: its pages travel in requests of their own (the indexer's
  // background lane), so they never hold the load back, and the chart no
  // longer waits for the two one after the other. Not retried as a whole:
  // each failed page was already asked twice, and a retry would walk every
  // page again on the indexer's shared limit.
  const history = useQuery({
    queryKey: ['dashboardHistory', chains.join(',')],
    queryFn: () => readActivityHistory(chains),
    enabled: savedReady,
    staleTime: 30 * 60_000,
    retry: false,
  })
  // Everything paid in to a list, all time, at today's prices (round 15:
  // "this number can be smashed also somewhere in the dashboard"; round 19:
  // in the Self-sustaining mechanism). Its own query, read alongside the
  // main load (in the indexer's background lane, as the history): never in
  // the saved load, whose prices would be repainted a day old
  // (use-usd-prices.ts). The coin totals are kept across page loads
  // (transit.ts readTransit) and priced again on every read; a token the
  // load has not named yet is read by totalInDollars. Never on a testnet,
  // whose coins have no price.
  const transit = useQuery({
    queryKey: ['dashboardTransit', chains.join(',')],
    queryFn: async () => {
      const read = await readTransit(chains)
      const known = queryClient.getQueryData<DashboardData>(loadKey)?.tokens
      return {
        usd: await totalInDollars(Object.values(read.totals), known),
        requests: read.requests,
      }
    },
    enabled: savedReady && !testnetScope,
    staleTime: 10 * 60_000,
    // The coin totals are kept (readTransit), so a retry reads prices again,
    // not the indexer's pages.
    retry: 1,
  })
  // Links to Browse keep the page's scope. "All chains" is Browse's own
  // default, no `chain` parameter (DESIGN.md, Data rules): spelled out as
  // ?chain=1,100 it read as a custom choice of two chains there.
  const browseHref = (params = '') => {
    const query = [params, chain === 'all' ? '' : `chain=${chain}`]
      .filter(Boolean)
      .join('&')
    return query ? `/browse?${query}` : '/browse'
  }
  const scoped = useMemo(
    () => (data?.registries ?? []).filter((r) => chains.includes(r.chainId)),
    [data, chains],
  )
  // Browse's Stake lists in scope, when there are any: they never close to
  // challenge, so the strip and the board point there when nothing else is
  // open.
  const stakeHref = scoped.some((registry) => registry.kind === 'permanent')
    ? browseHref('trust=all&kind=permanent')
    : undefined
  // Those lists by the entries anyone can challenge on them right now: listed
  // (submitted or in court, the subgraph's own sum) less the ones in court.
  // Most first, each to its own page: the strip's bar when nothing else is
  // open.
  const stakeLists = useMemo(
    () =>
      scoped
        .filter((registry) => registry.kind === 'permanent')
        .map(
          (registry): OpenListChip => ({
            key: `${registry.chainId}:${registry.address}`,
            title: registry.title || truncateMiddle(registry.address),
            logo: mediaUrl(registry.logoURI),
            count: Math.max(0, registry.pendingCount - registry.disputeCount),
            href: registryHref(registry),
          }),
        )
        .filter((list) => list.count > 0)
        .sort((a, b) => b.count - a.count),
    [scoped],
  )

  /** Every figure on the page describes the same scope. */
  const figures = useMemo(
    () => (data ? scopedFigures(data, chains, now) : undefined),
    [data, chains, now],
  )

  // Every list by chain and address: rows wear its logo, name and seal.
  const lists = useMemo(
    () =>
      new Map(
        (data?.registries ?? []).map((registry) => [
          `${registry.chainId}:${registry.address}`,
          registry,
        ]),
      ),
    [data],
  )

  const board = useMemo(() => {
    if (!data)
      return {
        open: [],
        openLists: [] as OpenListChip[],
        live: [],
      }
    const withList = (cards: DashboardCard[]) =>
      cards.map((card) => withRegistry(card, lists))
    const built = buildBoard(data, now, chains)
    return {
      open: withList(built.open),
      // Each list's own page, filtered to its open requests, oldest first.
      openLists: built.openLists.map((list) => {
        const registry = lists.get(`${list.chainId}:${list.registry}`)
        return {
          key: `${list.chainId}:${list.registry}`,
          title: registry?.title || truncateMiddle(list.registry),
          logo: mediaUrl(registry?.logoURI),
          count: list.count,
          href: `/tcr/${list.chainId}/${list.registry}?submitted=true&removalRequested=true&oldestFirst=true`,
        }
      }),
      live: withList(built.live),
    }
  }, [data, now, chains, lists])

  /**
   * The self-sustaining mechanism, all time, in the page's scope: how rarely a
   * request is challenged at all, how the court ruled when one was, and the
   * bounties the challengers took. The entries ever curated and the bounties
   * count the retired Classic lists too (round 4: "only for this"), and the
   * panel's own line names them; the court's share is taken on the rulings
   * the Disputes panel below can list, so the two read the same count.
   */
  const record = useMemo(
    () => (data ? scopedChallengeRecord(data, chains) : undefined),
    [data, chains],
  )

  /*
   * What those bounties and the collateral in the strip are worth in dollars,
   * from a Chainlink feed on each coin's own chain. Its own query, never part
   * of the load: the load is saved to IndexedDB and repainted on the next
   * visit, and a price repainted a day later would be a figure stating
   * something nobody read. Two figures on the page take it, and the two coin
   * lists it covers are the only coins it asks about; a coin it cannot price
   * leads with its amount. `pricesSettled` holds those two figures as
   * skeletons for the first read (at most a moment), so a figure that is
   * about to lead with dollars never paints its coin amount large first.
   */
  const { prices: usdPrices, settled: pricesSettled } = useUsdPrices({
    chains,
    coins: record?.coins,
    deposits: figures?.inWindowDeposits,
  })

  /*
   * Rulings, all time: the ledger orders every one of them; the rows shown
   * take the entry's identifiers from the cards the load read, and "show
   * more" reads the cards of the next ones. The rows are the ones a reader
   * can open — scopedRulings leaves the retired Classic lists' rulings out,
   * since they have no page — and the Disputes tally counts exactly those,
   * so "show more" can always reach the number beside it.
   */
  const quiet = board.live.length === 0
  const rulingsFirst = stackedBoard
    ? quiet
      ? RULINGS_FIRST_STACKED_QUIET
      : RULINGS_FIRST_STACKED
    : quiet
      ? RULINGS_FIRST_QUIET
      : RULINGS_FIRST
  const [rulingsShown, setRulingsShown] = useState(rulingsFirst)
  // Past the first page: the reader asked for more, and the caps come off.
  const rulingsExpanded = rulingsShown > rulingsFirst
  useEffect(() => setRulingsShown(rulingsFirst), [chain, rulingsFirst])
  const rulingRows = useMemo(
    () => (data ? scopedRulings(data, chains) : []),
    [data, chains],
  )
  const shownRows = rulingRows.slice(0, rulingsShown)
  const [extraCards, setExtraCards] = useState<
    Record<string, DashboardActivity>
  >({})
  const baseCards = useMemo(
    () => new Map((data?.decided ?? []).map((card) => [card.id, card])),
    [data],
  )
  const cardOf = (id: string) => baseCards.get(id) ?? extraCards[id]
  const missingRows = shownRows.filter((row) => !cardOf(row.id))
  const rulingCards = useQuery({
    queryKey: ['curateRulingCards', missingRows.map((row) => row.id)],
    queryFn: () => loadRulingCards(missingRows),
    enabled: missingRows.length > 0,
    staleTime: Infinity,
    retry: 1,
  })
  useEffect(() => {
    const loaded = rulingCards.data
    if (!loaded?.length) return
    setExtraCards((previous) => {
      const next = { ...previous }
      for (const card of loaded) next[card.id] = card
      return next
    })
  }, [rulingCards.data])

  const rulings: RulingsView = {
    cards: shownRows.map((row) =>
      withRegistry(
        rulingCard(
          row,
          now,
          cardOf(row.id),
          bountyLabel(row, data?.tokens ?? {}),
        ),
        lists,
      ),
    ),
    pending: new Set(
      rulingCards.isFetching ? missingRows.map((row) => row.id) : [],
    ),
    // The rulings this panel can list (Standard and Stake), round 4's "only
    // for this": Classic counts in the self-sustaining bounties and entries
    // alone, so the tally here is a number "show more" can reach, and the
    // same count the court's share there is taken on.
    total: rulingRows.length,
    capped: chains.some((chainId) => data?.rulingsCapped?.[chainId]),
    partial: !!data && chains.some((chainId) => !data.rulings?.[chainId]),
    // Until expanded, "show more" stays available: the column may draw fewer
    // rows than it was handed, and expanding draws every one of them.
    onMore:
      !rulingsExpanded || rulingsShown < rulingRows.length
        ? () => setRulingsShown((shown) => shown + RULINGS_STEP)
        : undefined,
    onFewer: rulingsExpanded ? () => setRulingsShown(rulingsFirst) : undefined,
  }

  /** The Kleros Verified lists in scope, newest to earn the badge first. */
  const verifiedLists = useMemo(() => newestVerified(scoped), [scoped])

  const series = useMemo(
    () => (data ? scopedSeries(data, chains) : []),
    [data, chains],
  )

  const topRegistries = useMemo(
    () => sortRegistries(scoped, 'activity').slice(0, 8),
    [scoped],
  )

  /*
   * Top curators over the chart's range (round 8: the date filter is for
   * both), ranked by what their row shows: requests made plus challenges
   * made. Their bounties won are all time, from the rulings ledger.
   */
  const wins = useMemo(
    () => (data ? scopedWins(data, chains) : new Map<string, number>()),
    [data, chains],
  )
  const winsKnown = !!data && chains.every((chainId) => data.rulings?.[chainId])
  const curators = useMemo(() => {
    // The chart's range (round 8): 30 days from the page's own load, the
    // longer ranges from the history, from the first bucket's start.
    const rows =
      range === '30d'
        ? (data?.users ?? []).map((user) => {
            let requests = 0
            let challenges = 0
            let lastActiveAt = 0
            for (const [id, stats] of Object.entries(user.chains)) {
              if (!chains.includes(Number(id))) continue
              requests += stats.submissions + stats.removals
              challenges += stats.challenges
              lastActiveAt = Math.max(lastActiveAt, stats.lastActiveAt)
            }
            return { address: user.address, requests, challenges, lastActiveAt }
          })
        : history.data
          ? curatorsSince(history.data.events, rangeStart(range, now), chains)
          : []
    return rows
      .map((row) => ({
        ...row,
        won: wins.get(row.address.toLowerCase()) ?? 0,
      }))
      .filter((row) => row.requests + row.challenges > 0)
      .sort(
        (a, b) =>
          b.requests + b.challenges - (a.requests + a.challenges) ||
          b.lastActiveAt - a.lastActiveAt,
      )
      .slice(0, TOP_CURATORS)
  }, [range, data, history.data, chains, wins, now])
  const curatorsPending = range !== '30d' && !history.data
  // The top curator's activity: every curator's bar is measured against it.
  const curatorScale = Math.max(
    1,
    ...curators.map((row) => row.requests + row.challenges),
  )

  // The chart: the load's own 30 days, or the history in weeks or months.
  const chart = useMemo(() => {
    if (range === '30d')
      return {
        starts: series.map((d) => d.day),
        up: series.map((d) => d.submissions + d.removals),
        down: series.map((d) => d.challenges),
        unit: 'day' as const,
      }
    if (!history.data) return undefined
    return historySeries(history.data.events, range, now)
  }, [range, series, history.data, now])
  const chartLabels = useMemo(
    () =>
      (chart?.starts ?? []).map((start) =>
        new Intl.DateTimeFormat(
          'en-GB',
          chart?.unit === 'month'
            ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
            : { day: 'numeric', month: 'short', timeZone: 'UTC' },
        ).format(new Date(start * 1000)),
      ),
    [chart],
  )
  const chartRequests = chart?.up.reduce((sum, value) => sum + value, 0) ?? 0
  const chartChallenges =
    chart?.down.reduce((sum, value) => sum + value, 0) ?? 0

  /*
   * Chains in this scope whose lists did not load (an indexer refused or
   * timed out): their lists, entries and requests are missing, not zero, so
   * the figures built on them read "—" rather than a low count, as on
   * Browse. With no list in scope at all, the indexers did not answer.
   */
  const listsMissing = (data?.listFailedChains ?? []).filter((id) =>
    chains.includes(id),
  )
  const figuresUnknown = listsMissing.length > 0
  const missingNames = listsMissing
    .map((id) => chainInfo(id)?.name ?? String(id))
    .join(' and ')
  const unanswered = figuresUnknown && scoped.length === 0

  // Chains in this scope whose indexer did not answer: their figures are missing.
  const partialChains = (data?.failedChains ?? []).filter((id) =>
    chains.includes(id),
  )
  const partialNames = partialChains
    .map((id) => chainInfo(id)?.name)
    .filter(Boolean)
    .join(' and ')
  // The load refreshes every few minutes while on screen; one older than
  // that (the tab was in the background), or one whose refresh failed, is
  // shown as such, not as live. Nothing is called live before a load.
  const pillState = loadState({
    loaded: !!data,
    failed: query.isError,
    unanswered,
    partial: partialChains.length > 0,
    live: !!data && isLiveLoad(data.generatedAt, now),
  })
  const updated =
    data && partialChains.length === 0
      ? `Updated ${formatAgo(Math.floor(data.generatedAt / 1000), now)}`
      : undefined

  return (
    <Page>
      <Hero>
        <HeroMain>
          <LoadStatePill
            style={{ ['--i' as string]: 0 }}
            state={pillState}
            refreshing={query.isFetching}
            partialNames={partialNames}
            updated={updated}
          />
          <Headline style={{ ['--i' as string]: 1 }}>
            {/* Read once, whole: the changing word is for the eye only. */}
            <VisuallyHidden>
              Verify tokens, contracts, domains and more, or earn by keeping
              lists clean.
            </VisuallyHidden>
            <span aria-hidden data-line="first">
              Verify{' '}
              <em>
                <RotatingWord words={HERO_WORDS} suffix="," />
              </em>
            </span>{' '}
            <span aria-hidden data-line="second">
              or <em>earn</em> by keeping lists clean.
            </span>
          </Headline>
          <Lede style={{ ['--i' as string]: 2 }}>
            Curate verifies anything, at scale. Built to let good actors win:
            they get verified, or they get the bounty if they spot wrong
            entries.
          </Lede>
          <Actions style={{ ['--i' as string]: 3 }}>
            <ButtonLink to={browseHref()} $variant="primary">
              Explore lists
            </ButtonLink>
            <ButtonLink to={`/launch/${launchChain}`} $variant="secondary">
              Launch a list
            </ButtonLink>
          </Actions>
        </HeroMain>
        <HeroAside style={{ ['--i' as string]: 4 }}>
          <HeroMoney
            record={record}
            prices={usdPrices}
            pricesSettled={pricesSettled}
            transit={transit.data?.usd}
            transitFailed={testnetScope || transit.isError}
          />
        </HeroAside>
      </Hero>

      <Featured
        $featured
        $padding="none"
        aria-label="Live figures"
        style={{ ['--i' as string]: 4 }}
      >
        <FeaturedMain>
          <FeaturedTop>
            <HeadlineFigure>
              <Label $tone="faint">Entries</Label>
              <Big $hero>
                <Odometer
                  loading={loading}
                  value={figuresUnknown ? undefined : figures?.entries}
                />
              </Big>
            </HeadlineFigure>
            <InlineStats>
              {[
                { label: 'Lists', value: figures?.registries },
                { label: 'Open requests', value: figures?.requestsOpen },
                { label: 'In court now', value: figures?.inCourt },
              ].map((figure) => (
                <InlineStat key={figure.label}>
                  <Label $tone="faint">{figure.label}</Label>
                  <b>
                    <AnimatedNumber
                      loading={loading}
                      value={figuresUnknown ? undefined : figure.value}
                    />
                  </b>
                </InlineStat>
              ))}
            </InlineStats>
          </FeaturedTop>
          {/* The chart's own head: what it counts, and the range that sets
              it (and Top curators beside it). */}
          <ScopeBar>
            <SeriesLegend aria-label="Chart series">
              <li>
                <Label $tone="faint">{RANGE_LEGEND[range]}</Label>
              </li>
              <li style={{ color: 'var(--color-primary)' }}>
                <i style={{ background: 'var(--color-primary)' }} aria-hidden />
                <span style={{ color: 'var(--color-muted)' }}>Requests</span>
              </li>
              <li style={{ color: 'var(--status-contested)' }}>
                <i
                  style={{ background: 'var(--status-contested)' }}
                  aria-hidden
                />
                <span style={{ color: 'var(--color-muted)' }}>Challenges</span>
              </li>
            </SeriesLegend>
            <SegmentedControl<ChartRange>
              ariaLabel="Chart range"
              size="sm"
              value={range}
              onChange={setRange}
              options={RANGE_OPTIONS}
            />
          </ScopeBar>
          {loading || !chart ? (
            history.isError && range !== '30d' ? (
              <ChartEmpty>The history did not load</ChartEmpty>
            ) : (
              <SkeletonBlock $height="240px" />
            )
          ) : chartRequests + chartChallenges === 0 ? (
            <ChartEmpty>
              {partialNames
                ? `${partialNames} requests did not load`
                : 'No requests in this range'}
            </ChartEmpty>
          ) : (
            <ActivityWave
              key={`${chains.join('-')}-${range}`}
              height={240}
              labels={chartLabels}
              up={chart.up}
              down={chart.down}
              upLabel="Requests"
              downLabel="Challenges"
              partialLast
              ariaLabel={`Requests and challenges ${RANGE_WORDS[range]}: ${formatInt(
                chartRequests,
              )} requests, ${formatInt(chartChallenges)} challenges`}
            />
          )}
          {range === '30d' && data?.seriesTruncated && (
            <Small $faint>
              Some chains had more requests than this view loads; their earliest
              days may be undercounted.
            </Small>
          )}
          {range !== '30d' && history.data?.truncated && (
            <Small $faint>
              Some chains had more requests than this view loads; their earliest{' '}
              {range === '3y' ? 'months' : 'weeks'} may be undercounted.
            </Small>
          )}
        </FeaturedMain>
        <CuratorsAside aria-label="Top curators">
          <CuratorsHead>
            <Label $tone="faint">Top curators · {RANGE_SPAN[range]}</Label>
            {!loading && curators.length > 0 && (
              <Label
                $tone="faint"
                title="Bounties won: challenges the court ruled for them, all time"
              >
                Won · all time
              </Label>
            )}
          </CuratorsHead>
          {loading || (curatorsPending && !history.isError) ? (
            <SkeletonBlock $height="260px" style={{ marginTop: 16 }} />
          ) : curatorsPending && history.isError ? (
            <EmptyNote>The curation history did not load.</EmptyNote>
          ) : curators.length === 0 ? (
            <EmptyNote>No curator activity in this range.</EmptyNote>
          ) : (
            <CuratorList>
              {curators.map((row, index) => (
                <CuratorRow key={row.address} to={`/address/${row.address}`}>
                  <Rank>{String(index + 1).padStart(2, '0')}</Rank>
                  <span style={{ minWidth: 0 }}>
                    <strong>{truncateMiddle(row.address)}</strong>
                    {/* Their activity against the top curator's, as
                          the one bar: requests, then challenges. */}
                    <CuratorBar>
                      <LaneBar
                        runs={[
                          {
                            key: 'requests',
                            weight: row.requests / curatorScale,
                            hue: 'var(--color-primary)',
                          },
                          {
                            key: 'challenges',
                            weight: row.challenges / curatorScale,
                            hue: 'var(--status-contested)',
                          },
                        ]}
                        extent={(row.requests + row.challenges) / curatorScale}
                        armed
                        delay={200 + index * 90}
                      />
                    </CuratorBar>
                    <Small $muted data-counts="" style={{ display: 'block' }}>
                      {plural(row.requests, 'request', 'requests')} ·{' '}
                      {plural(row.challenges, 'challenge', 'challenges')}
                    </Small>
                  </span>
                  <Won
                    title={`${plural(row.won, 'bounty', 'bounties')} won, all time`}
                    data-none={row.won === 0 ? '' : undefined}
                  >
                    <CurateIcon name="bounty" size={13} />
                    {winsKnown ? formatInt(row.won) : '—'}
                    <VisuallyHidden>
                      {' '}
                      {row.won === 1 ? 'bounty' : 'bounties'} won, all time
                    </VisuallyHidden>
                  </Won>
                </CuratorRow>
              ))}
            </CuratorList>
          )}
        </CuratorsAside>
      </Featured>

      {/*
        The second box, directly under the chart: whether any of this works
        at all, all time, under its own heading. It used to share "Happening
        now" with the live disputes while its own label read "All time".
      */}
      <VerificationRecord
        record={record}
        /*
         * Every entry ever curated, against challenges all time: the
         * retired Classic lists count here, where the figures are
         * the protocol's history, and not in the hero strip above, which is
         * labelled live and stands beside a count of the lists Browse can
         * open. A chain whose lists did not load, or a Classic read that
         * came back a full page, leaves the comparison off rather than low.
         */
        entries={
          figuresUnknown || figures?.classicCapped
            ? undefined
            : figures?.entriesAllTime
        }
      />

      {/*
        No "Happening now" heading (Fortunato, after round 19): the section
        opens on what is open for verification, its bounties and the lists
        holding it, under its own 30px title with the live LED, right above
        the submissions column whose rows they count. It holds its own
        skeletons, so its title is there from the first paint. The section's
        80px opening stays when the band hides itself (no bounties).
      */}
      <BoardOpening />
      <OpenForVerification
        open={board.open}
        openLists={board.openLists}
        figures={figures}
        prices={usdPrices}
        pricesSettled={pricesSettled}
        checking={checkingWindows}
        unloaded={partialNames || undefined}
        stakeHref={stakeHref}
        stakeLists={stakeLists}
      />
      <LiveBoard
        open={board.open}
        openLists={board.openLists}
        live={board.live}
        rulings={rulings}
        figures={figures}
        now={now}
        unloaded={partialNames || undefined}
        stakeHref={stakeHref}
      />

      <VerifiedLists
        lists={verifiedLists}
        loading={loading}
        browseHref={browseHref('trust=verified')}
        scopeKey={chains.join('-')}
        failed={partialChains.length > 0}
      />

      <SectionHead>
        <SectionTitle>Most active</SectionTitle>
        <SeeAll to={browseHref('trust=all&sort=activity')}>
          All lists <CurateIcon name="submit" size={13} />
        </SeeAll>
      </SectionHead>
      {loading ? (
        <SkeletonBlock $height="420px" />
      ) : (
        <ActiveFrame>
          <ActiveTable>
            <thead>
              <tr>
                <th>List</th>
                <th>Chain</th>
                <th className="num">Entries</th>
                <th className="num">Open</th>
                <th className="num">In court</th>
              </tr>
            </thead>
            <tbody>
              {topRegistries.map((registry) => (
                <tr
                  key={registry.id}
                  data-href={registryHref(registry)}
                  onClick={(event) => {
                    // A click on the name is its link's alone (Cmd or
                    // Ctrl+click opens a tab): the row does not navigate too.
                    if ((event.target as HTMLElement).closest('a, button'))
                      return
                    navigate(registryHref(registry))
                  }}
                >
                  <td>
                    <RegistryCell>
                      <RegistryLogo registry={registry} />
                      <div style={{ minWidth: 0 }}>
                        <NameLine>
                          <RegistryName
                            to={registryHref(registry)}
                            title={registry.title}
                          >
                            {registry.title}
                          </RegistryName>
                          {registry.trustStatus === 'verified' && (
                            <VerifiedBadge size={16} />
                          )}
                          <KindTag kind={registry.kind} />
                        </NameLine>
                        <RowMeta>
                          <span
                            className="phone-only"
                            title={chainInfo(registry.chainId)?.name}
                          >
                            <ChainLogo chainId={registry.chainId} size={14} />
                            <VisuallyHidden>
                              {chainInfo(registry.chainId)?.name}
                            </VisuallyHidden>
                          </span>
                        </RowMeta>
                      </div>
                    </RegistryCell>
                  </td>
                  <td>
                    <ChainChip chainId={registry.chainId} size="sm" />
                  </td>
                  <td className="num">{formatInt(entryCount(registry))}</td>
                  <td className="num">
                    {registry.kind === 'permanent'
                      ? '—'
                      : formatInt(registry.pendingCount)}
                  </td>
                  <td className="num">{formatInt(registry.disputeCount)}</td>
                </tr>
              ))}
              {figuresUnknown && (
                <tr>
                  <td colSpan={5}>
                    <Small $muted>{missingNames} lists did not load</Small>
                  </td>
                </tr>
              )}
            </tbody>
          </ActiveTable>
        </ActiveFrame>
      )}
    </Page>
  )
}

export default Dashboard
