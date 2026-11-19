import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import styled from 'styled-components'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ethers } from 'ethers'
import localforage from 'localforage'
import { STALE_TIME } from 'consts'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import { WalletContext } from 'contexts/wallet-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { PERMANENT_ITEMS_QUERY, PERMANENT_REGISTRY_QUERY } from 'utils/graphql'
import { PERMANENT_DISPUTED_BEFORE_QUERY } from 'utils/graphql/permanent-items'
import {
  P_FILTER_KEYS,
  searchStrToFilterObjPermanent,
  selectStatusFilter,
  updateStandardFilter,
} from 'utils/filters'
import { parseIpfs } from 'utils/ipfs-parse'
import { sanitizeMetaEvidence } from 'utils/meta-evidence-guard'
import {
  capitalizeFirstLetter,
  jurorsAndCourtIDFromExtraData,
} from 'utils/string'
import { truncateAtWord } from 'utils/truncate-at-word'
import { formatDurationLong } from 'utils/time'
import { getAddressPage } from 'utils/network-utils'
import { STATUS_CODE } from 'utils/permanent-item-status'
import { isKlerosArbitrator } from 'config/tcr-addresses'
import useUrlChainId from 'hooks/use-url-chain-id'
import useArbitrationCost from 'hooks/arbitration-cost'
import useTokenSymbol from 'hooks/token-symbol'
import useNativeCurrency from 'hooks/native-currency'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import useCourtName from 'hooks/use-court-name'
import { useAttachment } from 'hooks/use-attachment'
import { useEthersProvider } from 'hooks/ethers-adapters'
import ETHAmount from 'components/eth-amount'
import TokenAmount from 'components/token-amount'
import { Pagination } from 'components/ui'
import {
  courtPhrase,
  RegistryHeader,
  type RegistryParameter,
  type RegistryStat,
} from 'components/curate/registry-header'
import {
  RegistryToolbar,
  scrollToToolbar,
  type FilterChip,
} from 'components/curate/registry-toolbar'
import {
  EntryList,
  tableColumns,
  type EntryRow,
} from 'components/curate/entry-list'
import { stakeEntryStatus } from 'components/curate/entry-status'
import type { ExplainerStep } from 'components/curate/explainer'
import type { V2Field } from 'components/curate/v2'
import {
  Button,
  Data,
  EmptyState,
  Page,
  Small,
  Surface,
  truncateMiddle,
  VisuallyHidden,
} from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import { CuratorAddress } from 'components/curate/chrome-address'
import { ListGovernance } from 'components/curate/list-governance'
import {
  SUMMARY_CAP,
  useStakeSummary,
} from 'components/curate/registry-stake-summary'
import { RegistryListSkeleton } from 'components/curate/registry-standard-states'
import {
  REGISTRY_LAYOUT_OPTIONS,
  useRegistryLayout,
} from 'components/curate/registry-shared-layout'
import { useRegistryVerified } from 'components/curate/registry-shared-verified'
import {
  listSearchFrom,
  withListSearch,
} from 'components/curate/registry-shared-search'
import ErrorPage from '../error-page'
import { LIST_LOAD_FAILED } from '../error-page/copy'

/*
 * Stake Curate registry page. The registry is read first (its periods and
 * multipliers are needed to derive statuses), then the items for the current
 * filters and page, and a summary of every entry for the counts and the
 * challenge figures. The UI is RegistryHeader (identity, action, "Update
 * list parameters" for the list's governor alone, figures, the two gauges,
 * parameters, explainer), RegistryToolbar, EntryList and Pagination.
 */

const NSFW_FILTER_KEY = 'NSFW_FILTER_KEY'
const ITEMS_PER_PAGE = 40
/** How long the MetaEvidence file may take before its read is tried again. */
const COLUMNS_TIMEOUT_MS = 20_000

// Registries whose description says "see terms and conditions" link to them.
const TERMS_AND_CONDITIONS_URLS: Record<string, string | undefined> = {
  '0x7305c57b731876f452da8574a77d05957820e588':
    'https://cdn.kleros.link/ipfs/QmcZ53agYqpPhYijRFzduC3EC64coFGZkhbRN1sPDyW7di',
}

// One run of spaces before "and" and one after: two \s* side by side split a
// long run of spaces every possible way (quadratic time on list text).
const TERMS_PATTERN = /see\s+(?:the\s+)?terms?\s*(?:(?:and|&)\s*)?conditions?/gi

/** Statuses hidden behind a reveal while the sensitive-content filter is on. */
const HIDDEN_STATUSES = new Set([
  STATUS_CODE.REJECTED,
  STATUS_CODE.REMOVED,
  STATUS_CODE.WITHDRAWN,
  STATUS_CODE.DISPUTED,
  STATUS_CODE.CROWDFUNDING,
  STATUS_CODE.CROWDFUNDING_WINNER,
])

/** Label of the synthetic locked-stake column, shown in every layout. */
const STAKE_COLUMN_LABEL = 'Locked stake'

/** The stake column, with a label the registry's own columns do not use. */
const stakeColumnFor = (columns: V2Field[]): V2Field => {
  const labels = new Set(columns.map((column) => column.label))
  return {
    label: labels.has(STAKE_COLUMN_LABEL)
      ? `${STAKE_COLUMN_LABEL} (token)`
      : STAKE_COLUMN_LABEL,
    type: 'text',
  }
}

/**
 * A Stake Curate subgraph item: decoded fields arrive nested under
 * `metadata.props` or flattened as `props`.
 */
interface StakeItem extends SubgraphItem {
  itemID: string
  metadata?: { props?: V2Field[] } | null
  props?: V2Field[]
}

const integer = new Intl.NumberFormat('en-US')
const formatInt = (value: number) => integer.format(value)

/**
 * The Stake Curate subgraph reports negative counters on some lists (one
 * reports -2 submitted). A negative count is a broken counter, not a number
 * to show.
 */
const isCount = (value: number) => Number.isFinite(value) && value >= 0

/** The "Previously disputed" count reads at most this many ids. */
const DISPUTED_BEFORE_LIMIT = 1000

const itemFields = (item: StakeItem): V2Field[] =>
  item.metadata?.props ?? item.props ?? []

const matchesSearch = (item: StakeItem, rawSearch: string): boolean => {
  const query = rawSearch.trim().toLowerCase()
  if (!query) return true
  const text = [
    item.itemID,
    item.status,
    ...itemFields(item).map(
      (field) => `${field.label ?? ''} ${String(field.value ?? '')}`,
    ),
  ]
    .join(' ')
    .toLowerCase()
  return text.includes(query)
}

/** Token amount in units, trimmed to three decimals, as TokenAmount does. */
const formatToken = (
  amount: string | number | undefined,
  decimals: number,
): string => {
  if (amount === undefined) return ''
  const [whole, fraction = ''] = ethers.utils
    .formatUnits(String(amount), decimals)
    .split('.')
  const trimmed = fraction.slice(0, 3).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

/** "50%" from a basis-point multiplier and the contract's divisor. */
const formatPercent = (
  multiplier: string | number,
  divisor: string | number,
): string | undefined => {
  const m = Number(multiplier)
  const d = Number(divisor)
  if (!Number.isFinite(m) || !Number.isFinite(d) || d <= 0) return
  return `${Number(((m * 100) / d).toFixed(2))}%`
}

const seconds = (value: string | number | undefined): number | undefined => {
  if (value === undefined) return
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const TermsLink = styled.a`
  color: var(--color-primary);
  text-decoration: underline;

  &:hover {
    color: var(--color-primary-hover);
  }
`

/* A contract's explorer link (the arbitrator), as on a Standard list: a
   24px target with its arrow, and it says it opens a new tab. */
const ExplorerLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  color: var(--color-primary);
  text-decoration: none;

  svg {
    flex: 0 0 auto;
    opacity: 0.8;
  }

  &:hover {
    text-decoration: underline;
  }
`

const Notice = styled.div`
  margin-bottom: 12px;
`

const Entries = styled.section`
  min-width: 0;
`

const ListFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
`

/** The description with each "see terms and conditions" phrase as a link. */
const withTermsLink = (
  description: string,
  tcrAddress?: string,
): React.ReactNode => {
  const termsUrl = tcrAddress
    ? TERMS_AND_CONDITIONS_URLS[tcrAddress.toLowerCase()]
    : undefined
  if (!termsUrl) return description

  const parts: React.ReactNode[] = []
  const regex = new RegExp(TERMS_PATTERN.source, 'gi')
  let lastIndex = 0
  let match = regex.exec(description)
  while (match) {
    if (match.index > lastIndex)
      parts.push(description.slice(lastIndex, match.index))
    parts.push(
      <TermsLink
        key={match.index}
        href={termsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {match[0]}
      </TermsLink>,
    )
    lastIndex = regex.lastIndex
    match = regex.exec(description)
  }
  if (parts.length === 0) return description
  if (lastIndex < description.length) parts.push(description.slice(lastIndex))
  return <>{parts}</>
}

/* The court and its jury after the arbitrator's address break only at the
   dots between them, so a narrow column never leaves "jurors" alone. Each
   is a box of its own rather than unbreakable text, so a court name longer
   than the column still wraps inside it instead of running out. */
const Unbroken = styled.span`
  display: inline-block;
  max-width: 100%;
`

/** A contract's address (the arbitrator): it opens the chain's explorer. */
const AddressValue = ({
  chainId,
  address,
}: {
  chainId: number
  address?: string
}) => {
  if (!address) return null
  return (
    <ExplorerLink
      href={getAddressPage({ networkId: chainId, address })}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
    >
      {truncateMiddle(address, 6, 4)}
      <CurateIcon name="external" size={14} />
      <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
    </ExplorerLink>
  )
}

const StakeRegistry = () => {
  const navigate = useNavigate()
  const { search } = useLocation()
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const chainId = useUrlChainId()
  const timestamp = useContext(WalletContext)?.timestamp
  const now = useNow()
  const openAttachment = useAttachment()
  const { graphqlBatcher } = useGraphqlBatcher()
  const library = useEthersProvider({ chainId: chainId ?? undefined })
  const nativeCurrency = useNativeCurrency()
  const [layout, setLayout] = useRegistryLayout('registry-entries')
  // The pager sits at the foot of the list: a new page starts at its top.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const trust = useRegistryVerified(chainId, tcrAddress)
  // Sensitive entries show unless the reader hides them (round 7); their
  // choice is kept and restored below.
  const [nsfwFilterOn, setNsfwFilterOn] = useState(false)
  // The search box lives in the URL (?q=), so Back from an entry, a reload
  // or a shared link keeps it. Typing replaces the history entry: Back
  // leaves the list instead of undoing keystrokes. It filters the page on
  // screen, so typing stays on that page.
  const itemSearch = listSearchFrom(search)
  const setItemSearch = (term: string) =>
    navigate(
      { search: withListSearch(search, term, { keepPage: true }) },
      { replace: true },
    )
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())

  const queryOptions = searchStrToFilterObjPermanent(search)
  const { oldestFirst, page, absent, registered, disputed, disputedBefore } =
    queryOptions
  const currentPage = Number(page) || 1
  const registryId = tcrAddress?.toLowerCase()

  // The registry comes first: its periods and multipliers drive everything.
  const registryQuery = useQuery({
    queryKey: ['permanentRegistry', tcrAddress, chainId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: PERMANENT_REGISTRY_QUERY,
        variables: { lowerCaseTCRAddress: registryId },
        chainId: chainId!,
        isPermanent: true,
      }),
    enabled: !!chainId && !!registryId,
    staleTime: Infinity,
  })
  const registry = registryQuery.data?.registry as SubgraphRegistry | undefined

  // "Listed" filters to every entry on the list, the disputed ones
  // included (see onListCount below); "Disputed" narrows to those alone.
  // "Previously disputed" is every entry ever challenged (each challenge is
  // a dispute), whatever its status now.
  const itemsWhere = useMemo(() => {
    const statuses: string[] = []
    if (absent) statuses.push('Absent')
    if (registered) statuses.push('Submitted', 'Reincluded', 'Disputed')
    else if (disputed) statuses.push('Disputed')
    const history = disputedBefore ? { challenges_: { id_not: null } } : {}
    if (statuses.length === 0) return { registry: registryId, ...history }
    return { registry: registryId, ...history, status_in: statuses }
  }, [absent, registered, disputed, disputedBefore, registryId])

  // How many entries have ever been challenged: the list's size under the
  // status menu's "Previously disputed" (which shows no count).
  const disputedBeforeQuery = useQuery({
    queryKey: ['permanentDisputedBefore', chainId, registryId],
    queryFn: (): Promise<{ items?: { id: string }[] }> =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: PERMANENT_DISPUTED_BEFORE_QUERY,
        variables: { registry: registryId, first: DISPUTED_BEFORE_LIMIT },
        chainId: chainId!,
        isPermanent: true,
      }),
    enabled: !!chainId && !!registryId,
    staleTime: STALE_TIME,
  })
  const disputedBeforeCount = disputedBeforeQuery.data?.items?.length

  const itemsVariables = useMemo(
    () => ({
      skip: (currentPage - 1) * ITEMS_PER_PAGE,
      first: ITEMS_PER_PAGE,
      orderDirection: oldestFirst ? 'asc' : 'desc',
      where: itemsWhere,
    }),
    [currentPage, oldestFirst, itemsWhere],
  )

  const itemsQuery = useQuery({
    queryKey: ['permanentItems', chainId, itemsVariables],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: PERMANENT_ITEMS_QUERY,
        variables: itemsVariables,
        chainId: chainId!,
        isPermanent: true,
      }),
    enabled: !!registry && !!chainId,
    staleTime: STALE_TIME,
  })

  // The columns live only in the MetaEvidence file, not in the subgraph.
  // Whoever runs the list writes that file: only well-typed columns reach
  // the page (a label that is an object would take it down for everyone).
  // A failed, malformed or stalled read throws, so it is retried and the
  // entries' own labels stand in meanwhile.
  const arbitrationSetting = registry?.arbitrationSettings?.[0]
  const metaEvidenceURI = arbitrationSetting?.metaEvidenceURI
  const columnsQuery = useQuery({
    queryKey: ['permanentRegistryColumns', metaEvidenceURI],
    queryFn: async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(
        () => controller.abort(),
        COLUMNS_TIMEOUT_MS,
      )
      try {
        const response = await fetch(parseIpfs(metaEvidenceURI!), {
          signal: controller.signal,
        })
        if (!response.ok)
          throw new Error(`MetaEvidence read failed (${response.status})`)
        const file = sanitizeMetaEvidence(await response.json())
        if (!file) throw new Error('MetaEvidence is not a JSON object')
        return file.metadata?.columns ?? []
      } finally {
        window.clearTimeout(timeout)
      }
    },
    enabled: !!metaEvidenceURI,
    staleTime: Infinity,
  })
  const columns = columnsQuery.data

  // Governor and the multiplier divisor are not indexed; read them on-chain.
  const contractQuery = useQuery({
    queryKey: ['permanentRegistryContract', chainId, registryId],
    queryFn: async () => {
      const contract = new ethers.Contract(tcrAddress!, _gtcr, library!)
      const [governor, divisor] = await Promise.all([
        contract.governor(),
        contract.MULTIPLIER_DIVISOR(),
      ])
      return { governor: String(governor), divisor: String(divisor) }
    },
    enabled: !!tcrAddress && !!library,
    staleTime: Infinity,
  })

  const arbitrationCost = useArbitrationCost({
    address: registry?.arbitrator?.id,
    arbitratorExtraData: arbitrationSetting?.arbitratorExtraData,
    library,
  })
  const {
    symbol: tokenSymbol,
    decimals: tokenDecimals,
    loading: tokenLoading,
  } = useTokenSymbol(registry?.token)
  // Amounts wait for the token's decimals and symbol: formatted with the
  // defaults (18, "tokens") they would be wrong on any other token.
  const tokenReady = !!registry?.token && !tokenLoading
  const tokenName = tokenReady ? tokenSymbol : 'the list token'

  // The sensitive-content setting is shared with the other registry pages.
  useEffect(() => {
    void (async () => {
      try {
        const saved = await localforage.getItem(NSFW_FILTER_KEY)
        if (typeof saved === 'boolean') setNsfwFilterOn(saved)
      } catch {
        // Storage can be blocked (private windows): keep the default.
      }
    })()
  }, [])
  const toggleNsfwFilter = useCallback((checked: boolean) => {
    setNsfwFilterOn(checked)
    localforage.setItem(NSFW_FILTER_KEY, checked)
  }, [])

  // Every entry of the list, for exact counts and the challenge figures.
  const {
    summary,
    loading: summaryLoading,
    failed: summaryFailed,
  } = useStakeSummary({ chainId, registryId })
  const fullSummary = summary && !summary.partial ? summary : undefined

  // The counts the page shows; undefined means unknown, shown as '—'. With
  // the whole list in hand they are counted from the entries. Otherwise they
  // are the subgraph's counters, which drift on some lists: one negative
  // counter makes every bucket unreliable, so only their raw sum stands
  // (each status change moves one entry from one counter to another).
  const counts = useMemo((): {
    listed?: number
    disputed?: number
    absent?: number
    total?: number
  } => {
    if (fullSummary)
      return {
        listed: fullSummary.buckets.listed,
        disputed: fullSummary.buckets.disputed,
        absent: fullSummary.buckets.absent,
        total: fullSummary.total,
      }
    if (!registry) return {}
    const submitted = Number(registry.numberOfSubmitted)
    const absentCount = Number(registry.numberOfAbsent)
    const disputedCount = Number(registry.numberOfDisputed)
    const sum = submitted + absentCount + disputedCount
    const total = isCount(sum) ? sum : undefined
    if (!isCount(submitted) || !isCount(absentCount) || !isCount(disputedCount))
      return { total }
    return {
      listed: submitted,
      disputed: disputedCount,
      absent: absentCount,
      total,
    }
  }, [fullSummary, registry])

  // Hold the figures back while the summary loads, so a drifted counter
  // never flashes before the real count.
  const countsReady = !!registry && !summaryLoading

  // How many entries are on the list: a Stake entry is listed from the
  // moment it was submitted and stays listed while a challenge runs, so the
  // figure under the word "listed" is submitted plus disputed — the measure
  // Browse and the dashboard print for the same list, and the one the
  // "Listed" chip below counts and filters to. The "Disputed" chip is the
  // part of it a challenge is running on; "Off the list" is the rest.
  const onListCount =
    counts.listed !== undefined && counts.disputed !== undefined
      ? counts.listed + counts.disputed
      : undefined

  // The batcher resolves failed requests to {}, so guard the items field.
  const pageItems = itemsQuery.data?.items as StakeItem[] | undefined
  const items: StakeItem[] = useMemo(() => pageItems ?? [], [pageItems])

  // Entries matching the status filters, from the counts above; undefined
  // when a bucket it needs is unknown. "Listed" already holds the disputed
  // entries, so with it on the "Disputed" chip adds nothing more.
  const filteredCount = useMemo((): number | undefined => {
    if (disputedBefore) return disputedBeforeCount
    if (!absent && !registered && !disputed) return counts.total
    const parts = [
      absent ? counts.absent : 0,
      registered ? counts.listed : 0,
      registered || disputed ? counts.disputed : 0,
    ]
    if (parts.some((part) => part === undefined)) return undefined
    return parts.reduce<number>((sum, part) => sum + (part ?? 0), 0)
  }, [
    absent,
    registered,
    disputed,
    counts,
    disputedBefore,
    disputedBeforeCount,
  ])

  // How many entries match, undefined when unknown. A short page is the last
  // one, so it gives the exact total; a full page proves at least that many.
  // An empty page past the first proves nothing, so the counts stand in.
  const pageStartIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const pageLength = pageItems?.length
  const itemCount = useMemo((): number | undefined => {
    if (!registry) return undefined
    if (pageLength === undefined) return filteredCount
    if (pageLength === 0) return currentPage === 1 ? 0 : filteredCount
    if (pageLength < ITEMS_PER_PAGE) return pageStartIndex + pageLength
    return filteredCount === undefined
      ? undefined
      : Math.max(filteredCount, pageStartIndex + pageLength)
  }, [registry, pageLength, currentPage, pageStartIndex, filteredCount])

  const visibleItems = useMemo(
    () => items.filter((item) => matchesSearch(item, itemSearch)),
    [items, itemSearch],
  )

  // Columns live in the MetaEvidence file. Until it loads, or when the IPFS
  // fetch fails, the first entry's own labels stand in.
  const baseColumns = useMemo<V2Field[]>(
    () => columns ?? (items[0] ? itemFields(items[0]) : []),
    [columns, items],
  )
  const stakeColumn = useMemo(() => stakeColumnFor(baseColumns), [baseColumns])

  const metadata = arbitrationSetting?.metadata
  const title = metadata?.title
  const itemName = metadata?.itemName || 'entry'
  const itemNamePlural = metadata?.itemNamePlural || `${itemName}s`
  const policyURI = metadata?.policyURI

  const normalizedDescription = metadata?.description
    ? metadata.description.endsWith('.')
      ? metadata.description
      : `${metadata.description}.`
    : ''
  const description = capitalizeFirstLetter(normalizedDescription)
  const descriptionNode = description
    ? withTermsLink(description, tcrAddress)
    : undefined

  useDocumentHead(
    truncateAtWord(title ? `${title} | Kleros Curate` : 'Kleros Curate', 60),
    truncateAtWord(
      title
        ? `Explore the ${title} list on Kleros Curate: ${normalizedDescription}`
        : 'Explore curated lists on Kleros Curate.',
      160,
    ),
  )

  const openSubmit = useCallback(() => {
    if (chainId && tcrAddress) navigate(`/tcr/${chainId}/${tcrAddress}/submit`)
  }, [chainId, tcrAddress, navigate])

  const openPolicy = useCallback(() => {
    if (policyURI) openAttachment(parseIpfs(policyURI), true)
  }, [policyURI, openAttachment])

  const reveal = useCallback((itemID: string) => {
    setRevealed((previous) => new Set(previous).add(itemID))
  }, [])

  const entries: EntryRow[] = useMemo(
    () =>
      visibleItems.map((item) => {
        const status = stakeEntryStatus(item, timestamp, registry)
        const hidden =
          nsfwFilterOn &&
          !revealed.has(item.itemID) &&
          status?.code !== undefined &&
          HIDDEN_STATUSES.has(status.code)
        const onList = status ? status.tone !== 'off' : true
        return {
          id: item.itemID,
          href: `/tcr/${chainId}/${tcrAddress}/${item.itemID}`,
          fields: [
            ...itemFields(item),
            {
              ...stakeColumn,
              value:
                onList && item.stake && tokenReady
                  ? `${formatToken(item.stake, tokenDecimals)} ${tokenSymbol}`
                  : '',
            },
          ],
          status,
          hidden,
          onReveal: hidden ? () => reveal(item.itemID) : undefined,
        }
      }),
    [
      visibleItems,
      timestamp,
      registry,
      nsfwFilterOn,
      revealed,
      chainId,
      tcrAddress,
      tokenDecimals,
      tokenSymbol,
      tokenReady,
      stakeColumn,
      reveal,
    ],
  )

  const listColumns = useMemo<V2Field[]>(
    () => [...tableColumns(baseColumns), stakeColumn],
    [baseColumns, stakeColumn],
  )

  // The status menu (round 6) carries the counts, as the Standard page's
  // does, once they are settled and trusted (undefined otherwise).
  const chipCount = (value?: number) => (countsReady ? value : undefined)
  const chips: FilterChip[] = [
    {
      // Every entry on the list, the disputed ones included: the same
      // "Listed" figure the header and Browse print, so the word means one
      // thing on the page.
      key: P_FILTER_KEYS.REGISTERED,
      label: 'Listed',
      count: chipCount(onListCount),
      tone: 'registered',
      checked: !!registered,
    },
    {
      key: P_FILTER_KEYS.DISPUTED,
      label: 'Disputed now',
      count: chipCount(counts.disputed),
      tone: 'contested',
      checked: !!disputed,
    },
    {
      // Withdrawn entries count here too, so it reads "Off the list"
      // rather than "Removed".
      key: P_FILTER_KEYS.ABSENT,
      label: 'Off the list',
      count: chipCount(counts.absent),
      tone: 'off',
      checked: !!absent,
    },
    {
      key: P_FILTER_KEYS.DISPUTED_BEFORE,
      label: 'Previously disputed',
      hint: 'Every entry that has been challenged, whatever its status now',
      led: true,
      divider: true,
      checked: !!disputedBefore,
    },
  ]
  const setStatus = (value: string) =>
    navigate({
      search: selectStatusFilter({
        prevQuery: search,
        keys: chips.map((chip) => chip.key),
        value,
      }),
    })

  const setFilter = (filter: string, checked: boolean) =>
    navigate({
      search: updateStandardFilter({ prevQuery: search, filter, checked }),
    })

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(search)
    params.set(P_FILTER_KEYS.PAGE, String(nextPage))
    navigate({ search: `?${params.toString()}` })
    scrollToToolbar(toolbarRef.current)
  }

  const minStake =
    registry?.submissionMinDeposit && tokenReady ? (
      <TokenAmount
        amount={registry.submissionMinDeposit}
        tokenDecimals={tokenDecimals}
        precision={3}
        displayUnit={` ${tokenSymbol}`}
      />
    ) : undefined
  const arbitrationDeposit = arbitrationCost.arbitrationCost ? (
    <ETHAmount
      amount={arbitrationCost.arbitrationCost}
      displayUnit={` ${nativeCurrency}`}
    />
  ) : undefined
  const divisor = contractQuery.data?.divisor
  const challengePercent =
    registry?.challengeStakeMultiplier !== undefined && divisor
      ? formatPercent(registry.challengeStakeMultiplier, divisor)
      : undefined
  const withdrawingPeriod = seconds(registry?.withdrawingPeriod)
  const periodValue = (value: string | number | undefined) => {
    const s = seconds(value)
    // A zero period is a setting ("accepted right away"), not a duration.
    if (s === 0) return 'None'
    return s === undefined ? undefined : formatDurationLong(s)
  }

  // The extra data encodes the court id and the number of jurors drawn.
  const arbitratorExtraData = arbitrationSetting?.arbitratorExtraData
  const court = useMemo(() => {
    if (!arbitratorExtraData) return undefined
    try {
      return jurorsAndCourtIDFromExtraData(arbitratorExtraData)
    } catch {
      return undefined
    }
  }, [arbitratorExtraData])
  // Jurors are named only when the list's arbitrator is this chain's Kleros
  // court; any other arbitrator is "the arbitrator", and its court ids are
  // not Kleros courts, so only a Kleros court is looked up by name.
  const klerosArbitrated = isKlerosArbitrator(chainId, registry?.arbitrator?.id)
  // The court by its name ("xDai Curation"), as the factory and the dispute
  // panel name it; its number only while the name loads or if it cannot be
  // read.
  const courtName = useCourtName(
    chainId,
    klerosArbitrated ? court?.courtID : undefined,
  )
  const courtTitle = court ? (courtName ?? `Court ${court.courtID}`) : undefined
  const jurorsLabel = court
    ? `${court.numberOfJurors} juror${court.numberOfJurors === 1 ? '' : 's'}`
    : undefined

  // RegistryHeader prints '—' (or a skeleton) for an undefined value.
  const countValue = (value?: number) =>
    countsReady && value !== undefined ? formatInt(value) : undefined

  const stats: RegistryStat[] = [
    { label: 'Entries', value: countValue(counts.total) },
    { label: 'Listed', value: countValue(onListCount) },
    { label: 'Disputed', value: countValue(counts.disputed) },
    // Summed from every entry, so only with the whole list; the slot holds
    // its place while the summary and the token's decimals load.
    ...(fullSummary || summaryLoading
      ? [
          {
            label: 'Locked stake',
            value:
              fullSummary && tokenReady
                ? `${formatToken(fullSummary.locked.toString(), tokenDecimals)} ${tokenSymbol}`
                : undefined,
          },
        ]
      : []),
  ]

  // The button names the whole deposit only once both parts are known. If
  // the arbitration cost cannot be read, it names the minimum stake as such
  // and the note says what is added on top.
  const arbitrationFailed = !!arbitrationCost.error && !arbitrationDeposit
  const primaryAmount =
    minStake && arbitrationDeposit ? (
      <>
        {minStake} + {arbitrationDeposit}
      </>
    ) : minStake && arbitrationFailed ? (
      minStake
    ) : undefined
  const depositFallback = !!minStake && !arbitrationDeposit && arbitrationFailed

  const parameters: RegistryParameter[] = [
    {
      label: 'Minimum stake',
      value: minStake,
      hint: `Locked in ${tokenName} for as long as the ${itemName} is listed. You can stake more than the minimum.`,
    },
    {
      label: 'Arbitration deposit',
      value: arbitrationDeposit,
      hint: `Paid in ${nativeCurrency} with the stake and held with the ${itemName}. If a challenger wins it goes to them to cover the juror fees they paid; if you win it stays locked; it comes back with the stake when you withdraw.`,
    },
    {
      label: 'Challenger stake',
      value: challengePercent
        ? `${challengePercent} of the entry's stake`
        : registry?.challengeStakeMultiplier !== undefined
          ? `${registry.challengeStakeMultiplier} (raw multiplier)`
          : undefined,
      hint: challengePercent
        ? `Locked in ${tokenName} by the challenger, who also pays the arbitration cost to the court. If the challenge fails it is added to the entry's stake.`
        : "Share of the entry's stake, in basis points; the percentage appears once the contract divisor has loaded.",
    },
    {
      label: 'Submission period',
      value: periodValue(registry?.submissionPeriod),
      hint: `After this a new ${itemName} counts as accepted. It can still be challenged.`,
    },
    {
      label: 'Reinclusion period',
      value: periodValue(registry?.reinclusionPeriod),
      hint: `After a ruling keeps the ${itemName}, it counts as accepted again once this period has passed.`,
    },
    {
      label: 'Withdrawing period',
      value: periodValue(registry?.withdrawingPeriod),
      hint: `Between starting a withdrawal and taking the stake back. The ${itemName} can still be challenged meanwhile.`,
    },
    {
      // The Stake wizard's name and words: entries added after a change
      // take the new settings at once (PermanentGTCR challengeItem).
      label: 'Cooldown',
      value: periodValue(registry?.arbitrationParamsCooldown),
      hint: 'How long a new policy or court waits before it applies to entries already listed.',
    },
    {
      label: 'Arbitrator',
      value:
        chainId && registry?.arbitrator?.id ? (
          <>
            <AddressValue chainId={chainId} address={registry.arbitrator.id} />
            {court && (
              <span title={`Extra data ${arbitratorExtraData}`}>
                {' · '}
                <Unbroken>{courtTitle}</Unbroken>
                {' · '}
                <Unbroken>{jurorsLabel}</Unbroken>
              </span>
            )}
          </>
        ) : undefined,
      hint: court
        ? `Challenges go to ${
            courtName
              ? `the Kleros ${courtPhrase(courtName)}`
              : `court ${court.courtID}`
          }, which draws ${jurorsLabel}.`
        : arbitratorExtraData
          ? `Extra data ${arbitratorExtraData.slice(0, 18)}…`
          : undefined,
    },
    {
      // The governor is a person (or their multisig): their Curate profile,
      // where the lists they govern are, not the explorer.
      label: 'Governor',
      value: contractQuery.data?.governor ? (
        <CuratorAddress address={contractQuery.data.governor} />
      ) : undefined,
      hint: 'Can change the periods, the multipliers and the arbitration settings.',
    },
    {
      label: 'Off the list',
      value: countValue(counts.absent),
      hint: `${capitalizeFirstLetter(itemNamePlural)} no longer on the list: withdrawn, or removed after a challenge.`,
    },
  ]

  const explainerSteps: ExplainerStep[] = [
    {
      title: 'Stake to list',
      body: (
        <>
          You lock{' '}
          {minStake ? (
            <>
              at least <Data>{minStake}</Data>
            </>
          ) : (
            'the minimum stake'
          )}{' '}
          and{' '}
          {arbitrationDeposit ? (
            <>
              a <Data>{arbitrationDeposit}</Data> arbitration deposit
            </>
          ) : (
            'an arbitration deposit'
          )}
          . They back your {itemName} while it is listed and come back when you
          withdraw
          {withdrawingPeriod !== undefined
            ? `, which takes ${formatDurationLong(withdrawingPeriod)}.`
            : '.'}
        </>
      ),
    },
    {
      title: 'Spot a mistake, earn the stake',
      body: `Challenge a ${itemName} that breaks the policy, at any time, by locking ${
        challengePercent
          ? `${challengePercent} of its stake`
          : 'a share of its stake'
      } plus the arbitration cost. If ${
        klerosArbitrated ? 'Kleros jurors agree' : 'the arbitrator agrees'
      }, you take its whole stake and its arbitration deposit, and your own stake comes back.`,
    },
    {
      title: 'Kept on the list, your stake grows',
      body: `If ${
        klerosArbitrated ? 'the jurors keep' : 'the arbitrator keeps'
      } your ${itemName}, the challenger's stake is added to yours, so the next challenge costs more (progressive protection).`,
    },
  ]

  if (!chainId || !tcrAddress)
    return (
      <ErrorPage
        code="404"
        title="List not found"
        message="This address does not point to a Stake Curate list on a supported chain."
      />
    )

  if (registryQuery.isError && !registryQuery.data)
    return (
      <ErrorPage
        code="Error"
        title="This list did not load"
        message={LIST_LOAD_FAILED}
        onRetry={() => void registryQuery.refetch()}
      />
    )

  if (registryQuery.data && !registry)
    return (
      <ErrorPage
        code="404"
        title="List not found"
        message="This Stake Curate list could not be loaded."
        tip="Check the address and the chain in the address bar. Is this list on Gnosis?"
      />
    )

  const loading = !registry
  const itemsLoading = loading || itemsQuery.isLoading
  const pageStart = pageStartIndex + 1
  // A page past the end of the list: it came back empty.
  const outOfRange = !itemsLoading && pageLength === 0 && currentPage > 1
  // A full page with an unknown total: at least this many, maybe more.
  const fullPageFloor =
    itemCount === undefined && pageLength === ITEMS_PER_PAGE
      ? pageStartIndex + ITEMS_PER_PAGE
      : undefined
  const footerTotal = itemCount ?? fullPageFloor
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, footerTotal ?? 0)
  const showFooter =
    !itemsLoading &&
    !outOfRange &&
    footerTotal !== undefined &&
    footerTotal > 0 &&
    pageStart <= footerTotal
  const toolbarTotal =
    itemCount ?? (outOfRange ? 0 : pageStartIndex + items.length)
  // The search box's count stays blank (never "0 of 0") until the page and
  // the counts are in, and when the page did not load.
  const countUnknown =
    itemsLoading || !countsReady || (itemsQuery.isError && !itemsQuery.data)
  // No filter and no search, yet nothing on the first page: an empty list.
  const anyFilter = !!(absent || registered || disputed || disputedBefore)
  const listEmpty = !anyFilter && !itemSearch.trim()
  const noun = (count: number) => (count === 1 ? itemName : itemNamePlural)
  const outOfRangeLine =
    itemCount === undefined
      ? 'This page is past the end of the list.'
      : itemCount === 0
        ? `No ${itemNamePlural} match${anyFilter ? ' this status' : ' yet'}.`
        : anyFilter
          ? `${formatInt(itemCount)} ${noun(itemCount)} ${
              itemCount === 1 ? 'matches' : 'match'
            } this status, all on earlier pages.`
          : `This list has ${formatInt(itemCount)} ${noun(itemCount)}, all on earlier pages.`

  return (
    <Page>
      <RegistryHeader
        title={title}
        // RegistryHeader types the description as a string; the terms link
        // needs a node. React renders either, so the node goes through.
        description={descriptionNode as string}
        logoURI={metadata?.logoURI}
        chainId={chainId}
        address={tcrAddress}
        verified={trust.verified}
        listOfLists={trust.listOfLists}
        kind="permanent"
        itemName={itemName}
        itemNamePlural={itemNamePlural}
        primaryLabel={`Submit ${itemName}`}
        primaryAmount={primaryAmount}
        depositNote={
          depositFallback
            ? `Plus an arbitration deposit in ${nativeCurrency} that could not be read just now. Both stay locked while your ${itemName} is listed and come back when you withdraw, unless a challenge succeeds.`
            : undefined
        }
        onPrimary={openSubmit}
        policyURI={policyURI}
        onOpenPolicy={policyURI ? openPolicy : undefined}
        // The policy history reads Standard events only; on a
        // Stake list it would shimmer and then show nothing.
        policyUpdated={false}
        stats={stats}
        // The same figure the "Listed" stat above carries, as the list's
        // first gauge: a Stake entry is listed from the moment it was
        // submitted, so the word is "listed", never "registered".
        registeredCount={countsReady ? onListCount : undefined}
        totalCount={countsReady ? counts.total : undefined}
        registeredLabel="Listed now"
        // The second gauge: what the challenges did to the entries read. A
        // capped read is a lower bound, and says what it was counted from.
        challenges={
          summaryFailed || !summary
            ? undefined
            : {
                offList: summary.challenges.removed,
                onList: summary.challenges.kept,
                inCourt: summary.challenges.open,
                scope: summary.partial
                  ? `the latest ${formatInt(SUMMARY_CAP)} entries`
                  : undefined,
              }
        }
        parameters={parameters}
        explainerId={`registry-stake-${tcrAddress.toLowerCase()}`}
        explainerHeading="A stake backs every entry. Spot a bad one and it is yours."
        explainerSteps={explainerSteps}
        loading={loading || summaryLoading}
        // The governor read on chain through the list's own chain (the
        // contract query above), so a governor whose wallet is on another
        // chain still sees the control. It waits for the indexed list too:
        // the control reads the parameters with the list's token, live
        // MetaEvidence and court settings, and keeps what it read with.
        governance={
          <ListGovernance
            chainId={chainId}
            address={tcrAddress}
            kind="permanent"
            title={title}
            logoURI={metadata?.logoURI}
            token={registry?.token}
            metaEvidenceURI={metaEvidenceURI}
            arbitratorExtraData={arbitratorExtraData}
            governor={registry ? contractQuery.data?.governor : undefined}
            onSaved={() => {
              void contractQuery.refetch()
              void registryQuery.refetch()
            }}
          />
        }
      />

      <div ref={toolbarRef}>
        <RegistryToolbar
          search={itemSearch}
          onSearch={setItemSearch}
          placeholder={`Search ${itemNamePlural}`}
          chips={chips}
          onStatusChange={setStatus}
          sort={oldestFirst ? 'oldest' : 'newest'}
          onSortChange={(sort) =>
            setFilter(P_FILTER_KEYS.OLDEST_FIRST, sort === 'oldest')
          }
          layout={layout}
          onLayoutChange={setLayout}
          layoutOptions={REGISTRY_LAYOUT_OPTIONS}
          nsfwFilter={nsfwFilterOn}
          onNsfwChange={toggleNsfwFilter}
          shown={countUnknown ? undefined : entries.length}
          total={countUnknown ? undefined : toolbarTotal}
        />
      </div>

      {columnsQuery.isError && (
        <Notice role="status">
          <Small $muted>
            Column names could not be loaded; showing the entries&apos; own
            labels.
          </Small>
        </Notice>
      )}

      <Entries
        aria-label={capitalizeFirstLetter(itemNamePlural)}
        aria-busy={itemsLoading}
      >
        {itemsLoading ? (
          <RegistryListSkeleton layout={layout} />
        ) : itemsQuery.isError && !itemsQuery.data ? (
          <Surface $padding="none">
            <EmptyState
              icon="list"
              titleAs="h2"
              title={`The ${itemNamePlural} did not load`}
              action={
                <Button
                  type="button"
                  $variant="secondary"
                  $size="sm"
                  onClick={() => void itemsQuery.refetch()}
                >
                  Try again
                </Button>
              }
            >
              {LIST_LOAD_FAILED}
            </EmptyState>
          </Surface>
        ) : outOfRange ? (
          <Surface $padding="none">
            <EmptyState
              icon="list"
              titleAs="h2"
              title={`No ${itemNamePlural} on page ${formatInt(currentPage)}`}
              action={
                <Button
                  type="button"
                  $variant="secondary"
                  $size="sm"
                  onClick={() => setPage(1)}
                >
                  Back to page 1
                </Button>
              }
            >
              {outOfRangeLine}
            </EmptyState>
          </Surface>
        ) : (
          <EntryList
            layout={layout}
            entries={entries}
            columns={listColumns}
            now={now}
            itemName={itemName}
            itemNamePlural={itemNamePlural}
            emptyTitle={listEmpty ? `No ${itemNamePlural} yet` : undefined}
            emptyLine={listEmpty ? 'Be the first to submit one.' : undefined}
            emptyAction={
              <Button
                type="button"
                $variant="primary"
                $size="sm"
                onClick={openSubmit}
              >
                <CurateIcon name="submit" size={14} />
                Submit {itemName}
              </Button>
            }
          />
        )}

        {showFooter && footerTotal !== undefined && (
          <ListFooter>
            <Small $muted>
              {formatInt(pageStart)}–{formatInt(pageEnd)} of{' '}
              {fullPageFloor !== undefined ? 'at least ' : ''}
              {formatInt(footerTotal)} {itemNamePlural}
            </Small>
            {(footerTotal > ITEMS_PER_PAGE || fullPageFloor !== undefined) && (
              <Pagination
                current={currentPage}
                pageSize={ITEMS_PER_PAGE}
                // An unknown total offers one more page; an empty one
                // leads back to page 1.
                total={
                  fullPageFloor !== undefined ? fullPageFloor + 1 : footerTotal
                }
                onChange={setPage}
              />
            )}
          </ListFooter>
        )}
      </Entries>
    </Page>
  )
}

export default StakeRegistry
