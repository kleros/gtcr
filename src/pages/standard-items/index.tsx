import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { succeededListOfLists } from 'config/list-of-lists'
import styled from 'styled-components'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { BigNumber, utils as ethersUtils } from 'ethers'
import localforage from 'localforage'
import { STALE_TIME } from 'consts'
import useUrlChainId from 'hooks/use-url-chain-id'
import useNow from 'hooks/use-now'
import useDocumentHead from 'hooks/use-document-head'
import useNativeCurrency from 'hooks/native-currency'
import useCourtName from 'hooks/use-court-name'
import { useAttachment } from 'hooks/use-attachment'
import { WalletContext } from 'contexts/wallet-context'
import { StandardTCRViewContext } from 'contexts/standard-tcr-view-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { STANDARD_ITEMS_QUERY } from 'utils/graphql'
import { STANDARD_DISPUTED_BEFORE_QUERY } from 'utils/graphql/standard-items'
import {
  FILTER_KEYS,
  searchStrToFilterObjStandard,
  selectStatusFilter,
  updateStandardFilter,
} from 'utils/filters'
import { DISPUTE_STATUS, STATUS_CODE } from 'utils/item-status'
import { parseIpfs } from 'utils/ipfs-parse'
import { sanitizeItemFile } from 'utils/item-file-guard'
import { formatDurationLong } from 'utils/time'
import { getAddressPage } from 'utils/network-utils'
import { ZERO_ADDRESS, capitalizeFirstLetter } from 'utils/string'
import { truncateAtWord } from 'utils/truncate-at-word'
import { klerosAddresses } from 'config/tcr-addresses'
import useSeerMarketsData from 'components/custom-registries/seer/use-seer-markets-data'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'
import ETHAmount from 'components/eth-amount'
import { Pagination } from 'components/ui'
import type { V2Field } from 'components/curate/v2'
import {
  Button,
  Page,
  Small,
  truncateMiddle,
} from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import { CuratorAddress } from 'components/curate/chrome-address'
import { ListGovernance } from 'components/curate/list-governance'
import { reveal } from 'components/curate/motion/reveal'
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
import { standardEntryStatus } from 'components/curate/entry-status'
import type { ExplainerStep } from 'components/curate/explainer'
import {
  RegistryListSkeleton,
  RegistryStandardEmpty,
} from 'components/curate/registry-standard-states'
import {
  CHALLENGE_CAP,
  useStandardSummary,
} from 'components/curate/registry-standard-summary'
import {
  REGISTRY_LAYOUT_OPTIONS,
  useRegistryLayout,
} from 'components/curate/registry-shared-layout'
import { useRegistryVerified } from 'components/curate/registry-shared-verified'
import {
  LIST_OF_LISTS_ADDRESS_LABEL,
  listOfListsEntryAddress,
} from 'components/curate/verified-rule'
import {
  readActionLink,
  submitPathFor,
} from 'components/curate/registry-shared-action-link'
import {
  listSearchFrom,
  withListSearch,
} from 'components/curate/registry-shared-search'
import ErrorPage from '../error-page'
import {
  LIST_FILE_FAILED,
  LIST_LOAD_FAILED,
  LIST_SETTINGS_FAILED,
} from '../error-page/copy'
import SubmitConnectModal from '../standard-item-details/modals/submit-connect'

/*
 * Standard Curate registry page (/tcr/:chainId/:tcrAddress): the header panel
 * (identity, the one action with its exact deposit, under it "Update list
 * parameters" for the list's governor alone, the counts, and two gauges —
 * the share of entries registered, and what the challenges did to them),
 * the toolbar (URL filters with each status's count), then the entries
 * in the remembered layout, each with its status and time left. A page or
 * filter change keeps the current rows and counts (dimmed) until the next
 * page lands, so nothing flashes or counts up again.
 */

export const NSFW_FILTER_KEY = 'NSFW_FILTER_KEY'
export const ITEMS_PER_PAGE = 40
/**
 * The "Previously disputed" count reads at most this many ids; a read that
 * fills it is a lower bound ("1,000+") and the pages run on past it.
 */
const DISPUTED_BEFORE_LIMIT = 1000
/** Whole-list search results shown at once (the indexer's keyword match). */
const SEARCH_LIMIT = 100

/** A search term inside an ILIKE pattern, its wildcards taken literally. */
const likePattern = (term: string) =>
  `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`

/** Every entry the registry counters know of. */
const counterTotal = (counters: RegistryCounters) =>
  Number(counters.numberOfAbsent) +
  Number(counters.numberOfRegistered) +
  Number(counters.numberOfRegistrationRequested) +
  Number(counters.numberOfClearingRequested) +
  Number(counters.numberOfChallengedRegistrations) +
  Number(counters.numberOfChallengedClearing)

/** Statuses hidden behind a reveal while the sensitive-content filter is on. */
const HIDDEN_STATUS_CODES = new Set<number>([
  STATUS_CODE.REJECTED,
  STATUS_CODE.REMOVED,
  STATUS_CODE.CHALLENGED,
  STATUS_CODE.CROWDFUNDING,
  STATUS_CODE.CROWDFUNDING_WINNER,
])

/** A dispute round exactly as the subgraph returns it (numbers as strings). */
interface RawRound {
  appealPeriodStart: string
  appealPeriodEnd: string
  ruling: string
  hasPaidRequester: boolean
  hasPaidChallenger: boolean
  amountPaidRequester: string
  amountPaidChallenger: string
}

/** A request exactly as the subgraph returns it. */
interface RawRequest {
  disputed: boolean
  disputeID: string
  submissionTime: string
  resolved: boolean
  deposit: string
  rounds: RawRound[]
}

/** A standard item exactly as the subgraph returns it, before decoding. */
interface RawStandardItem {
  status: string
  data: string
  requests: RawRequest[]
  props?: V2Field[]
  itemID?: string
  decodedData?: unknown[]
  mergedData?: V2Field[]
  [key: string]: unknown
}

interface RegistryCounters {
  numberOfAbsent: string
  numberOfRegistered: string
  numberOfRegistrationRequested: string
  numberOfClearingRequested: string
  numberOfChallengedRegistrations: string
  numberOfChallengedClearing: string
}

interface StandardItemsResult {
  lregistry?: RegistryCounters | null
  litems?: RawStandardItem[]
}

interface SeerMarket {
  marketName?: string
  outcomes?: string[]
}

/*
 * Seer registries: each entry is a Seer market (its "Market" column is the
 * market's address). The list adds the market's name, its outcomes and a
 * link to the market on Seer, with the details block's URL. The added
 * columns are named apart from the registry's own, since cells are matched
 * to columns by label.
 */
const SEER_MARKET_LABEL = 'Market name'
const SEER_OUTCOMES_LABEL = 'Outcomes'

const seerMarketUrl = (chainId: number, marketAddress: string) =>
  `https://app.seer.pm/markets/${chainId}/${marketAddress}`

/** A subgraph item with its decoded fields, as the list renders it. */
interface RegistryItem {
  tcrData: SubgraphItem & { mergedData?: V2Field[] }
  columns: V2Field[]
  errors: string[]
  seerMarketData?: SeerMarket
  /** The address its Seer market was found by, for the link to Seer. */
  seerMarketAddress?: string
}

const integer = new Intl.NumberFormat('en-US')

/** "51.6 xDAI" from a wei amount, for hints and sentences. */
const formatAmount = (
  amount: BigNumber | undefined,
  symbol: string,
): string | undefined =>
  amount
    ? `${ethersUtils.formatEther(amount).replace(/\.?0+$/, '')} ${symbol}`
    : undefined

/**
 * ERC-792 extra data as Kleros encodes it: the court id in the first 32
 * bytes, the number of jurors in the next 32. Only meaningful when the
 * list's arbitrator is the chain's Kleros arbitrator; other arbitrators may
 * lay their extra data out differently, so callers check that first.
 */
const decodeCourt = (
  extraData: string | undefined,
): { courtId: string; jurors: string } | undefined => {
  if (!extraData || !extraData.startsWith('0x')) return undefined
  const hex = extraData.slice(2)
  if (!/^[0-9a-fA-F]{128,}$/.test(hex)) return undefined
  return {
    courtId: BigNumber.from(`0x${hex.slice(0, 64)}`).toString(),
    jurors: BigNumber.from(`0x${hex.slice(64, 128)}`).toString(),
  }
}

/** "Tag" reads as "tag" in a sentence; acronyms such as "NFT" stay as they are. */
const sentenceCase = (name: string): string =>
  name.length > 1 && name[1] === name[1].toLowerCase()
    ? name[0].toLowerCase() + name.slice(1)
    : name

const valueText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number')
    return String(value)
  if (Array.isArray(value)) return value.map(valueText).join(' ')
  if (typeof value === 'object')
    return Object.values(value as Record<string, unknown>)
      .map(valueText)
      .join(' ')
  return ''
}

/** Matches the search box against the item id, its status and its values. */
const itemMatchesSearch = (item: RegistryItem, rawSearch: string): boolean => {
  const query = rawSearch.trim().toLowerCase()
  if (!query) return true
  const text = [
    item.tcrData.itemID,
    item.tcrData.ID,
    item.tcrData.status,
    item.columns.map((column) => column.value),
    item.tcrData.mergedData?.map((field) => field.value),
  ]
    .map(valueText)
    .join(' ')
    .toLowerCase()
  return text.includes(query)
}

/* A contract's explorer link (the arbitrator): a 24px target, and it says
   it opens a new tab. */
const AddressLink = styled.a`
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

const SrOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

/* The empty state's way out: a ghost button with a hairline, not a fill. */
const GhostButton = styled(Button)`
  border-color: var(--glass-border);
`

const Toolbar = styled.div`
  ${reveal}
`

/* While the next page or filter loads, the current rows stay and dim. */
const Entries = styled.section`
  margin-top: 0;

  > :first-child {
    transition: opacity var(--dur-hover, 180ms) var(--ease-out, ease-out);
  }

  &[data-refreshing='true'] > :first-child {
    opacity: 0.55;
  }
`

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px 16px;
  margin-top: 18px;
  ${reveal}
`

const Items = () => {
  const navigate = useNavigate()
  const { search } = useLocation()
  const { tcrAddress } = useParams()
  const chainId = useUrlChainId()
  const timestamp = useContext(WalletContext)?.timestamp
  const tcrViewContext = useContext(StandardTCRViewContext)
  const metaEvidence = tcrViewContext?.metaEvidence
  const challengePeriodDuration = tcrViewContext?.challengePeriodDuration
  const tcrError = tcrViewContext?.tcrError
  const gtcrView = tcrViewContext?.gtcrView
  const connectedTCRAddr = tcrViewContext?.connectedTCRAddr
  const submissionDeposit = tcrViewContext?.submissionDeposit
  const submissionBaseDeposit = tcrViewContext?.submissionBaseDeposit
  const submissionChallengeDeposit = tcrViewContext?.submissionChallengeDeposit
  const removalDeposit = tcrViewContext?.removalDeposit
  const removalChallengeDeposit = tcrViewContext?.removalChallengeDeposit
  const arbitrationCost = tcrViewContext?.arbitrationCost
  const arbitrator = tcrViewContext?.arbitrator
  const arbitratorExtraData = tcrViewContext?.arbitratorExtraData
  const governor = tcrViewContext?.governor
  const openAttachment = useAttachment()
  const now = useNow()
  // A remembered choice wins; the fallback follows the viewport on arrival.
  const [layout, setLayout] = useRegistryLayout('entries')
  const nativeSymbol = useNativeCurrency()
  const trust = useRegistryVerified(chainId, tcrAddress)

  const [submissionFormOpen, setSubmissionFormOpen] = useState<
    boolean | undefined
  >()
  // Sensitive entries show unless the reader hides them (round 7); their
  // choice is kept and restored below.
  const [nsfwFilterOn, setNSFWFilter] = useState(false)
  // The search box lives in the URL (?q=), so Back from an entry, a reload
  // or a shared link keeps it. Typing replaces the history entry: Back
  // leaves the list instead of undoing keystrokes.
  const itemSearch = listSearchFrom(search)
  const setItemSearch = (term: string) =>
    navigate({ search: withListSearch(search, term) }, { replace: true })
  // The term once typing pauses: what a whole-list search asks the indexer.
  // A search the URL already carries is asked at once.
  const [searchTerm, setSearchTerm] = useState(() => itemSearch.trim())
  useEffect(() => {
    const id = window.setTimeout(() => setSearchTerm(itemSearch.trim()), 350)
    return () => window.clearTimeout(id)
  }, [itemSearch])
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())
  const [decodedItems, setDecodedItems] = useState<SubgraphItem[] | undefined>(
    undefined,
  )

  const toggleNSFWFilter = useCallback((checked: boolean) => {
    setNSFWFilter(checked)
    localforage.setItem(NSFW_FILTER_KEY, checked)
  }, [])

  const seerMarketsData = useSeerMarketsData(
    chainId ?? 0,
    tcrAddress ?? '',
    decodedItems ?? [],
  ) as Record<string, SeerMarket | undefined>
  const { graphqlBatcher } = useGraphqlBatcher()

  const queryOptions = searchStrToFilterObjStandard(search)
  const {
    oldestFirst,
    page,
    absent,
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
    disputedBefore,
  } = queryOptions
  const orderDirection = oldestFirst ? 'asc' : 'desc'

  const itemsWhere = useMemo(() => {
    // Build conditions array for multi-select support
    const conditions = []

    if (absent) conditions.push({ status: { _eq: 'Absent' } })
    if (registered) conditions.push({ status: { _eq: 'Registered' } })
    if (submitted)
      conditions.push({
        status: { _eq: 'RegistrationRequested' },
        disputed: { _eq: false },
      })
    if (removalRequested)
      conditions.push({
        status: { _eq: 'ClearingRequested' },
        disputed: { _eq: false },
      })
    if (challengedSubmissions)
      conditions.push({
        status: { _eq: 'RegistrationRequested' },
        disputed: { _eq: true },
      })
    if (challengedRemovals)
      conditions.push({
        status: { _eq: 'ClearingRequested' },
        disputed: { _eq: true },
      })

    // "Previously disputed": any of the entry's requests went to court,
    // whatever its status now.
    const history = disputedBefore
      ? { requests: { disputed: { _eq: true } } }
      : {}

    // No filters selected - return all items
    if (conditions.length === 0)
      return { registry_id: { _eq: tcrAddress?.toLowerCase() }, ...history }

    // Single filter - no need for _or
    if (conditions.length === 1)
      return {
        registry_id: { _eq: tcrAddress?.toLowerCase() },
        ...history,
        ...conditions[0],
      }

    // Multiple filters - use _or clause
    return {
      registry_id: { _eq: tcrAddress?.toLowerCase() },
      ...history,
      _or: conditions,
    }
  }, [
    disputedBefore,
    absent,
    challengedRemovals,
    challengedSubmissions,
    registered,
    removalRequested,
    submitted,
    tcrAddress,
  ])

  // The registry-wide counters, kept across a refetch that comes back
  // without them, for this registry only.
  const countersKey = `${chainId}:${tcrAddress?.toLowerCase()}`
  const lastCounters = useRef<{ key: string; value: RegistryCounters }>()

  /*
   * A list longer than a page is searched whole, on the indexer's keyword
   * index (each entry's identifying fields), as the previous search bar
   * did; a one-page list is filtered where it is. The list's size comes
   * from the counters the last answer carried.
   */
  const knownTotal =
    lastCounters.current?.key === countersKey
      ? counterTotal(lastCounters.current.value)
      : undefined
  const wholeListSearch =
    searchTerm.length >= 2 &&
    (knownTotal === undefined || knownTotal > ITEMS_PER_PAGE)

  const queryVariables = useMemo(
    () => ({
      offset: wholeListSearch ? 0 : (Number(page) - 1) * ITEMS_PER_PAGE,
      limit: wholeListSearch ? SEARCH_LIMIT : ITEMS_PER_PAGE,
      order_by: [{ latestRequestSubmissionTime: orderDirection }],
      where: wholeListSearch
        ? { ...itemsWhere, keywords: { _ilike: likePattern(searchTerm) } }
        : itemsWhere,
      registryId: tcrAddress?.toLowerCase(),
    }),
    [page, orderDirection, itemsWhere, tcrAddress, wholeListSearch, searchTerm],
  )

  const itemsQuery = useQuery({
    queryKey: ['standardItems', queryVariables],
    queryFn: (): Promise<StandardItemsResult> =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: STANDARD_ITEMS_QUERY,
        variables: queryVariables,
        chainId: chainId!,
      }),
    enabled: !!chainId,
    staleTime: STALE_TIME,
    // A page or filter change keeps this registry's last result on screen
    // until the next one lands; another registry never inherits it.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[1] as { registryId?: string } | undefined)
        ?.registryId === tcrAddress?.toLowerCase()
        ? previous
        : undefined,
  })
  const refreshing = itemsQuery.isPlaceholderData && itemsQuery.isFetching
  // A whole-list search still waiting for the indexer's answer.
  const searchPending = wholeListSearch && itemsQuery.isPlaceholderData

  const freshCounters = itemsQuery.data?.lregistry ?? undefined
  if (freshCounters)
    lastCounters.current = { key: countersKey, value: freshCounters }
  const counters =
    freshCounters ??
    (lastCounters.current?.key === countersKey
      ? lastCounters.current.value
      : undefined)

  /** The registry's live counters, one per status filter. */
  const counts = useMemo(() => {
    if (!counters) return undefined
    const absentCount = Number(counters.numberOfAbsent)
    const registeredCount = Number(counters.numberOfRegistered)
    const submittedCount = Number(counters.numberOfRegistrationRequested)
    const removalCount = Number(counters.numberOfClearingRequested)
    const challengedSubmissionCount = Number(
      counters.numberOfChallengedRegistrations,
    )
    const challengedRemovalCount = Number(counters.numberOfChallengedClearing)
    const inCourt = challengedSubmissionCount + challengedRemovalCount
    const openRequests = submittedCount + removalCount + inCourt
    return {
      absent: absentCount,
      registered: registeredCount,
      submitted: submittedCount,
      removalRequested: removalCount,
      challengedSubmissions: challengedSubmissionCount,
      challengedRemovals: challengedRemovalCount,
      inCourt,
      openRequests,
      total: absentCount + registeredCount + openRequests,
    }
  }, [counters])

  // How many entries have been to court at least once: the list's size
  // under the status menu's "Previously disputed" (which shows no count),
  // read only while that choice is on.
  const disputedBeforeQuery = useQuery({
    queryKey: ['standardDisputedBefore', chainId, tcrAddress?.toLowerCase()],
    queryFn: (): Promise<{ litems?: { itemID: string }[] }> =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: STANDARD_DISPUTED_BEFORE_QUERY,
        variables: {
          registryId: tcrAddress?.toLowerCase(),
          limit: DISPUTED_BEFORE_LIMIT,
        },
        chainId: chainId!,
      }),
    enabled: !!chainId && !!tcrAddress && !!disputedBefore,
    staleTime: STALE_TIME,
  })
  const disputedBeforeCount = disputedBeforeQuery.data?.litems?.length
  const disputedBeforeCapped =
    !!disputedBefore &&
    disputedBeforeCount !== undefined &&
    disputedBeforeCount >= DISPUTED_BEFORE_LIMIT

  /**
   * Entries the current filters cover: all of them, or the selected sum;
   * undefined while unknown (never 0 for a count still loading).
   */
  const itemCount = useMemo((): number | undefined => {
    if (disputedBefore) return disputedBeforeCount
    if (!counts) return undefined
    const hasAnyFilter =
      absent ||
      registered ||
      submitted ||
      removalRequested ||
      challengedSubmissions ||
      challengedRemovals
    if (!hasAnyFilter) return counts.total
    // Submitted and challenged submissions are disjoint (unchallenged vs
    // challenged), as are the two removal counters, so the sum is exact.
    let sum = 0
    if (absent) sum += counts.absent
    if (registered) sum += counts.registered
    if (submitted) sum += counts.submitted
    if (removalRequested) sum += counts.removalRequested
    if (challengedSubmissions) sum += counts.challengedSubmissions
    if (challengedRemovals) sum += counts.challengedRemovals
    return sum
  }, [
    absent,
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
    counts,
    disputedBefore,
    disputedBeforeCount,
  ])

  // Every challenge raised on the list, for the header's court and challenge
  // figures. It is a read of its own: the counters hold no challenges.
  const {
    summary,
    loading: summaryLoading,
    failed: summaryFailed,
  } = useStandardSummary({ chainId, registryId: tcrAddress })
  // The one summary the header's gauge and its "In court" both read: a
  // failed read is no summary at all, never a stale figure.
  const liveSummary = summaryFailed ? undefined : summary

  // A failed refetch keeps the rows already on screen (react-query keeps
  // its data): only a read with nothing to show fails the page.
  const listFailed = !!itemsQuery.error && !itemsQuery.data

  useEffect(() => {
    const data = itemsQuery.data
    if (!data || itemsQuery.isLoading) return
    // Prevents the background IPFS callback from overwriting items
    // if the user paginated/filtered before it resolved.
    let stale = false

    const addDecodedFields = (items: RawStandardItem[]) =>
      items.map((item: RawStandardItem) => ({
        ...item,
        decodedData: item.props?.map(({ value }) => value) || [],
        mergedData: item.props || [],
      }))

    const transformItems = (items: RawStandardItem[]) =>
      items.map((item: RawStandardItem) => {
        const {
          disputed,
          disputeID,
          submissionTime,
          rounds,
          resolved,
          deposit,
        } = item.requests[0] ?? {}

        const {
          appealPeriodStart,
          appealPeriodEnd,
          ruling,
          hasPaidRequester,
          hasPaidChallenger,
          amountPaidRequester,
          amountPaidChallenger,
        } = rounds[0] ?? {}

        const currentRuling =
          ruling === 'None' ? 0 : ruling === 'Accept' ? 1 : 2
        const disputeStatus = !disputed
          ? DISPUTE_STATUS.WAITING
          : resolved
            ? DISPUTE_STATUS.SOLVED
            : Number(appealPeriodEnd) > Date.now() / 1000
              ? DISPUTE_STATUS.APPEALABLE
              : DISPUTE_STATUS.WAITING

        return {
          ...item,
          ID: item.itemID,
          itemID: item.itemID,
          disputeStatus,
          disputed,
          resolved,
          decodedData: item.decodedData,
          mergedData: item.mergedData,
          disputeID,
          deposit,
          submissionTime: BigNumber.from(submissionTime),
          hasPaid: [false, hasPaidRequester, hasPaidChallenger],
          currentRuling,
          appealStart: BigNumber.from(appealPeriodStart),
          appealEnd: BigNumber.from(appealPeriodEnd),
          amountPaid: [
            BigNumber.from(0),
            BigNumber.from(amountPaidRequester),
            BigNumber.from(amountPaidChallenger),
          ],
        }
      })

    // Render items immediately with whatever data the subgraph has.
    const itemsWithDecoded = addDecodedFields(data.litems ?? [])
    setDecodedItems(
      transformItems(itemsWithDecoded) as unknown as SubgraphItem[],
    )

    // HACK: the graph could have failed to include the props.
    // This may be because at indexing time, the IPFS file was not available.
    // In that case, we manually fetch the props in the background so one
    // broken item doesn't block the entire page from rendering.
    const needsIpfs = itemsWithDecoded.some((i) => i.decodedData.length === 0)
    if (needsIpfs)
      void (async () => {
        const results = await Promise.allSettled(
          itemsWithDecoded.map(async (i) => {
            if (i.decodedData.length === 0)
              try {
                const response = await fetch(parseIpfs(i.data))
                if (!response.ok) return i
                const item = sanitizeItemFile(await response.json())
                if (!item) return i
                const mergedData = item.columns.map((column: Column) => ({
                  label: column.label,
                  description: column.description,
                  type: column.type,
                  isIdentifier: column.isIdentifier,
                  value: item.values[column.label] ?? null,
                }))
                const decodedData = mergedData.map(
                  (d: { value?: unknown }) => d.value,
                )
                return { ...i, mergedData, decodedData, props: mergedData }
              } catch {
                return i
              }

            return i
          }),
        )
        if (stale) return
        // Every promise has a try/catch returning the original item, so all settle as fulfilled.
        const patched = results.map(
          (r) =>
            (r as PromiseFulfilledResult<(typeof itemsWithDecoded)[number]>)
              .value,
        )
        setDecodedItems(transformItems(patched) as unknown as SubgraphItem[])
      })()

    return () => {
      stale = true
    }
  }, [itemsQuery.data, itemsQuery.isLoading])

  // Load NSFW user setting from localforage.
  useEffect(() => {
    void (async () => {
      try {
        const savedSetting = await localforage.getItem(NSFW_FILTER_KEY)
        if (typeof savedSetting === 'boolean') setNSFWFilter(savedSetting)
      } catch {
        // Storage can be blocked (private windows): keep the default.
      }
    })()
  }, [])

  // Pair every subgraph item with the list's columns and, for Seer, its market.
  const items = useMemo<RegistryItem[] | undefined>(() => {
    if (!metaEvidence || metaEvidence.address !== tcrAddress || !decodedItems)
      return undefined

    const columns = metaEvidence.metadata?.columns || []
    const seer =
      tcrAddress != null &&
      chainId != null &&
      isSeerRegistry(tcrAddress, chainId)

    return decodedItems.map((item: SubgraphItem) => {
      const decodedData = item.decodedData
      // The same field useSeerMarketsData looks the markets up by.
      const marketAddress =
        seer && (decodedData?.length ?? 0) > 1
          ? String(decodedData?.[1])
          : undefined
      const seerMarketData = marketAddress
        ? seerMarketsData[marketAddress.toLowerCase()]
        : undefined
      return {
        tcrData: { ...item, decodedData },
        columns: columns.map((col: Column, index: number) => ({
          value: decodedData && decodedData[index],
          ...col,
        })),
        errors: [],
        seerMarketData,
        seerMarketAddress: seerMarketData ? marketAddress : undefined,
      }
    })
  }, [metaEvidence, tcrAddress, decodedItems, chainId, seerMarketsData])

  const visibleItems = useMemo(() => {
    if (!items) return undefined

    // The indexer's answer is already the search. Until it lands, the
    // previous page stands in, so it is filtered like any page.
    const searchAnswered = wholeListSearch && !searchPending
    return [...items]
      .filter((item) => searchAnswered || itemMatchesSearch(item, itemSearch))
      .sort(({ tcrData: tcrDataA }, { tcrData: tcrDataB }) => {
        // Display items with pending requests first.
        if (!tcrDataA || !tcrDataB) return 0 // Handle errored TCRs.
        if (!tcrDataA.resolved && tcrDataB.resolved) return -1
        if (tcrDataA.resolved && !tcrDataB.resolved) return 1
        return 0
      })
  }, [itemSearch, items, wholeListSearch, searchPending])

  // A ?action= link (someone sent here with the values to submit) opens
  // the full-page submit form with those values in its URL, so the link
  // still fills the form after a reload. A connected list keeps its own
  // dialog. It acts when the link itself changes, once the list's metadata
  // says which kind it is.
  const actionLink = useMemo(() => {
    const link = readActionLink(search)
    return link ? JSON.stringify(link) : undefined
  }, [search])
  const connectedList =
    metaEvidence?.metadata && metaEvidence.address === tcrAddress
      ? Boolean(metaEvidence.metadata.isConnectedTCR)
      : undefined
  const handledLink = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (actionLink === undefined || connectedList === undefined) return
    if (handledLink.current === actionLink) return
    handledLink.current = actionLink
    const link = JSON.parse(actionLink) as ReturnType<typeof readActionLink>
    if (!connectedList && chainId && tcrAddress) {
      navigate(submitPathFor(chainId, tcrAddress, link), { replace: true })
      return
    }
    setSubmissionFormOpen(true)
  }, [actionLink, connectedList, chainId, tcrAddress, navigate])

  /* ---------- Derived copy and figures ---------- */

  const { metadata, fileURI } = metaEvidence || {}
  const { isConnectedTCR, isTCRofTCRs, relTcrDisabled, logoURI } =
    metadata || {}
  const tcrTitle = metadata?.tcrTitle ?? metadata?.title ?? metaEvidence?.title
  const tcrDescription =
    metadata?.tcrDescription ??
    metadata?.description ??
    metaEvidence?.description
  const normalizedDescription = tcrDescription
    ? tcrDescription[tcrDescription.length - 1] === '.'
      ? tcrDescription
      : `${tcrDescription}.`
    : ''
  const rawItemName = metadata?.itemName ?? metaEvidence?.itemName
  const rawItemNamePlural =
    metadata?.itemNamePlural ?? metaEvidence?.itemNamePlural
  const itemName = sentenceCase(rawItemName ?? 'entry')
  // A list that names its items but not their plural gets a plain "s";
  // a list that names neither falls back to "entries", never "entrys".
  const itemNamePlural = sentenceCase(
    rawItemNamePlural ?? (rawItemName ? `${rawItemName}s` : 'entries'),
  )

  const fullSeoTitle = tcrTitle
    ? `${tcrTitle} | Kleros Curate`
    : 'Kleros Curate'
  const fullSeoMetaDescription = metadata
    ? `Explore the ${tcrTitle} list on Kleros Curate: ${normalizedDescription}`
    : 'Explore curated lists on Kleros Curate.'
  useDocumentHead(
    truncateAtWord(fullSeoTitle, 60),
    truncateAtWord(fullSeoMetaDescription, 160),
  )

  const depositValue = (amount: BigNumber | undefined) =>
    amount ? (
      <ETHAmount
        amount={amount}
        decimals={18}
        displayUnit={` ${nativeSymbol}`}
      />
    ) : undefined
  const addressValue = (address: string | undefined) => {
    if (!address) return undefined
    const href = chainId
      ? getAddressPage({ networkId: chainId, address })
      : undefined
    return href ? (
      <AddressLink
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={address}
      >
        {truncateMiddle(address, 6, 4)}
        <CurateIcon name="external" size={14} aria-hidden />
        <SrOnly> (opens in a new tab)</SrOnly>
      </AddressLink>
    ) : (
      <span title={address}>{truncateMiddle(address, 6, 4)}</span>
    )
  }

  // Court and juror figures are only read from the extra data when the
  // list's arbitrator is this chain's Kleros arbitrator.
  const klerosArbitrator = chainId
    ? klerosAddresses[chainId]?.arbitrator
    : undefined
  const isKlerosArbitrator =
    !!klerosArbitrator &&
    !!arbitrator &&
    klerosArbitrator.toLowerCase() === arbitrator.toLowerCase()
  const court = isKlerosArbitrator
    ? decodeCourt(arbitratorExtraData)
    : undefined
  // The court by its name ("xDai Curation"), as the factory and the dispute
  // panel name it; its number only while the name loads or if it cannot be
  // read.
  const courtName = useCourtName(
    chainId,
    court ? Number(court.courtId) : undefined,
  )
  const courtTitle = court ? (courtName ?? `Court ${court.courtId}`) : undefined
  const jurorsLabel = court
    ? `${court.jurors} juror${court.jurors === '1' ? '' : 's'}`
    : undefined
  const courtLabel = court
    ? `${courtTitle} · ${jurorsLabel}`
    : arbitratorExtraData
      ? truncateMiddle(arbitratorExtraData, 10, 6)
      : undefined
  const challengePeriod = challengePeriodDuration
    ? formatDurationLong(challengePeriodDuration.toNumber())
    : undefined
  const submissionTotal = formatAmount(submissionDeposit, nativeSymbol)
  const submissionBase = formatAmount(submissionBaseDeposit, nativeSymbol)
  const arbitration = formatAmount(arbitrationCost, nativeSymbol)
  const challengeTotal = formatAmount(submissionChallengeDeposit, nativeSymbol)
  /** "30 xDAI base deposit + 21.6 xDAI arbitration cost", shown with every total. */
  const submissionBreakdown =
    submissionBase && arbitration
      ? `${submissionBase} base deposit + ${arbitration} arbitration cost`
      : undefined
  const rejectedOrRemoved = counts ? integer.format(counts.absent) : undefined

  /*
   * "In court" is the disputes open on this list right now, counted from the
   * list's own challenges (DESIGN.md, Data rules: the per-list counters
   * drift and are not trusted for it), so this stat and the gauge beside it
   * print one figure from one source. It reads "n+" when that read
   * stopped at its page cap, and waits for the read rather than flashing a
   * counter it would then correct; a failed read leaves the counter, the
   * only figure left.
   */
  const inCourtStat = liveSummary
    ? `${integer.format(liveSummary.challenges.inCourt)}${
        liveSummary.challenges.capped && liveSummary.challenges.inCourt > 0
          ? '+'
          : ''
      }`
    : summaryLoading
      ? undefined
      : counts && integer.format(counts.inCourt)

  /*
   * The list's live work leads, because it is what a reader can act on: the
   * open requests are the headline figure, in the window blue, and the total
   * the list holds follows. A list with nothing open has no live work to
   * lead with, so that figure is not printed at all and the total takes the
   * headline back. While the counts are still loading the slot is kept, so
   * the headline does not change identity under the reader.
   */
  const openRequests = counts?.openRequests
  const leadWithOpen = !counts || openRequests !== 0
  const entriesStat: RegistryStat = {
    label: 'Entries',
    value: counts && integer.format(counts.total),
  }
  const openStat: RegistryStat = {
    label: 'Open requests',
    value: counts && integer.format(counts.openRequests),
    tone: 'window',
  }
  const stats: RegistryStat[] = leadWithOpen
    ? [openStat, entriesStat, { label: 'In court', value: inCourtStat }]
    : [entriesStat, { label: 'In court', value: inCourtStat }]

  const parameters: RegistryParameter[] = [
    {
      label: 'Submission deposit',
      value: depositValue(submissionDeposit),
      hint: submissionBreakdown,
    },
    {
      label: 'Challenge deposit',
      value: depositValue(submissionChallengeDeposit),
    },
    { label: 'Removal deposit', value: depositValue(removalDeposit) },
    {
      label: 'Removal challenge deposit',
      value: depositValue(removalChallengeDeposit),
    },
    { label: 'Challenge period', value: challengePeriod },
    { label: 'Arbitration cost', value: depositValue(arbitrationCost) },
    { label: 'Court', value: courtLabel },
    { label: 'Arbitrator', value: addressValue(arbitrator) },
    // The governor is a person (or their multisig): their Curate profile,
    // where the lists they govern are, not the explorer.
    {
      label: 'Governor',
      value: governor ? <CuratorAddress address={governor} /> : undefined,
    },
    {
      label: 'Rejected or removed',
      value: rejectedOrRemoved,
      hint: 'Included in the Entries count',
    },
  ]

  // One line per step, both sides: the submitter's deposit comes back, the
  // challenger who spots a mistake earns one; the jurors settle the rest.
  const explainerSteps: ExplainerStep[] = [
    {
      title: 'Follow the policy, get your deposit back',
      body: `${
        submissionTotal && submissionBreakdown
          ? `You send ${submissionTotal} = ${submissionBreakdown}.`
          : 'You send the base deposit plus the arbitration cost.'
      } If your ${itemName} follows the listing policy, it is registered and the deposit comes back in full.`,
    },
    {
      // A successful challenger nets the submitter's base deposit (the
      // round's pool, less the one arbitration cost) and gets their own back.
      title: 'Spot a mistake, earn a bounty',
      body: `Challenge a submission that breaks the policy ${
        challengePeriod
          ? `within ${challengePeriod}`
          : 'during its challenge period'
      }. If ${
        isKlerosArbitrator ? 'jurors agree' : 'the arbitrator agrees'
      }, you earn the submitter's ${
        submissionBase ? `${submissionBase} base deposit` : 'base deposit'
      } and your ${challengeTotal ?? 'challenge deposit'} comes back.`,
    },
    {
      title: isKlerosArbitrator
        ? 'Kleros jurors decide'
        : 'The arbitrator decides',
      body: `${
        court
          ? courtName
            ? `The Kleros ${courtPhrase(courtName)} draws ${jurorsLabel}.`
            : `Kleros court ${court.courtId} draws ${jurorsLabel}.`
          : isKlerosArbitrator
            ? 'A Kleros court rules on the listing policy.'
            : 'The list’s arbitrator rules on the listing policy.'
      } The side they agree with gets its deposit back plus the other side's, less the arbitration cost.`,
    },
  ]

  // A connected (badges) list takes a badge list and its match file through
  // its own dialog, as an ?action= link does; never the generic form.
  const onPrimary = () => {
    if (!connectedList && chainId && tcrAddress)
      navigate(`/tcr/${chainId}/${tcrAddress}/submit`)
    else setSubmissionFormOpen(true)
  }
  const onOpenPolicy = fileURI
    ? () => openAttachment(parseIpfs(fileURI), true)
    : undefined
  const badgesListTo =
    connectedTCRAddr && connectedTCRAddr !== ZERO_ADDRESS && !relTcrDisabled
      ? `/tcr/${chainId}/${connectedTCRAddr}`
      : undefined

  // The status menu (round 6): All, then each status with its dot and its
  // live count from the registry counters, listed first, then the open
  // requests, then the challenged ones, the rejected and removed last; and
  // under a hairline, every entry that has been to court.
  const chips: FilterChip[] = [
    {
      key: 'registered',
      label: 'Registered',
      count: counts?.registered,
      tone: 'registered',
      checked: !!registered,
    },
    {
      key: 'submitted',
      label: 'Submitted',
      count: counts?.submitted,
      tone: 'window',
      checked: !!submitted,
    },
    {
      key: 'removalRequested',
      label: 'Removal requested',
      count: counts?.removalRequested,
      tone: 'window',
      checked: !!removalRequested,
    },
    {
      key: 'challengedSubmissions',
      label: 'Challenged submissions',
      count: counts?.challengedSubmissions,
      tone: 'contested',
      checked: !!challengedSubmissions,
    },
    {
      key: 'challengedRemovals',
      label: 'Challenged removals',
      count: counts?.challengedRemovals,
      tone: 'contested',
      checked: !!challengedRemovals,
    },
    {
      key: 'absent',
      label: 'Rejected or removed',
      count: counts?.absent,
      tone: 'off',
      checked: !!absent,
    },
    {
      key: FILTER_KEYS.DISPUTED_BEFORE,
      label: 'Previously disputed',
      hint: 'Every entry that has been to court, whatever its status now',
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

  // The menu shows one status, the first checked; an old link may carry
  // several. The link is narrowed to that one, so the list agrees with it.
  const checkedStatuses = chips.filter((chip) => chip.checked)
  const shownStatus =
    checkedStatuses.length > 1 ? checkedStatuses[0].key : undefined
  const statusKeys = chips.map((chip) => chip.key).join(',')
  useEffect(() => {
    if (!shownStatus) return
    navigate(
      {
        search: selectStatusFilter({
          prevQuery: search,
          keys: statusKeys.split(','),
          value: shownStatus,
        }),
      },
      { replace: true },
    )
  }, [shownStatus, statusKeys, search, navigate])

  const setFilter = (filter: string, checked: boolean) =>
    navigate({
      search: updateStandardFilter({ prevQuery: search, filter, checked }),
    })

  // The pager sits at the foot of the list: a new page starts at its top.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(search)
    params.set('page', String(newPage))
    navigate({ search: `?${params.toString()}` })
    scrollToToolbar(toolbarRef.current)
  }

  // Clears the search and every status filter and returns to page 1; the
  // sort order is a preference, not a filter, so it stays.
  const clearFilters = () =>
    navigate({ search: oldestFirst ? '?oldestFirst=true' : '' })

  const hasSeerMarkets =
    tcrAddress != null &&
    chainId != null &&
    isSeerRegistry(tcrAddress, chainId) &&
    Object.keys(seerMarketsData).length > 0
  const columns = useMemo(() => {
    const base = tableColumns((metadata?.columns ?? []) as V2Field[])
    // Seer registries also show each entry's market, fetched from Seer.
    return hasSeerMarkets
      ? [
          ...base,
          { label: SEER_MARKET_LABEL, type: 'text' },
          { label: SEER_OUTCOMES_LABEL, type: 'text' },
        ]
      : base
  }, [metadata, hasSeerMarkets])

  const verifiedEntries = trust.listOfLists ? trust.verifiedSet : undefined
  // The column a list of lists keeps each list's address in.
  const listAddressLabel =
    (metadata?.columns ?? []).find(
      (column) =>
        typeof column.type === 'string' &&
        column.type.toLowerCase() === ItemTypes.GTCR_ADDRESS.toLowerCase(),
    )?.label ?? LIST_OF_LISTS_ADDRESS_LABEL
  const entries: EntryRow[] = useMemo(() => {
    if (!visibleItems || !tcrAddress) return []
    return visibleItems.map((item) => {
      const id = String(item.tcrData.itemID ?? item.tcrData.ID ?? '')
      const status = standardEntryStatus(
        item.tcrData,
        timestamp,
        challengePeriodDuration,
      )
      const fields: V2Field[] = [
        ...(item.tcrData.mergedData?.length
          ? item.tcrData.mergedData
          : item.columns),
      ]
      const market = item.seerMarketData
      if (market?.marketName) {
        fields.push({
          label: SEER_MARKET_LABEL,
          value: market.marketName,
          type: 'text',
        })
        // Every Seer market has an "Invalid result" outcome; like the Seer
        // details block, the list shows only the real answers.
        const outcomes = (market.outcomes ?? []).filter(
          (outcome) => outcome !== 'Invalid result',
        )
        if (outcomes.length > 0)
          fields.push({
            label: SEER_OUTCOMES_LABEL,
            value: outcomes.join(' · '),
            type: 'text',
          })
      }
      const outLinks =
        market?.marketName && item.seerMarketAddress && chainId
          ? {
              [SEER_MARKET_LABEL]: {
                href: seerMarketUrl(chainId, item.seerMarketAddress),
                label: 'Seer',
                title: 'Go to Seer',
              },
            }
          : undefined
      // A list of lists' row opens, and on the Kleros one carries the seal
      // of, the list its address field shows: matched by label, as the row
      // shows it (listOfListsEntryAddress says why nothing else may decide).
      const listAddress = isTCRofTCRs
        ? listOfListsEntryAddress(fields, listAddressLabel)
        : null
      const openListTo = listAddress
        ? `/tcr/${chainId}/${listAddress}`
        : undefined
      const pointsTo = verifiedEntries ? listOfListsEntryAddress(fields) : null
      const verified = !!pointsTo && !!verifiedEntries?.has(pointsTo)
      // An entry whose status is not known yet stays hidden too, so nothing
      // the filter covers shows before its status arrives.
      const hidden =
        nsfwFilterOn &&
        !revealed.has(id) &&
        (status?.code === undefined || HIDDEN_STATUS_CODES.has(status.code))
      return {
        id,
        href: `/tcr/${chainId}/${tcrAddress}/${id}`,
        fields,
        status,
        openListTo,
        verified,
        hidden,
        onReveal: hidden
          ? () => setRevealed((prev) => new Set(prev).add(id))
          : undefined,
        outLinks,
      }
    })
  }, [
    visibleItems,
    tcrAddress,
    chainId,
    timestamp,
    challengePeriodDuration,
    isTCRofTCRs,
    listAddressLabel,
    verifiedEntries,
    nsfwFilterOn,
    revealed,
  ])

  /* ---------- Error states ---------- */

  if (!tcrAddress)
    return (
      <ErrorPage
        code="404"
        message="This list could not be found."
        tip="Check the address, and that the chain in the URL is the one the list lives on."
      />
    )

  // The list's file or its deposits and periods did not load: said, with a
  // retry, instead of a dead end or skeleton rows for ever (the rows' status
  // needs the challenge period).
  if (tcrViewContext?.metaEvidenceFailed || tcrViewContext?.paramsFailed)
    return (
      <ErrorPage
        code="Error"
        title="This list did not load"
        message={
          tcrViewContext.metaEvidenceFailed
            ? LIST_FILE_FAILED
            : LIST_SETTINGS_FAILED
        }
        onRetry={() =>
          void (tcrViewContext.metaEvidenceFailed
            ? tcrViewContext.retryMetaEvidence()
            : tcrViewContext.retryParams())
        }
      />
    )

  if (tcrError)
    return (
      <ErrorPage
        code="400"
        message={
          typeof tcrError === 'string'
            ? tcrError
            : 'This list could not be loaded.'
        }
      />
    )

  if (listFailed)
    return (
      <ErrorPage
        code="Error"
        title="This list did not load"
        message={LIST_LOAD_FAILED}
        onRetry={() => void itemsQuery.refetch()}
      />
    )

  // Statuses need the chain's clock and the challenge period; until both are
  // known the skeleton stays, so the sensitive-content filter never lets an
  // entry through early.
  const listLoading =
    itemsQuery.isLoading ||
    !metadata ||
    !visibleItems ||
    !timestamp ||
    !challengePeriodDuration
  const pageNumber = Number(page) || 1
  const pageItemCount = items?.length ?? 0
  // A total unknown (its read failed) or capped is a lower bound: what the
  // pages so far prove, and a full page offers one more, as on Stake. While
  // the count is still loading there are no pages yet.
  const countLoading = !!disputedBefore && disputedBeforeQuery.isLoading
  const countIsFloor = itemCount === undefined || disputedBeforeCapped
  const pageReach = (pageNumber - 1) * ITEMS_PER_PAGE + pageItemCount
  const pagerTotal = countLoading
    ? 0
    : countIsFloor
      ? Math.max(
          itemCount ?? 0,
          pageReach + (pageItemCount === ITEMS_PER_PAGE ? 1 : 0),
        )
      : itemCount
  // A whole-list search answers in one go: no pages while it is shown.
  const showPagination = pagerTotal > ITEMS_PER_PAGE && !wholeListSearch
  const searching = itemSearch.trim() !== ''
  // Until a term settles (or for a single character) the search filters
  // the page already loaded.
  const pageScopedSearch = pagerTotal > ITEMS_PER_PAGE && !wholeListSearch
  const searchCapped = wholeListSearch && pageItemCount >= SEARCH_LIMIT
  const filtersActive = !!(
    disputedBefore ||
    absent ||
    registered ||
    submitted ||
    removalRequested ||
    challengedSubmissions ||
    challengedRemovals
  )
  // The last page, when the total is exact.
  const pageCount = countIsFloor ? 0 : Math.ceil(itemCount / ITEMS_PER_PAGE)
  const plural = capitalizeFirstLetter(itemNamePlural)

  // Why the list is empty decides what it says and offers.
  const emptyView = ((): {
    title: string
    line?: string
    action?: React.ReactNode
  } => {
    if (pageNumber > 1 && pageItemCount === 0)
      return {
        title: `Page ${integer.format(pageNumber)} is past the end`,
        line:
          pageCount > 0
            ? `The last page is ${integer.format(pageCount)}.`
            : undefined,
        action: (
          <GhostButton
            type="button"
            $variant="ghost"
            $size="sm"
            onClick={() => goToPage(1)}
          >
            Go to page 1
          </GhostButton>
        ),
      }
    if (searching)
      return {
        title: `No ${itemNamePlural} match`,
        line: pageScopedSearch
          ? `The search covers the ${integer.format(pageItemCount)} ${itemNamePlural} on page ${integer.format(pageNumber)}.`
          : undefined,
        action: (
          <GhostButton
            type="button"
            $variant="ghost"
            $size="sm"
            onClick={filtersActive ? clearFilters : () => setItemSearch('')}
          >
            {filtersActive ? 'Clear filters' : 'Clear search'}
          </GhostButton>
        ),
      }
    if (filtersActive)
      return {
        title: `No ${itemNamePlural} match`,
        line: disputedBefore
          ? `No ${itemName} on this list has been to court.`
          : `No ${itemName} has this status right now.`,
        action: (
          <GhostButton
            type="button"
            $variant="ghost"
            $size="sm"
            onClick={clearFilters}
          >
            Clear filters
          </GhostButton>
        ),
      }
    if (counts?.total === 0)
      return {
        title: `No ${itemNamePlural} yet`,
        line: 'Be the first to submit one.',
        action: (
          <Button
            type="button"
            $variant="secondary"
            $size="sm"
            onClick={onPrimary}
          >
            Submit {itemName}
          </Button>
        ),
      }
    return { title: `No ${itemNamePlural} to show` }
  })()

  return (
    <Page>
      <RegistryHeader
        title={tcrTitle}
        description={
          normalizedDescription
            ? capitalizeFirstLetter(normalizedDescription)
            : undefined
        }
        logoURI={logoURI}
        chainId={chainId ?? undefined}
        address={tcrAddress}
        // A former list of lists is neither Verified nor a Community list:
        // it carries no trust tag.
        verified={
          succeededListOfLists(chainId, tcrAddress) ? undefined : trust.verified
        }
        listOfLists={trust.listOfLists}
        kind="standard"
        itemName={itemName}
        itemNamePlural={itemNamePlural}
        primaryLabel={`Submit ${itemName}`}
        primaryAmount={
          submissionDeposit ? (
            <span title={submissionBreakdown}>
              {depositValue(submissionDeposit)}
            </span>
          ) : undefined
        }
        onPrimary={onPrimary}
        policyURI={fileURI}
        onOpenPolicy={onOpenPolicy}
        badgesListTo={badgesListTo}
        stats={stats}
        registeredCount={counts?.registered}
        totalCount={counts?.total}
        // The challenges gauge reads the same tally "In court" above it does,
        // and carries the cap that tally is read under.
        challenges={
          liveSummary && {
            offList: liveSummary.challenges.offList,
            onList: liveSummary.challenges.onList,
            inCourt: liveSummary.challenges.inCourt,
            scope: liveSummary.challenges.capped
              ? `the newest ${integer.format(CHALLENGE_CAP)} challenges`
              : undefined,
          }
        }
        parameters={parameters}
        // Keyed under the kind's old name, so readers keep their open state.
        explainerId={`registry-light-${tcrAddress.toLowerCase()}`}
        explainerHeading="A deposit you get back, a bounty for spotting mistakes."
        explainerSteps={explainerSteps}
        loading={!metadata || (!counters && itemsQuery.isFetching)}
        // The governor the context reads on the list's own chain, so a
        // governor whose wallet is on another chain still sees the control.
        // It waits for the list's file as well: the control takes the list's
        // name and logo when it first reads the parameters, and keeps them.
        governance={
          chainId ? (
            <ListGovernance
              chainId={chainId}
              address={tcrAddress}
              kind="standard"
              title={tcrTitle}
              logoURI={logoURI}
              governor={metaEvidence ? governor : undefined}
              onSaved={() => {
                void tcrViewContext?.retryParams()
                void tcrViewContext?.retryMetaEvidence()
              }}
            />
          ) : undefined
        }
      />

      <Toolbar ref={toolbarRef} style={{ ['--i' as string]: 1 }}>
        <RegistryToolbar
          search={itemSearch}
          onSearch={setItemSearch}
          placeholder={`Search ${itemNamePlural}`}
          chips={chips}
          onStatusChange={setStatus}
          sort={oldestFirst ? 'oldest' : 'newest'}
          onSortChange={(sort) => setFilter('oldestFirst', sort === 'oldest')}
          layout={layout}
          onLayoutChange={setLayout}
          layoutOptions={REGISTRY_LAYOUT_OPTIONS}
          nsfwFilter={nsfwFilterOn}
          onNsfwChange={toggleNSFWFilter}
          // Unknown (not "0 of 0") until the list and its counts are in.
          shown={listLoading ? undefined : visibleItems?.length}
          total={
            listLoading
              ? undefined
              : searching && !wholeListSearch
                ? pageItemCount
                : disputedBeforeCapped
                  ? Math.max(itemCount ?? 0, pageReach)
                  : itemCount
          }
          totalCapped={
            // A short page past the cap ends the list: that total is exact.
            disputedBeforeCapped &&
            pageItemCount === ITEMS_PER_PAGE &&
            !(searching && !wholeListSearch)
          }
        />
      </Toolbar>

      <Entries
        aria-label={plural}
        aria-busy={listLoading || itemsQuery.isFetching}
        data-refreshing={refreshing && !listLoading}
      >
        {listLoading ? (
          <RegistryListSkeleton layout={layout} />
        ) : entries.length === 0 ? (
          <RegistryStandardEmpty
            title={emptyView.title}
            line={emptyView.line}
            action={emptyView.action}
          />
        ) : (
          <EntryList
            layout={layout}
            entries={entries}
            columns={columns}
            now={now}
            itemName={itemName}
            itemNamePlural={itemNamePlural}
          />
        )}
        {searchCapped && (
          <Footer style={{ ['--i' as string]: 2 }}>
            <Small $muted as="p" style={{ margin: 0 }}>
              The first {integer.format(SEARCH_LIMIT)} matches. A longer search
              narrows them down.
            </Small>
          </Footer>
        )}
        {showPagination && (
          <Footer style={{ ['--i' as string]: 2 }}>
            <Pagination
              total={pagerTotal}
              current={pageNumber}
              pageSize={ITEMS_PER_PAGE}
              onChange={goToPage}
            />
          </Footer>
        )}
      </Entries>

      {metaEvidence && metadata && isConnectedTCR ? (
        <SubmitConnectModal
          visible={submissionFormOpen}
          onCancel={() => setSubmissionFormOpen(false)}
          tcrAddress={tcrAddress}
          gtcrView={gtcrView}
        />
      ) : null}
    </Page>
  )
}

export default Items
