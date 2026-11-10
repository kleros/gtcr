import React, { useEffect, useMemo, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatAgo } from 'utils/time'
import { NETWORKS } from 'config/networks'
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
import { OrbitChart } from 'components/curate/orbit-chart'
import { ActivityWave } from 'components/curate/motion/activity-wave'
import { Odometer } from 'components/curate/motion/odometer'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { reveal } from 'components/curate/motion/reveal'
import { VerifiedBadge } from 'components/curate/verified-badge'
import { getNativeCurrency } from 'config/chains'
import {
  completeChallengeWindows,
  fetchDashboardData,
  loadRulingCards,
} from './data'
import {
  HappeningNow,
  type OpenListChip,
  type RulingsView,
} from './happening-now'
import { BountiesBody, BountiesRing } from './bounties'
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
  kindLabel,
  registryHref,
  newestVerified,
  rulingCard,
  scopedBounties,
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

/*
 * Dashboard: a short statement, the entries per chain as the data hero, one
 * strip of live figures, what is open or in court right now, and the most
 * active registries and curators. Every figure comes from the indexers.
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

/*
 * Categorical colours, fixed per entity: chains always wear the same hue,
 * lists take them in rank order. None is a status colour (amber stays
 * "contested", green "registered").
 */
const CHAIN_COLOR: Record<number, string> = {
  [NETWORKS.gnosis]: 'var(--viz-1)',
  [NETWORKS.ethereum]: 'var(--viz-2)',
  [NETWORKS.sepolia]: 'var(--viz-3)',
}
const LIST_PALETTE = [
  'var(--viz-1)',
  'var(--viz-2)',
  'var(--viz-3)',
  'var(--viz-4)',
]

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

const mediaUrl = (uri?: string | null): string | null => {
  if (!uri) return null
  if (/^https?:\/\//i.test(uri)) return uri
  return parseIpfs(uri)
}

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
  padding: 56px 0 8px;
  text-align: center;

  @media (max-width: 720px) {
    padding-top: 24px;
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

/*
 * Entries by chain, then Bounties won across the other two thirds. Below
 * 1180px a third is too narrow for the ring and its legend: the two stack.
 */
const Gauges = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 16px;
  margin-top: 16px;

  @media (max-width: 1180px) {
    grid-template-columns: 1fr;
  }
`

const GaugeCard = styled(Surface)<{ $stack?: boolean }>`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 22px;
  ${reveal}

  /* On phones the breakdown's legend gets the full width under its ring. */
  @media (max-width: 520px) {
    ${({ $stack }) =>
      $stack
        ? 'flex-direction: column; align-items: stretch; > figure { align-self: center; }'
        : ''}
  }

  h3 {
    margin: 0 0 6px;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 20px;
    line-height: 24px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
`

const Legend = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 400px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr) auto;
    align-items: baseline;
    column-gap: 8px;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  i {
    flex: 0 0 8px;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    transform: translateY(-1px);
  }

  /* Two lines before the cut, so endings that tell lists apart stay. */
  span {
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }

  b {
    color: var(--color-muted);
    font-family: var(--font-figure);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
`

/* ---------- Sections ---------- */

const SectionHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin: 80px 0 20px;
`

const SectionTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 34px;
  font-weight: 500;
  letter-spacing: -0.03em;
`

const BoardSkeleton = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
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

const Logo = styled.span<{ $image?: string | null }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: ${({ $image }) =>
    $image ? `url(${$image}) center / cover` : 'var(--color-raised)'};
  color: var(--color-faint);
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
  <Logo $image={mediaUrl(registry.logoURI)} aria-hidden>
    {!registry.logoURI && <CurateIcon name="registry" size={15} />}
  </Logo>
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

  const query = useQuery({
    queryKey: ['curateDashboard'],
    queryFn: fetchDashboardData,
    staleTime: 60_000,
    refetchInterval: 60_000,
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
      queryClient.setQueryData<DashboardData>(['curateDashboard'], (current) =>
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
  // Links to Browse keep the page's scope ("All chains" is Ethereum + Gnosis).
  const browseScope = `chain=${chains.join(',')}`
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
  const [rulingsShown, setRulingsShown] = useState(RULINGS_FIRST)
  useEffect(() => setRulingsShown(RULINGS_FIRST), [chain])
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
      rulingsShown > RULINGS_FIRST && rulingRows.length > RULINGS_FIRST
        ? () => setRulingsShown(RULINGS_FIRST)
        : undefined,
  }

  /** Bounties won, all time, per coin, in the page's scope. */
  const bounties = useMemo(
    () => (data ? scopedBounties(data, chains) : undefined),
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

  /**
   * The breakdown ring: across several chains it splits entries by chain;
   * on one chain it splits them by list (top four, then the rest).
   */
  const breakdown = useMemo(() => {
    if (chains.length > 1)
      return {
        title: 'Entries by chain',
        segments: chains.map((chainId) => ({
          key: String(chainId),
          label: chainInfo(chainId)?.name ?? String(chainId),
          color: CHAIN_COLOR[chainId] ?? 'var(--viz-4)',
          value: scoped
            .filter((r) => r.chainId === chainId)
            .reduce((sum, r) => sum + entryCount(r), 0),
        })),
      }
    const ranked = [...scoped].sort((a, b) => entryCount(b) - entryCount(a))
    const top = ranked.slice(0, 4)
    // Two lists with one name are told apart by their address.
    const named = (title: string) =>
      top.filter((other) => other.title === title).length > 1
    const segments = top.map((r, index) => ({
      key: r.id,
      label: named(r.title)
        ? `${r.title} · ${truncateMiddle(r.address)}`
        : r.title,
      color: LIST_PALETTE[index],
      value: entryCount(r),
    }))
    const rest = ranked.slice(4).reduce((sum, r) => sum + entryCount(r), 0)
    return {
      title: 'Entries by list',
      segments: rest
        ? [
            ...segments,
            {
              key: 'rest',
              label: `${ranked.length - 4} other lists`,
              color: 'var(--color-faint)',
              value: rest,
            },
          ]
        : segments,
    }
  }, [chains, scoped])

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

  const breakdownTotal = breakdown.segments.reduce(
    (sum, seg) => sum + seg.value,
    0,
  )
  // The centre names the biggest list by name ("other lists" is not one).
  const leader = [...breakdown.segments]
    .filter((seg) => seg.key !== 'rest' && seg.value > 0)
    .sort((a, b) => b.value - a.value)[0]
  const leading =
    breakdownTotal && leader
      ? { label: leader.label, share: leader.value / breakdownTotal }
      : undefined

  const testnet = chain !== 'all' && TESTNET_CHAIN_IDS.includes(chain)
  // Chains in this scope whose indexer did not answer: their figures are missing.
  const partialChains = (data?.failedChains ?? []).filter((id) =>
    chains.includes(id),
  )
  const partialNames = partialChains
    .map((id) => chainInfo(id)?.name)
    .filter(Boolean)
    .join(' and ')

  return (
    <Page>
      <Hero>
        <LivePill
          style={{ ['--i' as string]: 0 }}
          data-partial={partialChains.length > 0 ? '' : undefined}
          role="status"
        >
          <i aria-hidden />
          <b>{partialChains.length > 0 ? 'Partial' : 'Live'}</b>
          {!data
            ? 'Connecting to the indexers'
            : partialChains.length > 0
              ? `Some ${partialNames} data did not load; figures may be incomplete`
              : `Updated ${formatAgo(Math.floor(data.generatedAt / 1000), now)}`}
        </LivePill>
        <Headline style={{ ['--i' as string]: 1 }}>
          Lists anyone can challenge. <em>Settled by jurors.</em>
        </Headline>
        <Lede style={{ ['--i' as string]: 2 }}>
          Challenge a submission that breaks its list’s policy and earn its
          bounty if jurors agree.
        </Lede>
        <Actions style={{ ['--i' as string]: 3 }}>
          <ButtonLink to={`/browse?${browseScope}`} $variant="primary">
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
              <Odometer value={figures?.entries} />
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
                  <AnimatedNumber value={figure.value} />
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
          <ChartEmpty>No requests in the last 30 days</ChartEmpty>
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

      <Gauges>
        <GaugeCard $padding="none" $stack style={{ ['--i' as string]: 5 }}>
          {loading ? (
            <SkeletonBlock
              $width="148px"
              $height="148px"
              style={{ borderRadius: '50%' }}
            />
          ) : (
            <OrbitChart
              key={chains.join('-')}
              segments={breakdown.segments}
              total={leading ? `${Math.round(leading.share * 100)}%` : '—'}
              caption={leading ? `in ${leading.label}` : 'No entries'}
              ariaLabel={`${breakdown.title}: ${breakdown.segments
                .map(
                  (seg) =>
                    `${seg.label} ${formatInt(seg.value)} (${breakdownTotal ? Math.round((seg.value / breakdownTotal) * 100) : 0}%)`,
                )
                .join(', ')}`}
              size={168}
            />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3>{breakdown.title}</h3>
            <Legend aria-label={breakdown.title}>
              {breakdown.segments.map((seg) => (
                <li key={seg.key}>
                  <i style={{ background: seg.color }} aria-hidden />
                  <span title={seg.label}>{seg.label}</span>
                  <b>{loading ? '—' : formatInt(seg.value)}</b>
                </li>
              ))}
            </Legend>
          </div>
        </GaugeCard>
        <GaugeCard $padding="none" $stack style={{ ['--i' as string]: 6 }}>
          <BountiesRing bounties={bounties} ringKey={`b-${chains.join('-')}`} />
          <BountiesBody bounties={bounties} />
        </GaugeCard>
      </Gauges>

      <VerifiedLists
        lists={verifiedLists}
        loading={loading}
        browseHref={`/browse?trust=verified&${browseScope}`}
        scopeKey={chains.join('-')}
        failed={partialChains.length > 0}
      />

      <SectionHead>
        <SectionTitle>Happening now</SectionTitle>
      </SectionHead>
      {loading || !figures ? (
        <BoardSkeleton>
          <SkeletonBlock $height="380px" />
          <SkeletonBlock $height="380px" />
        </BoardSkeleton>
      ) : (
        <HappeningNow
          open={board.open}
          live={board.live}
          rulings={rulings}
          figures={figures}
          openLists={board.openLists}
          now={now}
          checking={checkingWindows}
          stakeHref={
            scoped.some((registry) => registry.kind === 'permanent')
              ? `/browse?trust=all&kind=permanent&${browseScope}`
              : undefined
          }
        />
      )}

      <SectionHead>
        <SectionTitle>Most active</SectionTitle>
        <SeeAll to={`/browse?trust=all&sort=activity&${browseScope}`}>
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
                    onClick={() => navigate(registryHref(registry))}
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
                            <Small $muted>{kindLabel(registry.kind)}</Small>
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
            <EmptyNote>No curator activity in the last 30 days.</EmptyNote>
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
