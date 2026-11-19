import React, { useEffect, useMemo, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  SelectMenu,
  type SelectMenuOption,
  SkeletonBlock,
  Small,
  Surface,
  Table,
  TableScroller,
  VisuallyHidden,
  truncateMiddle,
} from 'components/curate/primitives'
import { ActivityWave } from 'components/curate/motion/activity-wave'
import { Odometer } from 'components/curate/motion/odometer'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { reveal } from 'components/curate/motion/reveal'
import { VerifiedBadge } from 'components/curate/verified-badge'
import { KindTag } from 'components/curate/stake-tag'
import { getNativeCurrency } from 'config/chains'
import {
  completeChallengeWindows,
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
import { useSavedLoadsReady } from './saved-load'
import { LiveBoard, type RulingsView } from './happening-now'
import { OpenForVerification } from './open-for-verification'
import type { OpenListChip } from './board-rows'
import { SectionHead, SectionTitle } from './section'
import { VerificationRecord } from './bounties'
import { VerifiedLists } from './verified-lists'
import type {
  DashboardActivity,
  DashboardData,
  DashboardRegistry,
  RulingRow,
} from './types'
import {
  MAINNET_CHAIN_IDS,
  SUPPORTED_CHAIN_IDS,
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
  sortRegistries,
  validChain,
  windowsPending,
  type ChainFilter,
  type DashboardCard,
} from './view'
import { Avatar as ListLogo } from 'pages/browse/avatar'

/*
 * Dashboard: a short statement, one strip of live figures over the 30-day
 * wave, then the self-sustaining mechanism, the money anyone can go and claim
 * (Open for verification), what is happening now in two columns beside each
 * other, the Kleros Verified lists, and the most active registries and
 * curators. Every figure comes from the indexers or the chain.
 *
 * Round 3 set that order. The 30-day chart and the record of how the lists
 * sustains itself are the two boxes a reader meets first, because they say
 * whether any of this works; then the three figures of what is open for
 * verification, and under them the board those figures belong to — the
 * submissions on one side, the disputes and the rulings on the other
 * (happening-now.tsx). Nothing sits between the strip and the board it
 * heads, so the Kleros Verified strip follows them rather than splitting
 * them.
 *
 * Each section that owns a file heads itself and holds its own skeletons
 * (open-for-verification.tsx, happening-now.tsx, bounties.tsx), so no
 * heading waits on a load.
 *
 * Round 2, item 7: the "Entries by chain" ring is gone. On several chains
 * it drew two segments whose leader the hero's own Entries figure already
 * implied; on one chain it turned into "Entries by list" and repeated the
 * Most active table's entries column. Nobody could act on either.
 */

const integer = new Intl.NumberFormat('en-US')
const listFormat = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction',
})
const formatInt = (value: number) => integer.format(Math.round(value))
const plural = (value: number, one: string, many: string) =>
  `${formatInt(value)} ${value === 1 ? one : many}`

/** Rulings the Disputes box shows first, and how many more each "show more" adds. */
const RULINGS_FIRST = 4
const RULINGS_STEP = 8
/**
 * With nothing in court, the rulings are the whole right column: a longer
 * first page fills the height the submissions column sets with rows, as far
 * as the scope has rulings to fill it with (happening-now.tsx).
 */
const RULINGS_FIRST_QUIET = 8

/**
 * The page's chain scopes: "All chains" (every mainnet; a testnet is never
 * part of it), then each chain, the testnet last and tagged.
 */
const scopeOptions: SelectMenuOption<string>[] = [
  {
    value: 'all',
    label: 'All chains',
    hint: listFormat.format(
      MAINNET_CHAIN_IDS.map((id) => chainInfo(id)?.name ?? String(id)),
    ),
    icon: 'chain',
  },
  ...SUPPORTED_CHAIN_IDS.map((chainId) => {
    const testnet = TESTNET_CHAIN_IDS.includes(chainId)
    return {
      value: String(chainId),
      label: chainInfo(chainId)?.name ?? String(chainId),
      icon: <ChainLogo chainId={chainId} size={18} />,
      tag: testnet ? 'testnet' : undefined,
      divider: testnet,
    }
  }).sort((a, b) => Number(Boolean(a.tag)) - Number(Boolean(b.tag))),
]

/** A logo, on the IPFS gateway only (ipfsImageUrl says why). */
const mediaUrl = (uri?: string | null): string | null =>
  ipfsImageUrl(uri) ?? null

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-registered) 55%, transparent); }
  70% { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

/* ---------- Hero (YMax composition) ---------- */

const Hero = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;

  > * {
    ${reveal}
  }
  /* Starts where every page does: Page's own top padding, nothing more. */
  padding: 0 0 8px;
  text-align: center;

  @media (max-width: 720px) {
    align-items: flex-start;
    text-align: left;
  }
`

const LivePill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 14px 0 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 500;

  b {
    color: var(--color-primary);
    font-weight: 500;
  }

  i {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--status-registered);
    animation: ${pulse} 2.4s infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }

  /* Some indexer did not answer: the figures are partial, not live. */
  &[data-partial] {
    b {
      color: var(--color-warning);
    }

    i {
      background: var(--status-contested);
      animation: none;
    }
  }

  /* No list in scope loaded: the indexers did not answer at all. */
  &[data-down] i {
    background: var(--status-off);
    animation: none;
  }

  /* An older load (the tab was in the background): shown, not called live. */
  &[data-stale] {
    b {
      color: var(--color-muted);
    }

    i {
      background: var(--color-muted);
      animation: none;
    }
  }
`

/* The pill's state word and what went wrong, spaced as the pill spaces them. */
const PillState = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`

const Headline = styled(HeroStatement)`
  max-width: 14ch;
`

const Lede = styled.p`
  margin: 0;
  max-width: 46ch;
  color: var(--color-muted);
  font-size: 18px;
  line-height: 28px;
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;
`

const Featured = styled(Surface)`
  margin-top: 64px;
  padding: 28px 28px 20px;
  ${reveal}

  @media (max-width: 720px) {
    padding: 20px 16px 16px;
  }
`

const ScopeBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--glass-border);

  /* Phones: the four chains do not fit a segmented track; a menu does. */
  .scope-narrow {
    display: none;
  }

  @media (max-width: 560px) {
    .scope-wide {
      display: none;
    }

    .scope-narrow {
      display: inline-flex;
    }
  }
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
 * "Happening now" heads the two-column board, which in turn belongs to the
 * figures strip right above it: 80px of air there would break the three
 * apart, so this heading keeps 32px.
 */
const LiveHead = styled(SectionHead)`
  margin-top: 32px;
`

const Split = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 20px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
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

/** "30 xDAI": what the challenger won on a ruling, when they won. */
const bountyLabel = (
  row: RulingRow,
  tokens: DashboardData['tokens'],
): string | undefined => {
  if (!row.challengerWon) return undefined
  const coin = row.token
    ? tokens[`${row.chainId}:${row.token}`]
    : getNativeCurrency(row.chainId)
  if (!coin) return undefined
  return `${formatUnits(BigInt(row.bounty || '0'), coin.decimals)} ${coin.symbol}`
}

const RegistryLogo = ({ registry }: { registry: DashboardRegistry }) => (
  <ListLogo uri={registry.logoURI} seed={registry.address} size={34} />
)

const Dashboard = () => {
  useDocumentHead(
    'Kleros Curate',
    'Browse Kleros Curate registries, follow entries in a challenge window or in court, and earn by challenging entries that break a list policy.',
  )
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const chain: ChainFilter = validChain(searchParams.get('chain'))
  const now = useNow(30_000)
  const launchChain = useLaunchChainId()

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

  const setChain = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'all') next.delete('chain')
    else next.set('chain', value)
    setSearchParams(next, { replace: true })
  }

  const chains = useMemo(() => scopeChains(chain), [chain])
  // What "All chains" covers, named under the switch: "Ethereum and Gnosis".
  const scopeName = listFormat.format(
    chains.map((chainId) => chainInfo(chainId)?.name ?? String(chainId)),
  )
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

  /*
   * Rulings, all time: the ledger orders every one of them; the rows shown
   * take the entry's identifiers from the cards the load read, and "show
   * more" reads the cards of the next ones.
   */
  const rulingsFirst =
    board.live.length === 0 ? RULINGS_FIRST_QUIET : RULINGS_FIRST
  const [rulingsShown, setRulingsShown] = useState(rulingsFirst)
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
    total: rulingRows.length,
    capped: chains.some((chainId) => data?.rulingsCapped?.[chainId]),
    partial: !!data && chains.some((chainId) => !data.rulings?.[chainId]),
    onMore:
      rulingsShown < rulingRows.length
        ? () => setRulingsShown((shown) => shown + RULINGS_STEP)
        : undefined,
    onFewer:
      rulingsShown > rulingsFirst && rulingRows.length > rulingsFirst
        ? () => setRulingsShown(rulingsFirst)
        : undefined,
  }

  /**
   * The self-sustaining mechanism, all time, in the page's scope: how rarely a
   * request is challenged at all, how the court ruled when one was, and the
   * bounties the challengers took.
   */
  const record = useMemo(
    () => (data ? scopedChallengeRecord(data, chains) : undefined),
    [data, chains],
  )

  /** The Kleros Verified lists in scope, newest to earn the badge first. */
  const verifiedLists = useMemo(() => newestVerified(scoped), [scoped])

  const series = useMemo(
    () => (data ? scopedSeries(data, chains) : []),
    [data, chains],
  )
  const seriesRequests = series.reduce(
    (sum, d) => sum + d.submissions + d.removals,
    0,
  )
  const seriesChallenges = series.reduce((sum, d) => sum + d.challenges, 0)

  const topRegistries = useMemo(
    () => sortRegistries(scoped, 'activity').slice(0, 8),
    [scoped],
  )

  /*
   * Top curators in scope, ranked by what their row shows: requests made
   * plus challenges made over the 30 days. Their bounties won are all
   * time, from the rulings ledger, like every other case on the page.
   */
  const wins = useMemo(
    () => (data ? scopedWins(data, chains) : new Map<string, number>()),
    [data, chains],
  )
  const winsKnown = !!data && chains.every((chainId) => data.rulings?.[chainId])
  const curators = useMemo(
    () =>
      (data?.users ?? [])
        .map((user) => {
          let requests = 0
          let challenges = 0
          let lastActiveAt = 0
          for (const [id, stats] of Object.entries(user.chains)) {
            if (!chains.includes(Number(id))) continue
            requests += stats.submissions + stats.removals
            challenges += stats.challenges
            lastActiveAt = Math.max(lastActiveAt, stats.lastActiveAt)
          }
          return {
            address: user.address,
            requests,
            challenges,
            won: wins.get(user.address.toLowerCase()) ?? 0,
            lastActiveAt,
          }
        })
        .filter((row) => row.requests + row.challenges > 0)
        .sort(
          (a, b) =>
            b.requests + b.challenges - (a.requests + a.challenges) ||
            b.lastActiveAt - a.lastActiveAt,
        )
        .slice(0, 6),
    [data, chains, wins],
  )

  const chartLabels = useMemo(
    () =>
      series.map((d) =>
        new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(d.day * 1000)),
      ),
    [series],
  )

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

  const testnet = chain !== 'all' && TESTNET_CHAIN_IDS.includes(chain)
  // Chains in this scope whose indexer did not answer: their figures are missing.
  const partialChains = (data?.failedChains ?? []).filter((id) =>
    chains.includes(id),
  )
  const partialNames = partialChains
    .map((id) => chainInfo(id)?.name)
    .filter(Boolean)
    .join(' and ')
  // The load refreshes every few minutes while on screen; one older than
  // that (the tab was in the background) is shown as such, not as live.
  const live = !!data && isLiveLoad(data.generatedAt, now)
  const updated = data
    ? `Updated ${formatAgo(Math.floor(data.generatedAt / 1000), now)}`
    : ''
  const partial = partialChains.length > 0 && !unanswered

  return (
    <Page>
      <Hero>
        <LivePill
          style={{ ['--i' as string]: 0 }}
          data-partial={partial ? '' : undefined}
          data-down={unanswered ? '' : undefined}
          data-stale={
            data && !live && partialChains.length === 0 ? '' : undefined
          }
        >
          <i aria-hidden />
          {/* Only the state is announced: the age after it changes every
              minute, and a live region would read it out each time. */}
          <PillState role="status">
            {!unanswered && (
              <b>
                {partial
                  ? 'Partial'
                  : !data || live
                    ? 'Live'
                    : query.isFetching
                      ? 'Refreshing'
                      : 'Not live'}
              </b>
            )}
            {!data
              ? 'Connecting to the indexers'
              : unanswered
                ? 'Indexers not answering'
                : partial
                  ? `Some ${partialNames} data did not load; figures may be incomplete`
                  : null}
          </PillState>
          {data && partialChains.length === 0 && updated}
        </LivePill>
        <Headline style={{ ['--i' as string]: 1 }}>
          Lists anyone can challenge. <em>Settled by Kleros.</em>
        </Headline>
        <Lede style={{ ['--i' as string]: 2 }}>
          Challenge a submission that breaks its list’s policy and earn its
          bounty if jurors agree.
        </Lede>
        <Actions style={{ ['--i' as string]: 3 }}>
          <ButtonLink to={browseHref()} $variant="primary">
            Explore registries
          </ButtonLink>
          <ButtonLink to={`/launch/${launchChain}`} $variant="secondary">
            Launch a list
          </ButtonLink>
        </Actions>
      </Hero>

      <Featured
        $featured
        $padding="none"
        aria-label="Live figures"
        style={{ ['--i' as string]: 4 }}
      >
        <ScopeBar>
          <Label $tone="faint" style={{ marginRight: 'auto' }}>
            {chain === 'all' ? scopeName : testnet ? 'Test network' : ''}
          </Label>
          <SegmentedControl
            className="scope-wide"
            ariaLabel="Chains"
            value={chain === 'all' ? 'all' : String(chain)}
            onChange={setChain}
            options={scopeOptions.map(({ value, label, tag }) => ({
              value,
              label,
              tag,
            }))}
          />
          <SelectMenu
            className="scope-narrow"
            label="Chains"
            hideLabel
            align="end"
            value={chain === 'all' ? 'all' : String(chain)}
            onChange={setChain}
            options={scopeOptions}
          />
        </ScopeBar>
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
              { label: 'Registries', value: figures?.registries },
              { label: 'Open requests', value: figures?.requestsOpen },
              { label: 'In court now', value: figures?.inCourt },
              { label: 'Curators · 30 days', value: figures?.curators },
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
          <SeriesLegend aria-label="Chart series">
            <li>
              <Label $tone="faint">Per day · last 30 days</Label>
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
        </FeaturedTop>
        {loading ? (
          <SkeletonBlock $height="240px" />
        ) : seriesRequests + seriesChallenges === 0 ? (
          <ChartEmpty>
            {partialNames
              ? `${partialNames} requests did not load`
              : 'No requests in the last 30 days'}
          </ChartEmpty>
        ) : (
          <ActivityWave
            key={chains.join('-')}
            height={260}
            labels={chartLabels}
            up={series.map((d) => d.submissions + d.removals)}
            down={series.map((d) => d.challenges)}
            upLabel="Requests"
            downLabel="Challenges"
            partialLast
            ariaLabel={`Requests and challenges per day over the last 30 days, today so far included: ${formatInt(
              seriesRequests,
            )} requests, ${formatInt(seriesChallenges)} challenges`}
          />
        )}
        {data?.seriesTruncated && (
          <Small $faint>
            Some chains had more requests than this view loads; their earliest
            days may be undercounted.
          </Small>
        )}
      </Featured>

      {/*
        The second box, directly under the chart: whether any of this works
        at all, all time, under its own heading. It used to share "Happening
        now" with the live disputes while its own label read "All time".
      */}
      <VerificationRecord
        record={record}
        // Entries now, against challenges all time: a chain whose lists did
        // not load leaves the comparison off rather than low.
        entries={figuresUnknown ? undefined : figures?.entries}
      />

      {/*
        Three figures, then the board they belong to. The strip heads itself
        and holds its own skeletons, so its heading is there from the first
        paint; the requests it counts are the submissions column below.
      */}
      <OpenForVerification
        open={board.open}
        figures={figures}
        now={now}
        checking={checkingWindows}
        unloaded={partialNames || undefined}
      />

      {/*
        The board's own heading, close to the strip above it rather than at
        the full 80px: the strip, this line and the two columns are one
        band of the page, not three sections.
      */}
      <LiveHead>
        <SectionTitle>Happening now</SectionTitle>
      </LiveHead>
      <LiveBoard
        open={board.open}
        openLists={board.openLists}
        live={board.live}
        rulings={rulings}
        figures={figures}
        now={now}
        unloaded={partialNames || undefined}
        stakeHref={
          scoped.some((registry) => registry.kind === 'permanent')
            ? browseHref('trust=all&kind=permanent')
            : undefined
        }
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
          All registries <CurateIcon name="submit" size={13} />
        </SeeAll>
      </SectionHead>
      <Split>
        {loading ? (
          <SkeletonBlock $height="420px" />
        ) : (
          <TableScroller>
            <ActiveTable>
              <thead>
                <tr>
                  <th>Registry</th>
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
          </TableScroller>
        )}

        <Surface $padding="standard" aria-label="Top curators">
          <CuratorsHead>
            <Label $tone="faint">Top curators · 30 days</Label>
            {!loading && curators.length > 0 && (
              <Label
                $tone="faint"
                title="Bounties won: challenges the court ruled for them, all time"
              >
                Won · all time
              </Label>
            )}
          </CuratorsHead>
          {loading ? (
            <SkeletonBlock $height="260px" style={{ marginTop: 16 }} />
          ) : curators.length === 0 ? (
            <EmptyNote>
              {partialNames
                ? `${partialNames} curator activity did not load.`
                : 'No curator activity in the last 30 days.'}
            </EmptyNote>
          ) : (
            <div style={{ marginTop: 8 }}>
              {curators.map((row, index) => (
                <CuratorRow key={row.address} to={`/address/${row.address}`}>
                  <Rank>{String(index + 1).padStart(2, '0')}</Rank>
                  <span style={{ minWidth: 0 }}>
                    <strong>{truncateMiddle(row.address)}</strong>
                    <Small $muted>
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
            </div>
          )}
        </Surface>
      </Split>
    </Page>
  )
}

export default Dashboard
