import React, { useState, useEffect, useContext, useMemo } from 'react'
import { ethers, type BigNumber } from 'ethers'
import styled from 'styled-components'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import useStickyTop from 'hooks/use-sticky-top'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useTcrMetaEvidence from 'hooks/use-tcr-meta-evidence'
import { useAttachment } from 'hooks/use-attachment'
import ErrorPage from '../error-page'
import {
  ENTRY_LINK_TIP,
  ENTRY_LOAD_FAILED,
  LIST_FILE_FAILED,
  ENTRY_INDEXING_MESSAGE,
  ENTRY_INDEXING_TITLE,
  ENTRY_MISSING_TIP,
  justSubmitted,
  missingEntryPollMs,
} from '../error-page/copy'
import RequestTimelines, {
  type TimelineRequest,
} from 'components/request-timelines'
import PolicyUpdatedBadge from 'components/policy-updated-badge'
import { StandardTCRViewContext } from 'contexts/standard-tcr-view-context'
import { WalletContext } from 'contexts/wallet-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { capitalizeFirstLetter } from 'utils/string'
import { STANDARD_ITEM_DETAILS_QUERY } from 'utils/graphql'
import {
  CONTRACT_STATUS,
  hasPendingRequest,
  itemToStatusCode,
} from 'utils/item-status'
import { formatAbsolute } from 'utils/time'
import { formatSince } from 'utils/format-since'
import { STALE_TIME } from 'consts'
import { isKlerosArbitrator } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
import { type ItemFile, sanitizeItemFile } from 'utils/item-file-guard'
import { truncateAtWord } from 'utils/truncate-at-word'
import { CurateIcon } from 'components/curate/icons'
import {
  ChainChip,
  Label,
  Page,
  SkeletonBlock,
  Surface,
} from 'components/curate/primitives'
import {
  EntryStatus,
  standardEntryStatus,
} from 'components/curate/entry-status'
import { Explainer } from 'components/curate/explainer'
import { EvidenceClosed } from 'components/inline-evidence-composer'
import { reveal } from 'components/curate/motion/reveal'
import {
  AddressLink,
  FieldValue,
  hasValue,
  titleField,
  type EntryField,
} from 'components/curate/item-standard-fields'
import { StickyActionBarSpacer } from 'components/curate/item-standard-action-bar'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { ItemSubmissionPanel } from 'components/curate/item-submission-panel'
import SeerExtraDetails from 'components/custom-registries/seer/seer-item-details'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'
import { DisputeCasePanel } from 'components/curate/dispute-case-panel'
import {
  DisputeRecordPanel,
  type DisputeRecord,
} from 'components/curate/dispute-record-panel'
import { AppealWindowPanel } from 'pages/standard-item-details/appeal-funding'
import {
  caseState,
  courtLink,
  requestFacts,
  rulingShort,
  type StandardRequest,
} from './request-facts'
import { linkedListAddress, linkedListField } from './linked-list'

/*
 * Standard Curate item page, one layout in three states (settled, in its
 * challenge window, in court). A top line — where the entry sits, and at
 * its right end the policy it is judged by — then the hero (the one
 * featured panel): the entry named large with its status and a short facts
 * strip, and on the right the page's one clock — the challenge window, the
 * appeal period, the court period, or the date it settled; then, across the
 * bottom of the same box, the entry's full details — every field it has,
 * with its one picture beside them (round 4: the details were a second box
 * below). While a case is live, one full-width panel holds it: where it
 * stands, its periods, its jury and its actions. Then two columns: the
 * history on the left, the sticky action card on the right (a bottom bar
 * on phones). A case the
 * court has already decided is not live: it sits quietly at the top of the
 * left column as a record of what the jurors did. Every figure comes from
 * the subgraph, the list contract and the clock.
 */

/* The page's top line: where the entry sits, and at its right end the
   policy it is judged by (round 3: the policy used to sit on the status
   line, in the middle of the hero). The entrance fires on this row, so the
   crumb and the pill arrive together. */
const TopRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  ${reveal}
`

const Crumbs = styled.nav`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    text-decoration: none;
    transition: color var(--motion);
  }

  a:hover {
    color: var(--color-text);
  }

  span[aria-current] {
    color: var(--color-text);
  }
`

/* Desktop: identity and stats on the left, the clock on the right, and the
   entry's own fields across the full width underneath — round 4: "full
   details" was a box below the hero, and it belongs in the main one. When
   it stacks, the clock comes straight after the identity so the time
   pressure is on screen on load, ahead of the stats.

   The clock on the right fixes the height of the first two rows, so they
   share more room than their content needs. The identity row is sized to
   its content and the stats row takes the rest, which puts that slack
   under the stats instead of between the status line and them (round 3:
   the gap in between read as a hole). The fields row is independent of
   both, and the clock's column ends at its hairline in a T: a field list
   is taller than a clock, so a column spanning it would be glass beside
   nothing. */
const Hero = styled(Surface)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    'main side'
    'stats side'
    'fields fields';
  margin-top: 20px;
  ${reveal}

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    grid-template-areas:
      'main'
      'side'
      'stats'
      'fields';
  }
`

const HeroMain = styled.div`
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 32px 36px 20px;

  @media (max-width: 720px) {
    padding: 22px 18px 18px;
  }
`

const HeroStats = styled.div`
  grid-area: stats;
  min-width: 0;
  padding: 0 36px 28px;

  @media (max-width: 1000px) {
    padding-top: 4px;
  }

  @media (max-width: 720px) {
    padding: 4px 18px 20px;
  }
`

const HeroSide = styled.div`
  grid-area: side;
  min-width: 0;
  padding: 28px 28px 24px;
  border-left: 1px solid var(--glass-border);

  @media (max-width: 1000px) {
    border-top: 1px solid var(--glass-border);
    border-left: 0;
  }

  @media (max-width: 720px) {
    padding: 22px 18px 20px;
  }
`

/* The third row, under both columns: the entry's own fields, every one of
   them, with the picture beside them. It draws its own inset hairline the
   way the stats above it do — not a panel, so nothing is stacked inside
   the one featured box. */
const HeroFields = styled.div`
  grid-area: fields;
  min-width: 0;
  padding: 0 36px 28px;

  @media (max-width: 720px) {
    padding: 0 18px 22px;
  }
`

const Eyebrow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
`

const Title = styled.h1<{ $size: 'lg' | 'md' | 'sm' }>`
  margin: 0;
  min-width: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: ${({ $size }) =>
    $size === 'lg'
      ? 'clamp(30px, 1.6vw + 18px, 40px)'
      : $size === 'md'
        ? 'clamp(24px, 1vw + 16px, 32px)'
        : 'clamp(20px, 0.6vw + 14px, 26px)'};
  line-height: 1.08;
  font-weight: 500;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
  text-wrap: balance;

  a {
    color: inherit;
  }
`

const StatusRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
`

const Stats = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 16px 40px;
  margin: 0;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);

  div {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-size: 18px;
    line-height: 22px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

/* Full width under the hero: a live case is one region of the page, never
   a card in the rail. */
const CaseRegion = styled.div`
  margin-top: 24px;
  ${reveal}
`

/* The same two tracks in every state, so the full details keep one measure:
   while the entry waits on the court the rail is empty (the case panel above
   holds the state and the actions, or the record box at the top of this
   column once the ruling stands) and the column simply stays unfilled,
   rather than the fields stretching across the whole page. */
const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
  align-items: start;
  margin-top: 24px;

  /* One column where the hero itself stacks, so the rail keeps sticking at
     every width that still has two columns (round 4: the entry's fields
     made the hero several hundred pixels taller, and the action card under
     it now starts below the fold — sticky is what brings it back on the
     first scroll). Under 721px the fixed bottom bar carries the action
     instead; between the two the card is reached by scrolling to it. */
  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
`

const Main = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;

  > * {
    ${reveal}
  }

  > :nth-child(1) {
    --i: 3;
  }

  > :nth-child(2) {
    --i: 4;
  }

  > :nth-child(3) {
    --i: 5;
  }

  > :nth-child(4) {
    --i: 6;
  }

  > :nth-child(5) {
    --i: 7;
  }
`

/* Sticky under the app bar. */
const Rail = styled.aside`
  position: sticky;
  /* Under the app bar while it fits; taller than the window, high enough
     that its actions stay in view (useStickyTop sets --stick). */
  top: var(--stick, calc(var(--app-bar-height) + 24px));
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;

  > * {
    ${reveal}
    --i: 2;
  }

  @media (max-width: 1000px) {
    position: static;
    order: -1;
  }
`

const PolicyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  cursor: pointer;
  transition:
    color var(--motion),
    border-color var(--motion);

  &:hover {
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }
`

export const PolicyLink: React.FC<{ href: string }> = ({ href }) => {
  const openAttachment = useAttachment()
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  return (
    <PolicyButton type="button" onClick={() => openAttachment(href, true)}>
      <CurateIcon name="policy" size={14} />
      Listing policy
      <PolicyUpdatedBadge registryAddress={tcrAddress} />
    </PolicyButton>
  )
}

/** The size the title is set at, so long identifiers stay readable. */
const titleSize = (text: string): 'lg' | 'md' | 'sm' =>
  text.length > 90 ? 'sm' : text.length > 44 ? 'md' : 'lg'

interface ItemDetailsProps {
  itemID: string
  search?: string
}

const ItemDetails = ({ itemID, search }: ItemDetailsProps) => {
  const { tcrAddress } = useParams()
  const chainId = useUrlChainId()
  const library = useEthersProvider({
    chainId: chainId ?? undefined,
  })
  const [ipfsItemData, setIpfsItemData] = useState<ItemFile | undefined>()
  const timestamp = useContext(WalletContext)?.timestamp
  // The actions column stays reachable on short windows (useStickyTop).
  const railRef = useStickyTop(24)
  const [modalOpen, setModalOpen] = useState<boolean | undefined>()
  const tcrViewContext = useContext(StandardTCRViewContext)
  const tcrError = tcrViewContext?.tcrError
  const metaEvidence = tcrViewContext?.metaEvidence
  const challengePeriodDuration = tcrViewContext?.challengePeriodDuration
  const now = useNow()

  // Opened right after submitting it (submit-item): a missing entry is
  // still being indexed, not absent.
  const location = useLocation()
  const recentlySubmitted = justSubmitted(location.state)
  // subgraph item entities have id "<itemID>@<listaddress>"
  const compoundId = `${itemID}@${tcrAddress?.toLowerCase()}`
  const { graphqlBatcher } = useGraphqlBatcher()
  const detailsViewQuery = useQuery({
    queryKey: ['standardItemDetails', compoundId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: STANDARD_ITEM_DETAILS_QUERY,
        variables: { id: compoundId },
        chainId: chainId!,
      }),
    enabled: !!chainId,
    staleTime: STALE_TIME,
    // An entry sent a moment ago can take a while to reach the indexer:
    // keep looking for a while before settling on "not found".
    refetchInterval: (query) =>
      query.state.status === 'success' && !query.state.data?.litem
        ? missingEntryPollMs(query.state.dataUpdateCount, recentlySubmitted)
        : false,
  })

  const item = useMemo(
    () =>
      detailsViewQuery.isLoading ? undefined : detailsViewQuery.data?.litem,
    [detailsViewQuery.isLoading, detailsViewQuery.data],
  )
  // A failed read and a missing entry each get their own page; neither is
  // left as a loading skeleton.
  const itemLoadFailed = detailsViewQuery.isError && !detailsViewQuery.data
  const itemMissing =
    detailsViewQuery.isSuccess && !detailsViewQuery.data?.litem

  // Scout-style fire-and-forget IPFS background fetch. Only runs when the
  // subgraph didn't index props (indexer hit IPFS failure). Never blocks
  // rendering: the unavailable warning shows immediately and is silently
  // upgraded to real fields if/when the fetch resolves.
  const subgraphPropsMissing =
    !!item && (!item.props || item.props.length === 0)

  useEffect(() => {
    if (!item || !subgraphPropsMissing || ipfsItemData) return
    let cancelled = false
    const controller = new AbortController()
    void (async () => {
      try {
        const r = await fetch(parseIpfs(item.data), {
          signal: controller.signal,
        })
        if (!r.ok) return
        const data = sanitizeItemFile(await r.json())
        if (data && !cancelled) setIpfsItemData(data)
      } catch (err) {
        if (cancelled) return
        console.error('Could not get ipfs file', err)
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [item, subgraphPropsMissing, ipfsItemData])

  const decodedItem = useMemo(() => {
    if (!item) return undefined
    // The fields card offers the reward withdrawal once the latest request
    // is resolved; the entry says whether it is.
    const resolved = !!item.requests?.[0]?.resolved

    // Happy path: subgraph already decoded the item into props. Derive columns
    // from props directly so the fields card does not have to wait for the
    // metaEvidence IPFS fetch (which also hits the CDN and can lag).
    if (item.props && item.props.length > 0) {
      type ItemProp = {
        label: string
        value: unknown
        type: string
        description?: string
        isIdentifier?: boolean
      }
      return {
        ...item,
        resolved,
        errors: [],
        columns: item.props.map((p: ItemProp) => ({
          label: p.label,
          type: p.type,
          description: p.description,
          isIdentifier: p.isIdentifier,
        })),
        decodedData: item.props.map((p: ItemProp) => p.value),
      }
    }

    // Props missing from subgraph. If the background IPFS fetch succeeded,
    // show fields; otherwise show the "unavailable" warning immediately so the
    // user isn't stuck behind a hanging gateway.
    if (ipfsItemData && metaEvidence) {
      const columns = metaEvidence.metadata?.columns ?? []
      return {
        ...item,
        resolved,
        errors: [],
        columns,
        decodedData: columns.map(
          (c: { label: string }) => ipfsItemData.values[c.label] ?? null,
        ),
      }
    }

    return {
      ...item,
      resolved,
      errors: [`IPFS data unavailable for this item (${item.data}).`],
      columns: metaEvidence?.metadata?.columns ?? [],
      decodedData: [],
    }
  }, [item, metaEvidence, ipfsItemData])

  const { metadata } = metaEvidence || {}
  const { decodedData } = decodedItem || {}
  const { tcrTitle, itemName } = metadata || {}

  const view = useMemo(
    () => standardEntryStatus(item, timestamp, challengePeriodDuration),
    [item, timestamp, challengePeriodDuration],
  )

  const fields = useMemo<EntryField[]>(
    () =>
      decodedItem
        ? decodedItem.columns.map((column: Column, index: number) => ({
            ...column,
            value: decodedItem.decodedData?.[index],
          }))
        : [],
    [decodedItem],
  )
  // A list of lists' entry leads with the list it names: the field its
  // registry block and its seal read, not whichever identifier comes first
  // in the entry's own file.
  const primaryField = useMemo(
    () =>
      (metadata?.isTCRofTCRs
        ? linkedListField(fields, metadata.columns)
        : undefined) ?? titleField(fields),
    [fields, metadata],
  )
  const capitalizeFirst = (s: string | undefined) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

  // If this is a TCR in a TCR of TCRs, fetch its metadata via cached hook:
  // the list its field labelled like the list's GTCR address column names,
  // the one the seal reads, never just the file's first field.
  const itemAddress = metadata?.isTCRofTCRs
    ? linkedListAddress(fields, metadata.columns)
    : undefined
  const itemMetaQuery = useTcrMetaEvidence(itemAddress, chainId ?? undefined)
  // The tab names the entry itself as its heading does: an entry of a list
  // of lists by the list it points to, once that list's file is in.
  const linkedTitle =
    itemMetaQuery.data?.metadata?.tcrTitle ||
    itemMetaQuery.data?.metadata?.title
  const seoName =
    linkedTitle ||
    (primaryField && hasValue(primaryField)
      ? String(primaryField.value)
      : capitalizeFirst(itemName) || 'Entry')
  const fullSeoTitle =
    decodedItem && metadata
      ? `${seoName} · ${tcrTitle} | Kleros Curate`
      : 'Kleros Curate'
  const truncatedSeoTitle = truncateAtWord(fullSeoTitle, 160)

  const fullSeoMetaDescription =
    decodedItem && metadata && view && (decodedData?.length ?? 0) > 0
      ? `${decodedData.join(' ')} · ${view.label} on ${
          metadata.tcrTitle
        } in Kleros Curate`
      : 'View entry details on Kleros Curate.'
  const truncatedSeoMetaDescription = truncateAtWord(
    fullSeoMetaDescription,
    160,
  )

  const itemMetaEvidence = useMemo(() => {
    if (itemMetaQuery.error) return { error: itemMetaQuery.error }
    if (itemMetaQuery.data) return { file: itemMetaQuery.data }
    return undefined
  }, [itemMetaQuery.data, itemMetaQuery.error])

  // Fields render as soon as the subgraph responds. Neither metaEvidence nor
  // the background IPFS fetch blocks the card: if props are missing, the card
  // shows the "unavailable" warning immediately and silently upgrades if IPFS
  // ever resolves.
  const loading = !item

  // Check if there is some action on the URL and, if so, run it.
  useEffect(() => {
    if (loading) return

    const params = new URLSearchParams(search)
    if (!params.get('action')) return

    setModalOpen(true)
  }, [loading, search])

  // The court's appeal fee for the latest request's dispute, for the
  // crowdfunding card and dialog. It applies only while the dispute is open;
  // an entry added directly by the list's relayer has no request at all.
  // The key holds the dispute and its round count, so an appeal that opens a
  // new round reads the new fee; a failed read is retried, and the dialog
  // offers another try instead of loading forever.
  const latestRequest = item?.requests?.[0] as StandardRequest | undefined
  const appealCostApplies =
    !!library && !!latestRequest?.disputed && !latestRequest.resolved
  const appealCostQuery = useQuery({
    queryKey: [
      'appealCost',
      chainId,
      latestRequest?.arbitrator,
      latestRequest?.disputeID,
      latestRequest?.arbitratorExtraData,
      latestRequest?.rounds?.length,
    ],
    queryFn: async (): Promise<BigNumber> => {
      const arbitrator = new ethers.Contract(
        latestRequest!.arbitrator,
        _IArbitrator,
        library,
      )
      return arbitrator.appealCost(
        latestRequest!.disputeID,
        latestRequest!.arbitratorExtraData,
      )
    },
    enabled: appealCostApplies,
  })
  const appealCost = appealCostApplies ? appealCostQuery.data : undefined
  const appealCostFailed =
    appealCostApplies && appealCostQuery.isError && !appealCostQuery.isFetching

  // An error page names itself in the head (and keeps a 404 out of search
  // engines), but this page's effect runs after its child's: while one is
  // shown, the entry leaves the head alone.
  const showsErrorPage =
    !tcrAddress || !itemID || !!tcrError || itemLoadFailed || itemMissing
  useDocumentHead(
    showsErrorPage ? undefined : truncatedSeoTitle,
    showsErrorPage ? undefined : truncatedSeoMetaDescription,
  )

  // The list's file did not load: said, with a retry and the way back,
  // instead of a dead end.
  if (tcrAddress && itemID && tcrViewContext?.metaEvidenceFailed)
    return (
      <ErrorPage
        code="Error"
        title="This entry did not load"
        message={LIST_FILE_FAILED}
        onRetry={() => void tcrViewContext.retryMetaEvidence()}
        home={{
          to: `/tcr/${chainId}/${tcrAddress}`,
          label: 'Back to the list',
        }}
      />
    )

  if (!tcrAddress || !itemID || tcrError)
    return (
      <ErrorPage
        code="400"
        message={
          typeof tcrError === 'string'
            ? tcrError
            : 'This entry could not be found.'
        }
        tip={ENTRY_LINK_TIP}
      />
    )

  if (itemLoadFailed)
    return (
      <ErrorPage
        code="Error"
        title="This entry did not load"
        message={ENTRY_LOAD_FAILED}
        onRetry={() => detailsViewQuery.refetch()}
        home={{
          to: `/tcr/${chainId}/${tcrAddress}`,
          label: 'Back to the list',
        }}
      />
    )

  if (itemMissing && recentlySubmitted)
    return (
      <ErrorPage
        code="Indexing"
        tone="window"
        title={ENTRY_INDEXING_TITLE}
        message={ENTRY_INDEXING_MESSAGE}
        home={{
          to: `/tcr/${chainId}/${tcrAddress}`,
          label: 'Back to the list',
        }}
      />
    )

  if (itemMissing)
    return (
      <ErrorPage
        code="404"
        title="Entry not found"
        message="This list has no entry with this ID."
        tip={ENTRY_MISSING_TIP}
        home={{
          to: `/tcr/${chainId}/${tcrAddress}`,
          label: 'Back to the list',
        }}
      />
    )

  const entryName = itemName ? capitalizeFirstLetter(itemName) : 'Entry'
  const registryHref = `/tcr/${chainId}/${tcrAddress}`
  const request = item?.requests?.[0] as StandardRequest | undefined
  const statusCode =
    item && timestamp && challengePeriodDuration
      ? itemToStatusCode(item, timestamp, challengePeriodDuration)
      : undefined
  const facts =
    item && request && statusCode !== undefined && challengePeriodDuration
      ? requestFacts({
          item,
          request,
          statusCode,
          challengePeriodDuration,
          chainId,
        })
      : undefined
  // Where the case stands in the page's own words, for the case panel: the
  // court names the period, the page knows what it means for this entry.
  const caseWords =
    item && request && facts && statusCode !== undefined
      ? caseState(request, facts, statusCode)
      : undefined
  // The contracts take evidence only while the latest request is open.
  const canAddEvidence = !!item && hasPendingRequest(item.status)
  /*
   * The cases the court has already decided, newest first as the history
   * numbers them. An appeal being funded is not over — money is being
   * raised and the rail's funding card is live — so only a request whose
   * ruling already stands, or one long resolved, is a record.
   *
   * A request has a case because it was disputed, never because its case
   * number is not zero: the arbitrator numbers its first dispute 0
   * (request-facts.ts), and that case is as real as any other.
   */
  const decidedDisputes: DisputeRecord[] = (
    (item?.requests ?? []) as StandardRequest[]
  )
    .filter(
      (past, index) =>
        !!past.disputed &&
        (!!past.resolved ||
          (index === 0 && caseWords?.awaitingCourt === false)),
    )
    .map((past) => {
      const requesterName =
        past.requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
          ? 'submitter'
          : 'requester'
      const court = courtLink(chainId, past.arbitrator, past.disputeID)
      return {
        disputeID: String(past.disputeID),
        arbitrator: past.arbitrator,
        requesterName,
        // Once resolved the outcome can differ from the jurors' last
        // ruling: a side that alone funded the last appeal wins. Until
        // then the request still records 'None', which would read as
        // "Refused to rule", so before that only the jurors' own ruling
        // can be shown — as caseState reads it, so the hero and the
        // record never give the same case two different rulings.
        ruling: rulingShort(
          past.resolved
            ? (past.disputeOutcome ?? past.rounds?.[0]?.ruling)
            : past.rounds?.[0]?.ruling,
          requesterName,
        ),
        href: court?.href,
        host: court?.host,
      }
    })
  // In court there is nothing to act on and nothing to fund, so the rail
  // holds nothing: the block that has the state also has the actions — the
  // case panel above while jurors decide, the record box at the top of the
  // left column once the ruling stands.
  const showRail = !facts?.inCourt
  const statusCard = (
    <ItemStatusCard
      item={decodedItem}
      timestamp={timestamp}
      request={item?.requests && { ...item.requests[0] }}
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      appealCost={appealCost}
      appealCostFailed={appealCostFailed}
      retryAppealCost={() => void appealCostQuery.refetch()}
      dark
    />
  )
  const titleText =
    primaryField && hasValue(primaryField)
      ? String(primaryField.value)
      : entryName
  // An open request is decided by the arbitrator it was made with, a new
  // one by the list's; only Kleros has jurors to name.
  const klerosDecides = isKlerosArbitrator(
    chainId,
    request && !request.resolved
      ? request.arbitrator
      : tcrViewContext?.arbitrator,
  )

  return (
    <Page>
      <TopRow>
        <Crumbs aria-label="Breadcrumb">
          <Link to={registryHref}>
            <CurateIcon name="registry" size={14} />
            {tcrTitle || 'Registry'}
          </Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{entryName}</span>
        </Crumbs>
        {/* Outside the breadcrumb: the policy is what the entry is judged
            by, not a place on the way to it. */}
        {metaEvidence?.fileURI && (
          <PolicyLink href={parseIpfs(metaEvidence.fileURI)} />
        )}
      </TopRow>

      <Hero
        as="section"
        $featured
        $padding="none"
        aria-label={`${entryName} overview`}
        style={{ ['--i' as string]: 1 }}
      >
        <HeroMain>
          <Eyebrow>
            <Label $tone="faint">{entryName}</Label>
            {chainId && <ChainChip chainId={chainId} size="sm" />}
          </Eyebrow>
          {loading ? (
            <SkeletonBlock $height="40px" $width="min(420px, 100%)" />
          ) : (
            <Title $size={titleSize(titleText)}>
              {primaryField ? (
                <FieldValue field={primaryField} detailed />
              ) : (
                entryName
              )}
            </Title>
          )}
          <StatusRow>
            {view ? (
              <EntryStatus
                status={
                  // The ring beside it already draws this window.
                  facts?.inWindow || facts?.isPending || facts?.appealable
                    ? { ...view, windowStart: undefined }
                    : view
                }
                now={now}
              />
            ) : (
              <SkeletonBlock $height="18px" $width="220px" />
            )}
          </StatusRow>
        </HeroMain>
        <HeroSide>
          {item && request && facts && statusCode !== undefined ? (
            // Once one side is fully funded, the ring follows the other's clock.
            <AppealWindowPanel
              item={item}
              request={request}
              statusCode={statusCode}
              facts={facts}
              now={now}
            />
          ) : (
            <SkeletonBlock
              $height="216px"
              $width="216px"
              style={{ margin: '0 auto', borderRadius: '50%' }}
            />
          )}
        </HeroSide>
        <HeroStats>
          {request && facts ? (
            <Stats>
              <div>
                <Label as="dt" $tone="faint">
                  {facts.isRegistration ? 'Submitted' : 'Removal requested'}
                </Label>
                <dd title={formatAbsolute(facts.submissionTime)}>
                  {formatSince(facts.submissionTime, now)}
                </dd>
              </div>
              {request.requester && (
                <div>
                  <Label as="dt" $tone="faint">
                    By
                  </Label>
                  <dd>
                    <AddressLink address={request.requester} />
                  </dd>
                </div>
              )}
              {facts.hasDispute && request.challenger && (
                <div>
                  <Label as="dt" $tone="faint">
                    Challenged by
                  </Label>
                  <dd>
                    <AddressLink address={request.challenger} />
                  </dd>
                </div>
              )}
            </Stats>
          ) : (
            <SkeletonBlock $height="44px" />
          )}
        </HeroStats>
        <HeroFields>
          <ItemSubmissionPanel
            fields={fields}
            item={decodedItem}
            itemID={item?.itemID}
            errors={decodedItem?.errors}
            loading={loading}
            linkedRegistry={itemMetaEvidence}
            registryAddress={itemAddress}
            kind="standard"
          />
        </HeroFields>
      </Hero>

      {/* One region for a live case: where it stands, its periods, its jury
          and its actions (the design review's point 6.2). Only while the
          court is still deciding or an appeal is being funded — once the
          ruling stands, the record box below says so instead. */}
      {request &&
        facts?.hasDispute &&
        (facts.inCourt || facts.appealable) &&
        (caseWords?.awaitingCourt ?? true) && (
          <CaseRegion style={{ ['--i' as string]: 2 }}>
            <DisputeCasePanel
              chainId={chainId}
              arbitrator={request.arbitrator}
              arbitrable={tcrAddress}
              disputeID={facts.disputeID}
              disputeHref={facts.disputeHref}
              disputeHost={facts.disputeHost}
              requesterName={facts.requesterName}
              heading={caseWords?.heading ?? 'In court'}
              awaitingCourt={caseWords?.awaitingCourt ?? true}
              summary={caseWords?.summary}
              ruling={caseWords?.ruling}
              rulingLabel={caseWords?.rulingLabel}
              canAddEvidence={canAddEvidence}
              holdsPageActions={!!facts.inCourt}
              now={now}
            />
          </CaseRegion>
        )}

      <Columns>
        <Main>
          {/* The record of what the court decided, collapsed: no clock, no
              period spine. It keeps the entry's actions, since the status
              card is not rendered while the entry waits on the court. */}
          {decidedDisputes.length > 0 && (
            <DisputeRecordPanel
              chainId={chainId}
              arbitrable={tcrAddress}
              disputes={decidedDisputes}
              canAddEvidence={canAddEvidence}
              holdsPageActions={
                !!facts?.inCourt && caseWords?.awaitingCourt === false
              }
            />
          )}
          {/* Seer markets: what the entry's own fields cannot say, read
              from the market's own contract. A bordered box of its own, so
              it stands in this column rather than inside the hero. */}
          {tcrAddress !== undefined &&
            chainId !== null &&
            isSeerRegistry(tcrAddress, chainId) &&
            typeof decodedData?.[0] === 'string' &&
            typeof decodedData?.[1] === 'string' && (
              <SeerExtraDetails
                chainId={chainId}
                contractAddress={decodedData[0]}
                imagesIpfsHash={decodedData[1]}
              />
            )}
          {/* Spread the `requests` parameter to convert elements from array to an object */}
          <RequestTimelines
            item={item}
            requests={
              item?.requests &&
              item.requests.map((r: TimelineRequest) => ({ ...r }))
            }
            metaEvidence={metaEvidence}
            // The case panel carries the case link while one is live.
            caseInHero={
              !!facts?.hasDispute &&
              (facts.inCourt || facts.appealable) &&
              !!facts.disputeID
            }
          />
          {/* The contracts take evidence only while the latest request is
              open; otherwise the section stays, saying when it opens. */}
          {item && !canAddEvidence && (
            <EvidenceClosed
              reason={
                item.status === CONTRACT_STATUS.REGISTERED
                  ? `Opens if someone asks to remove this ${itemName || 'entry'}.`
                  : `Opens if this ${itemName || 'entry'} is submitted again.`
              }
            />
          )}
          <Explainer
            // The old name: readers keep the open state saved under it.
            id="item-light-how-entries-are-judged"
            eyebrow="How this entry is judged"
            heading="A deposit you get back, a bounty for spotting mistakes."
            steps={[
              {
                title: 'Follow the policy, get your deposit back',
                body: `Submitting or removing a ${itemName || 'entry'} takes a deposit. A request that follows the listing policy gets it back in full.`,
              },
              {
                title: 'Spot a mistake, earn a bounty',
                // Jurors only where the arbitrator is Kleros, as the list
                // page's explainer says.
                body: `Challenge a request that breaks the policy during its challenge period. If ${
                  klerosDecides ? 'jurors agree' : 'the arbitrator agrees'
                }, you earn the requester's base deposit and yours comes back.`,
              },
              {
                title: klerosDecides
                  ? 'Kleros jurors decide'
                  : 'The arbitrator decides',
                body: "The side they agree with gets its deposit back plus the other side's, less the arbitration cost.",
              },
            ]}
            footer={<Link to="/guide">Read the guide</Link>}
          />
        </Main>

        {/* While jurors decide the card itself is gone; it still mounts, for
            the phone bar and the dialogs the URL can open. */}
        {showRail ? (
          <Rail ref={railRef} aria-label="Actions">
            {statusCard}
            {/* Appeal funding is only rendered if the item has an appealable dispute. */}
            <CrowdfundingCard
              item={decodedItem}
              timestamp={timestamp}
              appealCost={appealCost}
            />
          </Rail>
        ) : (
          statusCard
        )}
      </Columns>
      <StickyActionBarSpacer />
    </Page>
  )
}

export default ItemDetails
