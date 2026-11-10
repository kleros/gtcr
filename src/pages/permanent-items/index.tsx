import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import {
  P_FILTER_KEYS,
  searchStrToFilterObjPermanent,
  updateLightFilter,
} from 'utils/filters'
import { parseIpfs } from 'utils/ipfs-parse'
import {
  capitalizeFirstLetter,
  jurorsAndCourtIDFromExtraData,
} from 'utils/string'
import { truncateAtWord } from 'utils/truncate-at-word'
import { formatDurationLong } from 'utils/time'
import { getAddressPage } from 'utils/network-utils'
import { STATUS_CODE } from 'utils/permanent-item-status'
import useUrlChainId from 'hooks/use-url-chain-id'
import useArbitrationCost from 'hooks/arbitration-cost'
import useTokenSymbol from 'hooks/token-symbol'
import useNativeCurrency from 'hooks/native-currency'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import { useAttachment } from 'hooks/use-attachment'
import { useEthersProvider } from 'hooks/ethers-adapters'
import ETHAmount from 'components/eth-amount'
import TokenAmount from 'components/token-amount'
import { Pagination } from 'components/ui'
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
import { stakeEntryStatus } from 'components/curate/entry-status'
import type { ExplainerStep } from 'components/curate/explainer'
import type { V2Field } from 'components/curate/v2'
import {
  Button,
  Data,
  EmptyState,
  Grid,
  Page,
  SkeletonBlock,
  Small,
  Stack,
  Surface,
  truncateMiddle,
} from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import { useStakeSummary } from 'components/curate/registry-stake-summary'
import type { StakeLane } from 'components/curate/registry-stake-summary'
import { StakeInsights } from 'components/curate/registry-stake-insights'
import { useRegistryLayout } from 'components/curate/registry-shared-layout'
import { useRegistryVerified } from 'components/curate/registry-shared-verified'
import ErrorPage from '../error-page'

/*
 * Stake Curate registry page. The registry is read first (its periods and
 * multipliers are needed to derive statuses), then the items for the current
 * filters and page, and a summary of every entry for the counts and the
 * drawings. The UI is RegistryHeader (identity, action, figures, parameters,
 * explainer), the three drawings (listing history, where the entries stand,
 * challenges), RegistryToolbar, EntryList and Pagination.
 */

const NSFW_FILTER_KEY = 'NSFW_FILTER_KEY'
const ITEMS_PER_PAGE = 40
const KIND_LABEL = 'Stake Curate'

// Registries whose description says "see terms and conditions" link to them.
const TERMS_AND_CONDITIONS_URLS: Record<string, string | undefined> = {
  '0x7305c57b731876f452da8574a77d05957820e588':
    'https://cdn.kleros.link/ipfs/QmcZ53agYqpPhYijRFzduC3EC64coFGZkhbRN1sPDyW7di',
}

const TERMS_PATTERN = /see\s+(?:the\s+)?terms?\s*(?:and|&)?\s*conditions?/gi

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

/** Each status filter chip with its count, while the count is known. */
const withCount = (label: string, count?: number) =>
  count !== undefined && Number.isFinite(count)
    ? `${label} ${formatInt(count)}`
    : label

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

const ExplorerLink = styled.a`
  color: var(--color-primary);
  text-decoration: none;

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
      {truncateMiddle(address, 8, 6)}
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
  const trust = useRegistryVerified(chainId, tcrAddress)
  const [nsfwFilterOn, setNsfwFilterOn] = useState(true)
  const [itemSearch, setItemSearch] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())

  const queryOptions = searchStrToFilterObjPermanent(search)
  const { oldestFirst, page, absent, registered, disputed } = queryOptions
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

  const itemsWhere = useMemo(() => {
    const statuses: string[] = []
    if (absent) statuses.push('Absent')
    if (registered) statuses.push('Submitted', 'Reincluded')
    if (disputed) statuses.push('Disputed')
    if (statuses.length === 0) return { registry: registryId }
    return { registry: registryId, status_in: statuses }
  }, [absent, registered, disputed, registryId])

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
  const arbitrationSetting = registry?.arbitrationSettings?.[0]
  const metaEvidenceURI = arbitrationSetting?.metaEvidenceURI
  const columnsQuery = useQuery({
    queryKey: ['permanentRegistryColumns', metaEvidenceURI],
    queryFn: async () => {
      const response = await fetch(parseIpfs(metaEvidenceURI!))
      const file: MetaEvidence = await response.json()
      return file.metadata?.columns ?? []
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
    ;(async () => {
      const saved = await localforage.getItem(NSFW_FILTER_KEY)
      if (typeof saved === 'boolean') setNsfwFilterOn(saved)
    })()
  }, [])
  const toggleNsfwFilter = useCallback((checked: boolean) => {
    setNsfwFilterOn(checked)
    localforage.setItem(NSFW_FILTER_KEY, checked)
  }, [])

  // Every entry of the list, for exact counts and the drawings.
  const {
    summary,
    loading: summaryLoading,
    failed: summaryFailed,
  } = useStakeSummary({ chainId, registryId, registry, timestamp })
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

  // The batcher resolves failed requests to {}, so guard the items field.
  const pageItems = itemsQuery.data?.items as StakeItem[] | undefined
  const items: StakeItem[] = useMemo(() => pageItems ?? [], [pageItems])

  // Entries matching the status filters, from the counts above; undefined
  // when a bucket it needs is unknown.
  const filteredCount = useMemo((): number | undefined => {
    if (!absent && !registered && !disputed) return counts.total
    const parts = [
      absent ? counts.absent : 0,
      registered ? counts.listed : 0,
      disputed ? counts.disputed : 0,
    ]
    if (parts.some((part) => part === undefined)) return undefined
    return parts.reduce<number>((sum, part) => sum + (part ?? 0), 0)
  }, [absent, registered, disputed, counts])

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
    truncateAtWord(
      title ? `${title} - Kleros · Curate` : 'Kleros · Curate',
      60,
    ),
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

  // The chips carry their counts, as the Light page's do, once the counts
  // are settled and trusted (undefined otherwise).
  const chipCount = (value?: number) => (countsReady ? value : undefined)
  const chips: FilterChip[] = [
    {
      key: P_FILTER_KEYS.REGISTERED,
      label: withCount('Listed', chipCount(counts.listed)),
      tone: 'registered',
      checked: !!registered,
    },
    {
      key: P_FILTER_KEYS.DISPUTED,
      label: withCount('Disputed', chipCount(counts.disputed)),
      tone: 'contested',
      checked: !!disputed,
    },
    {
      key: P_FILTER_KEYS.ABSENT,
      label: withCount('Rejected or removed', chipCount(counts.absent)),
      tone: 'off',
      checked: !!absent,
    },
  ]

  const setFilter = (filter: string, checked: boolean) =>
    navigate({
      search: updateLightFilter({ prevQuery: search, filter, checked }),
    })

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(search)
    params.set(P_FILTER_KEYS.PAGE, String(nextPage))
    navigate({ search: `?${params.toString()}` })
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

  // RegistryHeader prints '—' (or a skeleton) for an undefined value.
  const countValue = (value?: number) =>
    countsReady && value !== undefined ? formatInt(value) : undefined

  const stats: RegistryStat[] = [
    { label: 'Entries', value: countValue(counts.total) },
    { label: 'Listed', value: countValue(counts.listed) },
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
      label: 'Arbitration params cooldown',
      value: periodValue(registry?.arbitrationParamsCooldown),
      hint: 'Delay before new arbitration settings apply to every entry.',
    },
    {
      label: 'Arbitrator',
      value:
        chainId && registry?.arbitrator?.id ? (
          <>
            <AddressValue chainId={chainId} address={registry.arbitrator.id} />
            {court && (
              <span title={`Extra data ${arbitratorExtraData}`}>
                {' · '}Court {court.courtID} · {court.numberOfJurors} jurors
              </span>
            )}
          </>
        ) : undefined,
      hint: court
        ? `Challenges go to court ${court.courtID}, which draws ${court.numberOfJurors} jurors.`
        : arbitratorExtraData
          ? `Extra data ${arbitratorExtraData.slice(0, 18)}…`
          : undefined,
    },
    {
      label: 'Governor',
      value:
        chainId && contractQuery.data?.governor ? (
          <AddressValue
            chainId={chainId}
            address={contractQuery.data.governor}
          />
        ) : undefined,
      hint: 'Can change the periods, the multipliers and the arbitration settings.',
    },
    {
      label: 'Rejected or removed',
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
      } plus the arbitration cost. If Kleros jurors agree, you take its whole stake and its arbitration deposit, and your own stake comes back.`,
    },
    {
      title: 'Kept on the list, your stake grows',
      body: `If the jurors keep your ${itemName}, the challenger's stake is added to yours, so the next challenge costs more (progressive protection).`,
    },
  ]

  // The drawings never name an entry the list itself hides.
  const laneHidden = (lane: StakeLane) =>
    nsfwFilterOn &&
    !revealed.has(lane.id) &&
    (lane.statusCode === undefined
      ? lane.tone === 'off'
      : HIDDEN_STATUSES.has(lane.statusCode))

  const openLane = (lane: StakeLane) => {
    if (chainId && tcrAddress)
      navigate(`/tcr/${chainId}/${tcrAddress}/${lane.id}`)
  }

  if (!chainId || !tcrAddress)
    return (
      <ErrorPage
        code="404"
        title="List not found"
        message="This address does not point to a Stake Curate list on a supported chain."
      />
    )

  if (registryQuery.isError || (registryQuery.data && !registry))
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
  const noun = (count: number) => (count === 1 ? itemName : itemNamePlural)
  const outOfRangeLine =
    itemCount === undefined
      ? 'This page is past the end of the list.'
      : itemCount === 0
        ? `No ${itemNamePlural} match${
            absent || registered || disputed ? ' these filters' : ' yet'
          }.`
        : absent || registered || disputed
          ? `${formatInt(itemCount)} ${noun(itemCount)} ${
              itemCount === 1 ? 'matches' : 'match'
            } these filters, all on earlier pages.`
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
        kindLabel={KIND_LABEL}
        itemName={itemName}
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
        // The policy history reads Light and Classic events only; on a
        // Stake list it would shimmer and then show nothing.
        policyUpdated={false}
        stats={stats}
        parameters={parameters}
        explainerId={`registry-stake-${tcrAddress.toLowerCase()}`}
        explainerHeading="A stake backs every entry. Spot a bad one and it is yours."
        explainerSteps={explainerSteps}
        loading={loading || summaryLoading}
      />

      <StakeInsights
        summary={summaryFailed ? undefined : summary}
        loading={loading || summaryLoading}
        now={now}
        itemName={itemName}
        itemNamePlural={itemNamePlural}
        isHidden={laneHidden}
        onOpen={openLane}
      />

      <RegistryToolbar
        search={itemSearch}
        onSearch={setItemSearch}
        placeholder={`Search ${itemNamePlural}`}
        chips={chips}
        onChipChange={setFilter}
        sort={oldestFirst ? 'oldest' : 'newest'}
        onSortChange={(sort) =>
          setFilter(P_FILTER_KEYS.OLDEST_FIRST, sort === 'oldest')
        }
        layout={layout}
        onLayoutChange={setLayout}
        nsfwFilter={nsfwFilterOn}
        onNsfwChange={toggleNsfwFilter}
        shown={itemsLoading ? 0 : entries.length}
        total={toolbarTotal}
      />

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
          layout === 'cards' ? (
            <Grid $min={260}>
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock key={index} $height="180px" />
              ))}
            </Grid>
          ) : (
            <Stack $gap={8}>
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock key={index} $height="56px" />
              ))}
            </Stack>
          )
        ) : outOfRange ? (
          <Surface $padding="none">
            <EmptyState
              icon="list"
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
