import React, {
  Suspense,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import styled from 'styled-components'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import { request } from 'graphql-request'
import localforage from 'localforage'
import { BigNumber, ethers } from 'ethers'
import { gtcrDecode } from '@kleros/gtcr-encoder'
import { STALE_TIME } from 'consts'
import { Pagination } from 'components/ui'
import useUrlChainId from 'hooks/use-url-chain-id'
import useNow from 'hooks/use-now'
import useDocumentHead from 'hooks/use-document-head'
import useNativeCurrency from 'hooks/native-currency'
import { useAttachment } from 'hooks/use-attachment'
import { WalletContext } from 'contexts/wallet-context'
import { TCRViewContext } from 'contexts/tcr-view-context'
import { subgraphUrl } from 'config/tcr-addresses'
import { CLASSIC_REGISTRY_ITEMS_QUERY } from 'utils/graphql'
import { CONTRACT_STATUS, DISPUTE_STATUS, STATUS_CODE } from 'utils/item-status'
import {
  FILTER_KEYS,
  searchStrToFilterObjLight,
  updateLightFilter,
} from 'utils/filters'
import { parseIpfs } from 'utils/ipfs-parse'
import { getAddressPage } from 'utils/network-utils'
import { formatDurationLong } from 'utils/time'
import {
  ZERO_ADDRESS,
  capitalizeFirstLetter,
  jurorsAndCourtIDFromExtraData,
} from 'utils/string'
import { truncateAtWord } from 'utils/truncate-at-word'
import { errorToast } from 'utils/wrap-with-toast'
import {
  Button,
  EmptyState,
  Page,
  Small,
  Surface,
  truncateMiddle,
  type StatusTone,
} from 'components/curate/primitives'
import {
  RegistryHeader,
  type RegistryParameter,
  type RegistryStat,
} from 'components/curate/registry-header'
import {
  RegistryToolbar,
  type FilterChip,
} from 'components/curate/registry-toolbar'
import {
  EntryList,
  tableColumns,
  type EntryRow,
} from 'components/curate/entry-list'
import {
  lightEntryStatus,
  type EntryStatusView,
} from 'components/curate/entry-status'
import type { ExplainerStep } from 'components/curate/explainer'
import type { V2Field } from 'components/curate/v2'
import { reveal } from 'components/curate/motion/reveal'
import { ClassicLifetime } from 'components/curate/registry-classic-lifetime'
import { useRegistryLayout } from 'components/curate/registry-shared-layout'
import {
  extractRegistryAddress,
  useRegistryVerified,
} from 'components/curate/registry-shared-verified'
import {
  readActionLink,
  submitPathFor,
} from 'components/curate/registry-shared-action-link'
import ErrorPage from '../error-page'

// The submission forms load on first use: they are heavy and most visits to
// a list never open one (Submit goes to the full submission page). React.lazy
// caches a rejected import, so each attempt gets fresh lazy components: after
// a failed load the next request to open the form imports again.
const lazyForms = (attempt: number) => ({
  attempt,
  SubmitModal: lazy(() => import('../item-details/modals/submit')),
  SubmitConnectModal: lazy(
    () => import('../item-details/modals/submit-connect'),
  ),
})

/*
 * Classic Curate registry page. Same composition as the Light page: the
 * portfolio header (counts, the registered share as a ring, the one action
 * with its exact deposit), the list's lifetime beside the one deprecation
 * sentence, then the toolbar and the entries. Items are read straight from
 * the subgraph with graphql-request and decoded on the client with
 * gtcrDecode. The header counts, the chip counts and the totals come from
 * the whole list (the unfiltered query, shared with the router's prefetch);
 * when that list reaches the query limit they show as lower bounds or not at
 * all. The rows come from the filtered query. Every figure comes from the
 * loaded items or the on-chain parameters.
 */

const MAX_ENTITIES = 1000
const ITEMS_PER_PAGE = 40
const NSFW_FILTER_KEY = 'NSFW_FILTER_KEY'
const KIND_LABEL = 'Classic Curate'

const integer = new Intl.NumberFormat('en-US')

/** Statuses hidden behind a reveal while the sensitive-content filter is on. */
const HIDDEN_STATUS_CODES = new Set([
  STATUS_CODE.REJECTED,
  STATUS_CODE.REMOVED,
  STATUS_CODE.CHALLENGED,
  STATUS_CODE.CROWDFUNDING,
  STATUS_CODE.CROWDFUNDING_WINNER,
])

/**
 * URL filter keys shown as chips, in plain language with their status role,
 * in the Light page's order: listed first, then the open requests, then the
 * challenged ones; the rejected and removed close the rail.
 */
const FILTER_CHIPS: { key: string; label: string; tone: StatusTone }[] = [
  { key: FILTER_KEYS.REGISTERED, label: 'Registered', tone: 'registered' },
  { key: FILTER_KEYS.SUBMITTED, label: 'Submitted', tone: 'window' },
  {
    key: FILTER_KEYS.REMOVAL_REQUESTED,
    label: 'Removal requested',
    tone: 'window',
  },
  {
    key: FILTER_KEYS.CHALLENGED_SUBMISSIONS,
    label: 'Challenged submissions',
    tone: 'contested',
  },
  {
    key: FILTER_KEYS.CHALLENGED_REMOVALS,
    label: 'Challenged removals',
    tone: 'contested',
  },
  { key: FILTER_KEYS.ABSENT, label: 'Rejected or removed', tone: 'off' },
]

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

/** A classic item exactly as the subgraph returns it. */
interface RawItem {
  itemID: string
  status: string
  data: string
  requests: RawRequest[]
  [key: string]: unknown
}

interface ClassicItemsResult {
  items: RawItem[]
}

interface ClassicItemsVariables {
  offset: number
  limit: number
  order_by: { latestRequestSubmissionTime: 'asc' | 'desc' }[]
  where: Record<string, unknown>
}

const fetchClassicItems = (
  chainId: number | null | undefined,
  variables: ClassicItemsVariables,
) => {
  const url = chainId ? subgraphUrl[chainId] : undefined
  if (!url) throw new Error(`No subgraph URL for chain ${chainId}`)
  return request<ClassicItemsResult>(
    url,
    CLASSIC_REGISTRY_ITEMS_QUERY,
    variables,
  )
}

/**
 * The router prefetches the same query through the batcher, which swallows
 * subgraph errors and caches an empty result. When that is what the cache
 * holds, refetch once with this page's fetcher (which throws, so the query
 * retries and can reach its error state) instead of waiting for the next
 * 30s poll behind a skeleton.
 */
const useRefetchWhenEmpty = (
  query: UseQueryResult<ClassicItemsResult>,
  variables: ClassicItemsVariables,
) => {
  const tried = useRef<string | undefined>(undefined)
  const key = JSON.stringify(variables)
  const empty = query.isSuccess && !query.data?.items
  const { isFetching, refetch } = query
  useEffect(() => {
    if (!empty || isFetching || tried.current === key) return
    tried.current = key
    // The rows and the header can share one cache entry: join, don't restart.
    refetch({ cancelRefetch: false })
  }, [empty, isFetching, key, refetch])
}

/** Whole-list counts for the header and the chips, from the unfiltered query. */
interface ListOverview {
  total: number
  /** False when the list hit the query limit: counts are lower bounds. */
  complete: boolean
  registered: number
  /** Entries per status filter, keyed like FILTER_KEYS (same predicates as the rows query). */
  byFilter: Record<string, number>
  openRequests: number
  inCourt: number
  /** Unix seconds of each entry's latest request. */
  latestRequests: number[]
}

const overviewOf = (items: RawItem[]): ListOverview => {
  const byFilter: Record<string, number> = Object.fromEntries(
    FILTER_CHIPS.map((chip) => [chip.key, 0]),
  )
  const bump = (key: string) => {
    byFilter[key] += 1
  }
  const latestRequests: number[] = []
  items.forEach((item) => {
    // A pending request's item is disputed exactly when its latest request is.
    const latest = item.requests?.[0]
    if (item.status === CONTRACT_STATUS.ABSENT) bump(FILTER_KEYS.ABSENT)
    else if (item.status === CONTRACT_STATUS.REGISTERED)
      bump(FILTER_KEYS.REGISTERED)
    else if (item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED)
      bump(
        latest?.disputed
          ? FILTER_KEYS.CHALLENGED_SUBMISSIONS
          : FILTER_KEYS.SUBMITTED,
      )
    else if (item.status === CONTRACT_STATUS.REMOVAL_REQUESTED)
      bump(
        latest?.disputed
          ? FILTER_KEYS.CHALLENGED_REMOVALS
          : FILTER_KEYS.REMOVAL_REQUESTED,
      )
    const submitted = Number(latest?.submissionTime)
    if (submitted > 0) latestRequests.push(submitted)
  })
  const inCourt =
    byFilter[FILTER_KEYS.CHALLENGED_SUBMISSIONS] +
    byFilter[FILTER_KEYS.CHALLENGED_REMOVALS]
  return {
    total: items.length,
    complete: items.length < MAX_ENTITIES,
    registered: byFilter[FILTER_KEYS.REGISTERED],
    byFilter,
    openRequests:
      byFilter[FILTER_KEYS.SUBMITTED] +
      byFilter[FILTER_KEYS.REMOVAL_REQUESTED] +
      inCourt,
    inCourt,
    latestRequests,
  }
}

/** A loaded item: its request data for the status machine and its decoded fields. */
interface DecodedEntry {
  tcrData: SubgraphItem
  columns: V2Field[]
  errors: string[]
}

/** "51.6 xDAI" from a wei amount; undefined while the amount is unknown. */
const formatAmount = (
  amount: BigNumber | undefined,
  symbol: string,
): string | undefined =>
  amount
    ? `${ethers.utils.formatEther(amount).replace(/\.?0+$/, '')} ${symbol}`
    : undefined

/**
 * "Address Tag" → "address tag" for mid-sentence use; every word is
 * lowercased except acronyms such as "NFT".
 */
const midSentence = (name: string): string =>
  name
    .split(' ')
    .map((word) =>
      word.length > 1 && word.slice(1) === word.slice(1).toLowerCase()
        ? word.toLowerCase()
        : word,
    )
    .join(' ')

const valueToText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number')
    return String(value)
  if (Array.isArray(value)) return value.map(valueToText).join(' ')
  if (typeof value === 'object')
    return Object.values(value as Record<string, unknown>)
      .map(valueToText)
      .join(' ')
  return ''
}

const entryMatchesSearch = (entry: DecodedEntry, rawSearch: string) => {
  const query = rawSearch.trim().toLowerCase()
  if (!query) return true
  const text = [
    entry.tcrData.itemID,
    entry.tcrData.ID,
    entry.tcrData.status,
    ...entry.columns.map(
      (column) => `${column.label ?? ''} ${valueToText(column.value)}`,
    ),
  ]
    .map(valueToText)
    .join(' ')
    .toLowerCase()
  return text.includes(query)
}

/**
 * Registered and Absent entries need no clock or challenge period, so they
 * keep a status while the on-chain parameters are still loading. Same labels
 * and roles as utils/item-status.ts.
 */
const settledStatus = (item: SubgraphItem): EntryStatusView | undefined => {
  if (item.status === CONTRACT_STATUS.REGISTERED)
    return {
      code: STATUS_CODE.REGISTERED,
      tone: 'registered',
      label: 'Registered',
    }
  if (item.status === CONTRACT_STATUS.ABSENT)
    return item.requests?.[0]?.requestType === CONTRACT_STATUS.REMOVAL_REQUESTED
      ? { code: STATUS_CODE.REMOVED, tone: 'off', label: 'Removed' }
      : { code: STATUS_CODE.REJECTED, tone: 'off', label: 'Rejected' }
  return undefined
}

/** Entries with a pending request first, as the old page ordered them. */
const pendingFirst = (a: DecodedEntry, b: DecodedEntry) => {
  if (!a.tcrData.resolved && b.tcrData.resolved) return -1
  if (a.tcrData.resolved && !b.tcrData.resolved) return 1
  return 0
}

const InfoIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 7.25v3.5" />
    <circle cx="8" cy="5.1" r="0.4" fill="currentColor" />
  </svg>
)

/* The one deprecation sentence and the list's lifetime, on the frame: no
   panel, no banner, just a hairline under it before the toolbar. */
const Legacy = styled.div`
  ${reveal}
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px 32px;
  margin-top: 20px;
  padding: 0 28px 20px;
  border-bottom: 1px solid var(--glass-border);

  @media (max-width: 860px) {
    padding: 0 4px 18px;
  }
`

const Deprecation = styled.p`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1 1 340px;
  max-width: 64ch;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  svg {
    flex: 0 0 auto;
    margin-top: 2px;
    color: var(--color-faint);
  }
`

const ListFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
`

const AddressLink = styled.a`
  color: var(--color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

const Items = () => {
  const navigate = useNavigate()
  const { search } = useLocation()
  const { tcrAddress } = useParams()
  const chainId = useUrlChainId()
  const timestamp = useContext(WalletContext)?.timestamp
  const tcrViewContext = useContext(TCRViewContext)
  const metaEvidence = tcrViewContext?.metaEvidence
  const challengePeriodDuration = tcrViewContext?.challengePeriodDuration
  const tcrError = tcrViewContext?.tcrError
  const gtcrView = tcrViewContext?.gtcrView
  const connectedTCRAddr = tcrViewContext?.connectedTCRAddr
  const submissionDeposit = tcrViewContext?.submissionDeposit
  const submissionChallengeDeposit = tcrViewContext?.submissionChallengeDeposit
  const removalDeposit = tcrViewContext?.removalDeposit
  const removalChallengeDeposit = tcrViewContext?.removalChallengeDeposit
  const arbitrationCost = tcrViewContext?.arbitrationCost
  const submissionBaseDeposit = tcrViewContext?.submissionBaseDeposit
  const submissionChallengeBaseDeposit =
    tcrViewContext?.submissionChallengeBaseDeposit
  const removalBaseDeposit = tcrViewContext?.removalBaseDeposit
  const removalChallengeBaseDeposit =
    tcrViewContext?.removalChallengeBaseDeposit
  const arbitrator = tcrViewContext?.arbitrator
  const arbitratorExtraData = tcrViewContext?.arbitratorExtraData
  const governor = tcrViewContext?.governor
  const nativeCurrency = useNativeCurrency()
  const openAttachment = useAttachment()
  const now = useNow()
  const [layout, setLayout] = useRegistryLayout('entries')
  const trust = useRegistryVerified(chainId, tcrAddress)
  const [submissionFormOpen, setSubmissionFormOpen] = useState<
    boolean | undefined
  >()
  const [formAttempt, setFormAttempt] = useState(0)
  const forms = useMemo(() => lazyForms(formAttempt), [formAttempt])
  const [nsfwFilterOn, setNSFWFilter] = useState(true)
  const [itemSearch, setItemSearch] = useState('')
  const [queryItemParams, setQueryItemParams] = useState<string[] | undefined>()
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set())
  const queryOptions = searchStrToFilterObjLight(search)

  const toggleNSFWFilter = useCallback((checked: boolean) => {
    setNSFWFilter(checked)
    localforage.setItem(NSFW_FILTER_KEY, checked)
  }, [])

  const {
    oldestFirst,
    page,
    absent,
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
  } = queryOptions
  const orderDirection = oldestFirst ? 'asc' : 'desc'
  const currentPage = Math.max(1, Number(page) || 1)
  const offset = (currentPage - 1) * ITEMS_PER_PAGE
  // Rows load in windows of MAX_ENTITIES that start on a window boundary,
  // and a page is a slice of its window after the pending-first sort, so the
  // pages partition the list: nothing repeats, nothing is skipped. On most
  // lists the one window is the whole list, and without filters it is the
  // same query as the header's.
  const windowStart = Math.floor(offset / MAX_ENTITIES) * MAX_ENTITIES

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

    // No filters selected - return all items
    if (conditions.length === 0)
      return { registry_id: { _eq: tcrAddress?.toLowerCase() } }

    // Single filter - no need for _or
    if (conditions.length === 1)
      return {
        registry_id: { _eq: tcrAddress?.toLowerCase() },
        ...conditions[0],
      }

    // Multiple filters - use _or clause
    return {
      registry_id: { _eq: tcrAddress?.toLowerCase() },
      _or: conditions,
    }
  }, [
    absent,
    challengedRemovals,
    challengedSubmissions,
    registered,
    removalRequested,
    submitted,
    tcrAddress,
  ])

  // Load NSFW user setting from localforage.
  useEffect(() => {
    ;(async () => {
      const savedSetting = await localforage.getItem(NSFW_FILTER_KEY)
      if (typeof savedSetting === 'boolean') setNSFWFilter(savedSetting)
    })()
  }, [])

  const queryVariables = useMemo<ClassicItemsVariables>(
    () => ({
      offset: windowStart,
      limit: MAX_ENTITIES,
      order_by: [{ latestRequestSubmissionTime: orderDirection }],
      where: itemsWhere,
    }),
    [windowStart, orderDirection, itemsWhere],
  )

  const itemsQuery = useQuery({
    queryKey: ['classicItems', queryVariables],
    queryFn: () => fetchClassicItems(chainId, queryVariables),
    enabled: !!chainId,
    staleTime: STALE_TIME,
    refetchInterval: 30_000, // Poll subgraph every 30s for status changes
  })
  useRefetchWhenEmpty(itemsQuery, queryVariables)
  const loadedItems = itemsQuery.data?.items

  // The whole list, newest first, for the header counts. Without filters on
  // the first page this is the same query (and cache entry) as the rows and
  // as the router's prefetch, so it costs nothing extra.
  const overviewVariables = useMemo<ClassicItemsVariables>(
    () => ({
      offset: 0,
      limit: MAX_ENTITIES,
      order_by: [{ latestRequestSubmissionTime: 'desc' }],
      where: { registry_id: { _eq: tcrAddress?.toLowerCase() } },
    }),
    [tcrAddress],
  )
  const overviewQuery = useQuery({
    queryKey: ['classicItems', overviewVariables],
    queryFn: () => fetchClassicItems(chainId, overviewVariables),
    enabled: !!chainId && !!tcrAddress,
    staleTime: STALE_TIME,
    refetchInterval: 30_000,
  })
  useRefetchWhenEmpty(overviewQuery, overviewVariables)
  const overviewItems = overviewQuery.data?.items
  const overview = useMemo(
    () => (overviewItems ? overviewOf(overviewItems) : undefined),
    [overviewItems],
  )

  // The subgraph rows reshaped into what the status machine and the item
  // pages expect (a basic useQuery plus a memo, no effect chains).
  const encodedItems = useMemo<SubgraphItem[] | undefined>(() => {
    if (!loadedItems || itemsQuery.isLoading) return undefined

    return loadedItems.map((item: RawItem) => {
      const { disputed, disputeID, submissionTime, rounds, resolved, deposit } =
        item.requests[0] ?? {}

      const {
        appealPeriodStart,
        appealPeriodEnd,
        ruling,
        hasPaidRequester,
        hasPaidChallenger,
        amountPaidRequester,
        amountPaidChallenger,
      } = rounds?.[0] ?? {}

      const currentRuling = ruling === 'None' ? 0 : ruling === 'Accept' ? 1 : 2
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
        disputeID,
        deposit,
        submissionTime: BigNumber.from(submissionTime ?? 0),
        hasPaid: [false, hasPaidRequester, hasPaidChallenger],
        currentRuling,
        appealStart: BigNumber.from(appealPeriodStart ?? 0),
        appealEnd: BigNumber.from(appealPeriodEnd ?? 0),
        amountPaid: [
          BigNumber.from(0),
          BigNumber.from(amountPaidRequester ?? 0),
          BigNumber.from(amountPaidChallenger ?? 0),
        ],
      } as unknown as SubgraphItem
    })
  }, [loadedItems, itemsQuery.isLoading])

  // Decode items once meta evidence and items were fetched.
  const items = useMemo<DecodedEntry[] | undefined>(() => {
    if (!metaEvidence || metaEvidence.address !== tcrAddress || !encodedItems)
      return undefined

    const columns = metaEvidence.metadata?.columns || []
    return encodedItems.map((item) => {
      let decodedItem: ReturnType<typeof gtcrDecode> | undefined
      const errors: string[] = []
      try {
        decodedItem = gtcrDecode({ values: item.data, columns })
      } catch {
        errors.push(
          `Error decoding item ${item.itemID} of list at ${tcrAddress}`,
        )
        console.warn(
          `Error decoding item ${item.itemID} of list at ${tcrAddress}`,
        )
      }

      // Return the item columns along with its TCR status data.
      return {
        tcrData: item,
        columns: columns.map(
          (column: Column, index: number): V2Field => ({
            ...column,
            value: decodedItem?.[index],
          }),
        ),
        errors,
      }
    })
  }, [metaEvidence, tcrAddress, encodedItems])

  // Search covers the whole loaded window; otherwise a page is its slice of
  // the window, pending requests first.
  const searching = itemSearch.trim() !== ''
  const matchingItems = useMemo(
    () => items?.filter((entry) => entryMatchesSearch(entry, itemSearch)),
    [items, itemSearch],
  )
  const pageStart = offset - windowStart
  const visibleItems = useMemo(() => {
    if (!matchingItems) return undefined
    // Promote pending requests across the window, then take the page.
    const ordered = [...matchingItems].sort(pendingFirst)
    return searching
      ? ordered
      : ordered.slice(pageStart, pageStart + ITEMS_PER_PAGE)
  }, [matchingItems, searching, pageStart])

  // A ?action= link opens the full-page submit form with the link's values
  // in its URL, so it still fills the form after a reload; a connected list
  // keeps its own dialog. Every other parameter is a field value, in column
  // order, except list state (filters, sort, page) and the theme preview.
  // It acts when the link itself changes, not when a chip, the sort or the
  // page does, once the metadata says which kind of list this is.
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
    setQueryItemParams(link?.values)
    setSubmissionFormOpen(true)
  }, [actionLink, connectedList, chainId, tcrAddress, navigate])

  const { metadata, fileURI } = metaEvidence || {}
  const { tcrTitle, tcrDescription, logoURI } = metadata || {}
  const itemName = metadata?.itemName || 'entry'
  const itemNamePlural = metadata?.itemNamePlural || `${itemName}s`
  const isConnectedTCR = Boolean(metadata?.isConnectedTCR)
  const isTCRofTCRs = Boolean(metadata?.isTCRofTCRs)
  const relTcrDisabled = Boolean(metadata?.relTcrDisabled)

  const normalizedDescription = tcrDescription
    ? tcrDescription.endsWith('.')
      ? tcrDescription
      : `${tcrDescription}.`
    : ''
  const seoTitle = truncateAtWord(
    tcrTitle ? `${tcrTitle} - Kleros · Curate` : 'Kleros · Curate',
    60,
  )
  const seoDescription = truncateAtWord(
    metadata
      ? `Explore the ${tcrTitle} list on Kleros Curate: ${normalizedDescription}`
      : 'Explore curated lists on Kleros Curate.',
    160,
  )
  useDocumentHead(seoTitle, seoDescription)

  const columns = useMemo(
    () => tableColumns((metadata?.columns ?? []) as V2Field[]),
    [metadata],
  )

  // The reveal button sits inside the row link in the cards and rows
  // layouts, so the click must not also open the entry.
  const reveal = useCallback((id: string, event?: React.SyntheticEvent) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    setRevealed((previous) => new Set(previous).add(id))
  }, [])

  const verifiedEntries = trust.listOfLists ? trust.verifiedSet : undefined
  const entries = useMemo<EntryRow[]>(() => {
    if (!visibleItems || !tcrAddress) return []
    return visibleItems.map((entry) => {
      const id = String(entry.tcrData.ID ?? entry.tcrData.itemID)
      const status =
        lightEntryStatus(entry.tcrData, timestamp, challengePeriodDuration) ??
        settledStatus(entry.tcrData)
      const firstValue = entry.columns[0]?.value
      const hidden =
        nsfwFilterOn &&
        !revealed.has(id) &&
        status?.code !== undefined &&
        HIDDEN_STATUS_CODES.has(status.code)
      return {
        id,
        href: `/tcr/${chainId}/${tcrAddress}/${id}`,
        fields: entry.columns,
        status,
        openListTo:
          isTCRofTCRs && typeof firstValue === 'string'
            ? `/tcr/${chainId}/${firstValue}`
            : undefined,
        // On the Kleros list of lists, the lists it vouches for carry the seal.
        verified: !!verifiedEntries?.has(
          extractRegistryAddress(null, entry.columns) ?? '',
        ),
        hidden,
        onReveal: hidden
          ? (event?: React.SyntheticEvent) => reveal(id, event)
          : undefined,
      }
    })
  }, [
    visibleItems,
    tcrAddress,
    chainId,
    timestamp,
    challengePeriodDuration,
    nsfwFilterOn,
    revealed,
    isTCRofTCRs,
    verifiedEntries,
    reveal,
  ])

  const court = useMemo(() => {
    if (!arbitratorExtraData) return undefined
    try {
      return jurorsAndCourtIDFromExtraData(String(arbitratorExtraData))
    } catch {
      return undefined
    }
  }, [arbitratorExtraData])

  if (!tcrAddress)
    return (
      <ErrorPage
        code="404"
        message="The gods are having trouble finding this list."
        tip="Make sure your wallet is set to the correct network (is this on Gnosis Chain?)."
      />
    )

  if (tcrError)
    return (
      <ErrorPage
        code="400"
        message={
          typeof tcrError === 'string' ? tcrError : 'Decoding this item.'
        }
      />
    )

  // Whole-list counts, the same three the Light and Stake headers show. A
  // list past the query limit was counted from its newest entries only, so
  // every count is a lower bound ("1,000+").
  const countText = (value: number) =>
    overview
      ? `${integer.format(value)}${overview.complete ? '' : '+'}`
      : undefined
  const stats: RegistryStat[] = [
    { label: 'Entries', value: overview && countText(overview.total) },
    {
      label: 'Open requests',
      value: overview && countText(overview.openRequests),
    },
    { label: 'In court', value: overview && countText(overview.inCourt) },
  ]

  const periodSeconds = challengePeriodDuration
    ? challengePeriodDuration.toNumber()
    : undefined
  const periodText = periodSeconds
    ? formatDurationLong(periodSeconds)
    : undefined
  const costText = formatAmount(arbitrationCost, nativeCurrency)
  const breakdown = (base: BigNumber | undefined) =>
    base && costText
      ? `${formatAmount(base, nativeCurrency)} base deposit + ${costText} arbitration cost`
      : undefined
  const submitTotal = formatAmount(submissionDeposit, nativeCurrency)
  const challengeTotal = formatAmount(
    submissionChallengeDeposit,
    nativeCurrency,
  )

  // Addresses are middle-truncated, carry the full value in the title and
  // open the chain explorer (DESIGN.md address rule).
  const addressValue = (address: unknown) => {
    if (typeof address !== 'string' || !address) return undefined
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
        {truncateMiddle(address, 8, 6)}
      </AddressLink>
    ) : (
      <span title={address}>{truncateMiddle(address, 8, 6)}</span>
    )
  }

  // The Light page's labels; the hints add each deposit's breakdown.
  const parameters: RegistryParameter[] = [
    {
      label: 'Submission deposit',
      value: submitTotal,
      hint: breakdown(submissionBaseDeposit),
    },
    {
      label: 'Challenge deposit',
      value: challengeTotal,
      hint: breakdown(submissionChallengeBaseDeposit),
    },
    {
      label: 'Removal deposit',
      value: formatAmount(removalDeposit, nativeCurrency),
      hint: breakdown(removalBaseDeposit),
    },
    {
      label: 'Removal challenge deposit',
      value: formatAmount(removalChallengeDeposit, nativeCurrency),
      hint: breakdown(removalChallengeBaseDeposit),
    },
    {
      label: 'Challenge period',
      value: periodText,
      hint: 'Time anyone has to challenge a submission or a removal.',
    },
    {
      label: 'Arbitration cost',
      value: costText,
      hint: 'Paid to the court when a dispute opens. The winner takes the pool minus one arbitration cost.',
    },
    {
      label: 'Court',
      value: court
        ? `Court ${court.courtID} · ${court.numberOfJurors} juror${court.numberOfJurors === 1 ? '' : 's'}`
        : undefined,
      hint: 'The Kleros court and jury size that decide a challenge.',
    },
    {
      label: 'Arbitrator',
      value: addressValue(arbitrator),
      hint: 'The contract that runs disputes for this list.',
    },
    {
      label: 'Governor',
      value: addressValue(governor),
      hint: 'Can change the deposits, the challenge period, the court and the policy.',
    },
    {
      label: 'Rejected or removed',
      value: overview && countText(overview.byFilter[FILTER_KEYS.ABSENT]),
      hint: 'Included in the Entries count.',
    },
  ]

  const itemWord = midSentence(itemName)
  const explainerSteps: ExplainerStep[] = [
    {
      title: 'Follow the policy, get your deposit back',
      body:
        submitTotal && submissionBaseDeposit && costText
          ? `You send now ${submitTotal} = ${formatAmount(submissionBaseDeposit, nativeCurrency)} base deposit + ${costText} arbitration cost. If your ${itemWord} follows the listing policy, it comes back in full.`
          : `You lock the list’s base deposit plus the arbitration cost. If your ${itemWord} follows the listing policy, it comes back in full.`,
    },
    {
      // A successful challenger nets the submitter's base deposit (the
      // round's pool, less the one arbitration cost) and gets their own back.
      title: 'Spot a mistake, earn a bounty',
      body: `Challenge a submission that breaks the policy ${
        periodText ? `within ${periodText}` : 'during its challenge period'
      }. If jurors agree, you earn the submitter's ${
        submissionBaseDeposit
          ? `${formatAmount(submissionBaseDeposit, nativeCurrency)} base deposit`
          : 'base deposit'
      } and your ${challengeTotal ?? 'challenge deposit'} comes back.`,
    },
    {
      title: 'Kleros jurors decide',
      body: 'They rule on the listing policy. The side they agree with gets its deposit back plus the other side’s, less the arbitration cost.',
    },
  ]

  const badgesListTo =
    chainId &&
    connectedTCRAddr &&
    connectedTCRAddr !== ZERO_ADDRESS &&
    !relTcrDisabled
      ? `/tcr/${chainId}/${connectedTCRAddr}`
      : undefined

  const openSubmit = () => {
    if (chainId && tcrAddress) navigate(submitPathFor(chainId, tcrAddress))
    else setSubmissionFormOpen(true)
  }

  const setFilter = (filter: string, checked: boolean) =>
    navigate({
      search: updateLightFilter({ prevQuery: search, filter, checked }),
    })

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(search)
    params.set(FILTER_KEYS.PAGE, String(newPage))
    navigate({ search: `?${params.toString()}` })
  }

  // Each chip carries its status's count when the whole list is loaded.
  const exactCounts = overview?.complete ? overview.byFilter : undefined
  const chips: FilterChip[] = FILTER_CHIPS.map((chip) => ({
    ...chip,
    label: exactCounts
      ? `${chip.label} ${integer.format(exactCounts[chip.key])}`
      : chip.label,
    checked: Boolean(queryOptions[chip.key]),
  }))
  const checkedChips = chips.filter((chip) => chip.checked)
  const filtersActive = searching || checkedChips.length > 0
  const clearFilters = () => {
    setItemSearch('')
    navigate({ search: '' })
  }

  const loading = itemsQuery.isLoading || !metadata || !items
  const loadedTotal = loadedItems?.length ?? 0
  const knownTotal = windowStart + loadedTotal
  // The entries the filters select, from the same whole-list counts as the
  // header (the chip predicates do not overlap, so they add up). Unknown
  // when the list is past the query limit.
  const exactTotal = exactCounts
    ? checkedChips.length === 0
      ? overview?.total
      : checkedChips.reduce((sum, chip) => sum + exactCounts[chip.key], 0)
    : undefined
  const listTotal = exactTotal ?? knownTotal
  // A full window may have a next one: one more page reaches it.
  const pageTotal =
    exactTotal ?? knownTotal + (loadedTotal >= MAX_ENTITIES ? 1 : 0)
  const shownFrom = offset + 1
  const shownTo = offset + entries.length

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
        verified={trust.verified}
        listOfLists={trust.listOfLists}
        kindLabel={KIND_LABEL}
        itemName={itemWord}
        primaryLabel={`Submit ${itemWord}`}
        primaryAmount={
          submitTotal ? (
            <span title={breakdown(submissionBaseDeposit)}>{submitTotal}</span>
          ) : undefined
        }
        onPrimary={openSubmit}
        policyURI={fileURI}
        onOpenPolicy={
          fileURI ? () => openAttachment(parseIpfs(fileURI), true) : undefined
        }
        badgesListTo={badgesListTo}
        stats={stats}
        parameters={parameters}
        explainerId={`registry-classic-${tcrAddress.toLowerCase()}`}
        explainerHeading="A deposit you get back, a bounty for spotting mistakes."
        explainerSteps={explainerSteps}
        loading={!metaEvidence || overviewQuery.isLoading}
        registeredCount={overview?.complete ? overview.registered : undefined}
        totalCount={overview?.complete ? overview.total : undefined}
      />

      <Legacy style={{ '--i': 1 } as React.CSSProperties}>
        {/* Not on a Classic list of lists: it is Kleros Verified and keeps
            granting the badge, so nothing there may read as retired. */}
        {!trust.listOfLists && (
          <Deprecation>
            <InfoIcon />
            Classic Curate is deprecated: this list keeps working, but new lists
            use Light Curate.
          </Deprecation>
        )}
        {overview && (
          <ClassicLifetime
            times={overview.latestRequests}
            complete={overview.complete}
            now={now}
            itemName={itemWord}
            itemNamePlural={itemNamePlural}
          />
        )}
      </Legacy>

      <RegistryToolbar
        search={itemSearch}
        onSearch={setItemSearch}
        placeholder={`Search ${itemNamePlural}`}
        chips={chips}
        onChipChange={setFilter}
        sort={oldestFirst ? 'oldest' : 'newest'}
        onSortChange={(sort) =>
          setFilter(FILTER_KEYS.OLDEST_FIRST, sort === 'oldest')
        }
        layout={layout}
        onLayoutChange={setLayout}
        nsfwFilter={nsfwFilterOn}
        onNsfwChange={toggleNSFWFilter}
        shown={entries.length}
        total={listTotal}
      />

      {itemsQuery.error ? (
        <Surface $padding="none">
          <EmptyState
            icon="activity"
            title={`Could not load the ${itemNamePlural}`}
            action={
              <Button
                type="button"
                $variant="secondary"
                $size="sm"
                onClick={() => itemsQuery.refetch()}
              >
                Try again
              </Button>
            }
          >
            {itemsQuery.error.message}
          </EmptyState>
        </Surface>
      ) : (
        <EntryList
          layout={layout}
          entries={entries}
          columns={columns}
          now={now}
          itemName={itemWord}
          itemNamePlural={itemNamePlural}
          loading={loading}
          emptyAction={
            filtersActive ? (
              <Button
                type="button"
                $variant="secondary"
                $size="sm"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Past the last page (?page=N with no rows) the footer stays so the
          pagination can take the reader back. */}
      {!loading && !itemsQuery.error && (entries.length > 0 || offset > 0) && (
        <ListFooter>
          <Small $muted>
            {searching
              ? `${entries.length} of ${loadedTotal} loaded ${itemNamePlural} match`
              : entries.length === 0
                ? `No ${itemNamePlural} on page ${currentPage}`
                : `${capitalizeFirstLetter(itemNamePlural)} ${shownFrom}–${shownTo} of ${integer.format(listTotal)}${exactTotal === undefined ? ' loaded' : ''}`}
          </Small>
          {!searching && (pageTotal > ITEMS_PER_PAGE || offset > 0) && (
            <Pagination
              current={currentPage}
              pageSize={ITEMS_PER_PAGE}
              total={pageTotal}
              onChange={goToPage}
            />
          )}
        </ListFooter>
      )}

      {/* A form that fails to load (a stale chunk after a deploy) says so
          once and closes, leaving the list usable. Nothing renders it again
          until the form is asked for again (a new ?action= link), and that
          request imports it afresh. */}
      {metaEvidence && metadata && submissionFormOpen !== undefined && (
        <ErrorBoundary
          key={forms.attempt}
          fallback={null}
          onError={() => {
            errorToast(
              'Could not load the submission form. Reload the page and try again.',
            )
            setSubmissionFormOpen(undefined)
            setFormAttempt((attempt) => attempt + 1)
          }}
        >
          <Suspense fallback={null}>
            {isConnectedTCR ? (
              <forms.SubmitConnectModal
                visible={submissionFormOpen}
                onCancel={() => setSubmissionFormOpen(false)}
                tcrAddress={tcrAddress}
                gtcrView={gtcrView}
              />
            ) : (
              <forms.SubmitModal
                visible={submissionFormOpen}
                onCancel={() => setSubmissionFormOpen(false)}
                submissionDeposit={submissionDeposit}
                challengePeriodDuration={challengePeriodDuration}
                tcrAddress={tcrAddress}
                metaEvidence={metaEvidence}
                initialValues={queryItemParams}
              />
            )}
          </Suspense>
        </ErrorBoundary>
      )}
    </Page>
  )
}

export default Items
