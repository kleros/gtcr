import React, { useState, useEffect, useContext, useMemo } from 'react'
import { ethers, type BigNumber } from 'ethers'
import styled from 'styled-components'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import { useWeb3Context } from 'hooks/use-web3-context'
import useNativeCurrency from 'hooks/native-currency'
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
  STATUS_CODE,
  hasPendingRequest,
  itemToStatusCode,
} from 'utils/item-status'
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
  FieldValue,
  hasValue,
  titleField,
  type EntryField,
} from 'components/curate/item-standard-fields'
import { StickyActionBarSpacer } from 'components/curate/item-standard-action-bar'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { ItemSubmissionPanel } from 'components/curate/item-submission-panel'
import { HeroFacts } from 'components/curate/item-hero-facts'
import {
  HERO_PICTURE_MARK,
  ImagePlate,
  heroPicture,
  useHeroPictureSide,
} from 'components/curate/item-media-band'
import {
  formatAmount,
  formatEther,
  groupThousands,
} from 'components/curate/item-standard-format'
import SeerExtraDetails from 'components/custom-registries/seer/seer-item-details'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'
import { DisputeCasePanel } from 'components/curate/dispute-case-panel'
import {
  DisputeRecordPanel,
  type DisputeRecord,
} from 'components/curate/dispute-record-panel'
import { AppealWindowPanel } from 'pages/standard-item-details/appeal-funding'
import { Notice } from 'components/curate/item-standard-notice'
import { partyAppealNotice } from './party-notice'
import {
  caseState,
  courtLink,
  fundedAlone,
  requestFacts,
  rulingShort,
  type StandardRequest,
} from './request-facts'
import { linkedListAddress, linkedListField } from './linked-list'
import { rulingChoiceOf } from 'utils/ruling-titles'

/*
 * Standard Curate item page, one layout in three states (settled, in its
 * challenge window, in court). A top line — where the entry sits, and at
 * its right end the policy it is judged by — then the hero (the one
 * featured panel), in two columns. On the left, one flow: the entry named
 * large with its status, the facts strip (when, by whom, the item ID), and
 * straight under it the entry's full details — every field it has (round 4:
 * the details were a second box below). On the right, the page's one clock
 * — the challenge window, the appeal period, the court period, or the date
 * it settled — then the one thing to do now, with its amount and its
 * button, and then the entry's picture when it has exactly one and the left
 * column runs on beside it (otherwise the picture opens the full details,
 * so neither column ends far above the other). While a case is live, one
 * full-width panel holds it: where it stands, its periods, its jury and its
 * actions. Then the history, across the page, with the appeal funding
 * beside it while an appeal is open. At 1000px and below the fixed bottom
 * bar carries the action. A case the court has already decided is not
 * live: it sits quietly at the top of the history column as a record of
 * what the jurors did. Every figure comes from the subgraph, the list
 * contract and the clock.
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

/* Two independent columns (round 5 of the design review). The left is one
   flow: identity, facts strip, full details, each straight under the last.
   The right is the clock and the action under it. They share no rows, so
   however tall the clock and the action stand, they can no longer push
   empty space under the facts strip: in round 4 a grid row shared with the
   clock opened a 114px band there, and its hairlines drew a box round the
   clock. The right column draws no line of its own.

   The entry's one picture goes where it leaves the least empty glass
   (useHeroPictureSide): under the action beside a long field list, or
   first in the full details beside a tall action card. Fixed under the
   clock, it left a block of empty glass about 870px wide and 284px tall at
   the bottom-left of a decided entry with two fields.

   The action sits under the clock so the thing to do, with its amount, is
   on the first screen at 1440x900 in every state (round 4's full details
   had pushed the card in the rail below the fold). The right column scrolls
   with the hero (round 7); past it, the bottom bar carries the action.

   At 1000px and below both columns dissolve (display: contents) and one
   order sets the sequence: identity, clock, facts, picture, full details,
   then the action, so the time pressure is near the top and the picture
   leads the details it belongs to. The fixed bottom bar carries the action
   there until the hero's own copy of it scrolls into view. */
const Hero = styled(Surface)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  align-items: start;
  margin-top: 20px;
  ${reveal}

  @media (max-width: 1000px) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
`

const HeroLeft = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  @media (max-width: 1000px) {
    display: contents;
  }
`

/* Its 32px top padding is HeroMain's, so the clock's label lines up with
   the eyebrow. 24px at the sides leaves the action its 312px measure, the
   width it had as a card in the rail. It scrolls with the hero (round 7:
   the sticky column read as floating); once the action is off screen the
   bottom bar carries it (item-standard-action-bar.tsx). */
const HeroAside = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
  padding: 32px 24px 28px;

  @media (max-width: 1000px) {
    display: contents;
  }
`

const HeroMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 32px 36px 20px;

  @media (max-width: 1000px) {
    order: 1;
  }

  @media (max-width: 720px) {
    padding: 22px 18px 18px;
  }
`

const HeroStats = styled.div`
  min-width: 0;
  padding: 0 36px 20px;

  @media (max-width: 1000px) {
    order: 3;
    padding-top: 4px;
  }

  @media (max-width: 720px) {
    padding: 4px 18px 20px;
  }
`

const HeroSide = styled.div`
  min-width: 0;

  @media (max-width: 1000px) {
    order: 2;
    padding: 4px 36px 24px;
  }

  @media (max-width: 720px) {
    padding: 4px 18px 20px;
  }
`

/* The entry's one picture, under the clock and the action, when it leaves
   less empty glass here than first in the full details. Stacked, its order
   puts it between the facts and the full details wherever the wide layout
   placed it. */
const HeroPicture = styled.div`
  min-width: 0;

  @media (max-width: 1000px) {
    order: 4;
    padding: 0 36px 24px;
  }

  @media (max-width: 720px) {
    padding: 0 18px 20px;
  }
`

/* The entry's own fields, every one of them, straight under the facts
   strip. It draws its own inset hairline the way the facts strip does —
   not a panel, so nothing is stacked inside the one featured box. */
const HeroFields = styled.div`
  min-width: 0;
  padding: 0 36px 28px;

  @media (max-width: 1000px) {
    order: 5;
  }

  @media (max-width: 720px) {
    padding: 0 18px 22px;
  }
`

/* Where the action card renders itself (ItemStatusCard portals into it),
   bare, as part of the hero rather than a panel inside it. Empty while
   there is nothing to do (in court, the case panel holds the actions), and
   then it takes no room. Stacked, it closes the hero under an inset
   hairline, after the full details. */
const HeroAction = styled.div`
  min-width: 0;

  &:empty {
    display: none;
  }

  @media (max-width: 1000px) {
    order: 6;
    margin: 0 36px 28px;
    padding-top: 24px;
    border-top: 1px solid var(--glass-border);
  }

  @media (max-width: 720px) {
    margin: 0 18px 22px;
    padding-top: 20px;
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

/* A party's word during an appeal, under the status line (party-notice.ts). */
const PartyNoticeRow = styled.div`
  max-width: 560px;
  margin-top: 12px;
`

/* Full width under the hero: a live case is one region of the page, never
   a card in the rail. */
const CaseRegion = styled.div`
  margin-top: 24px;
  ${reveal}
`

/* The history across the page, with a right-hand rail only while it holds
   something: the appeal funding while an appeal is open. The action card is
   in the hero now, so a rail kept in every state stood empty beside the
   history and the evidence composer (round 4's in-court page left an empty
   360px track ~830px down the page). A flex row, so an empty rail
   (:empty, display none) takes no room and the history widens. */
const Columns = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-top: 24px;

  @media (max-width: 1000px) {
    flex-direction: column;
    align-items: stretch;
  }
`

const Main = styled.div`
  display: flex;
  flex: 1 1 0;
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

/* Beside the history; it scrolls with the page (round 7: nothing on the
   right of an entry floats). */
const Rail = styled.aside`
  align-self: flex-start;
  display: flex;
  flex: 0 0 360px;
  flex-direction: column;
  gap: 16px;
  min-width: 0;

  &:empty {
    display: none;
  }

  > * {
    ${reveal}
    --i: 2;
  }

  @media (max-width: 1000px) {
    position: static;
    flex: none;
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
      <PolicyUpdatedBadge registryAddress={tcrAddress} kind="standard" />
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
  // The hero's slot for the action card, which renders itself into it.
  const [actionSlot, setActionSlot] = useState<HTMLDivElement | null>(null)
  const nativeCurrency = useNativeCurrency()
  const [modalOpen, setModalOpen] = useState<boolean | undefined>()
  const tcrViewContext = useContext(StandardTCRViewContext)
  const tcrError = tcrViewContext?.tcrError
  const metaEvidence = tcrViewContext?.metaEvidence
  const challengePeriodDuration = tcrViewContext?.challengePeriodDuration
  const now = useNow()
  const { account } = useWeb3Context()

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
  // The entry's one picture; none when it has none, or several (those stay
  // in the full details' band). It goes where it leaves the least empty
  // glass in the hero: under the clock, or first in the full details.
  const picture = useMemo(() => heroPicture(fields), [fields])
  const [heroLeft, setHeroLeft] = useState<HTMLDivElement | null>(null)
  const [heroAside, setHeroAside] = useState<HTMLDivElement | null>(null)
  const pictureSide = useHeroPictureSide(heroLeft, heroAside, !!picture)
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
  // What the connected wallet, if it is a party, has to do in an appeal.
  const partyNotice = partyAppealNotice({ account, request, facts, statusCode })
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
    .map((past, index) => {
      const requesterName =
        past.requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
          ? 'submitter'
          : 'requester'
      const court = courtLink(chainId, past.arbitrator, past.disputeID)
      // The appeal period over with one side alone funded: rule() gives
      // that side the case whatever the jurors ruled, as the hero says.
      const alone =
        index === 0 &&
        !past.resolved &&
        statusCode === STATUS_CODE.WAITING_ARBITRATOR
          ? fundedAlone(past, requesterName)
          : undefined
      const decided = past.resolved
        ? (past.disputeOutcome ?? past.rounds?.[0]?.ruling)
        : past.rounds?.[0]?.ruling
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
        ruling: alone
          ? `For the ${alone}`
          : rulingShort(decided, requesterName),
        // In the court's words only while it is the jurors' own ruling: an
        // outcome the list decided (one side funded alone) is not.
        rulingChoice:
          !alone && decided === past.rounds?.[0]?.ruling
            ? rulingChoiceOf(decided)
            : undefined,
        metaEvidenceURI: past.metaEvidence?.uri,
        href: court?.href,
        host: court?.host,
      }
    })
  // The record holds the latest request's own case (its ruling stands, or
  // it was resolved): the action card then states neither the ruling nor
  // the case, which the record right under the hero already does.
  const latestCaseInRecord =
    !!request?.disputed &&
    (!!request.resolved || caseWords?.awaitingCourt === false)
  // While a case is live, what it is over: the requester's base deposit,
  // which a challenger the jurors agree with takes (DESIGN.md's bounty). The
  // action card that leads with it in the window is not drawn in court.
  const caseBounty =
    request &&
    facts?.hasDispute &&
    (facts.inCourt || facts.appealable) &&
    !request.resolved &&
    request.deposit !== undefined &&
    !ethers.BigNumber.from(request.deposit).isZero()
      ? {
          figure: groupThousands(formatEther(request.deposit)),
          symbol: nativeCurrency,
          // Only Kleros has jurors to name; the request's own arbitrator
          // decides it, as the action card says.
          title: `${formatAmount(request.deposit, nativeCurrency)}: what the challenger takes if ${
            isKlerosArbitrator(chainId, request.arbitrator)
              ? 'jurors agree'
              : 'the arbitrator agrees'
          } with them, on top of their own deposit back`,
        }
      : undefined
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
            {tcrTitle || 'List'}
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
        // The floating action bar waits for the reader to reach its end.
        data-entry-hero
        $featured
        $padding="none"
        aria-label={`${entryName} overview`}
        style={{ ['--i' as string]: 1 }}
      >
        <HeroLeft ref={setHeroLeft}>
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
            {partyNotice && (
              <PartyNoticeRow>
                <Notice tone={partyNotice.tone} role="status">
                  {partyNotice.text}
                </Notice>
              </PartyNoticeRow>
            )}
          </HeroMain>
          <HeroStats>
            {request && facts ? (
              <HeroFacts
                when={{
                  label: facts.isRegistration
                    ? 'Submitted'
                    : 'Removal requested',
                  at: facts.submissionTime,
                }}
                bounty={caseBounty}
                by={request.requester}
                challengedBy={facts.hasDispute ? request.challenger : undefined}
                itemID={item?.itemID}
                now={now}
              />
            ) : (
              <SkeletonBlock $height="44px" />
            )}
          </HeroStats>
          <HeroFields>
            <ItemSubmissionPanel
              fields={fields}
              item={decodedItem}
              errors={decodedItem?.errors}
              loading={loading}
              linkedRegistry={itemMetaEvidence}
              registryAddress={itemAddress}
              kind="standard"
              leadsWithPicture={pictureSide === 'details'}
            />
          </HeroFields>
        </HeroLeft>
        <HeroAside ref={setHeroAside}>
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
          <HeroAction ref={setActionSlot} />
          {picture && pictureSide === 'aside' && (
            <HeroPicture {...HERO_PICTURE_MARK}>
              <ImagePlate image={picture} layout="rail" />
            </HeroPicture>
          )}
        </HeroAside>
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
              rulingChoice={caseWords?.rulingChoice}
              rulingLabel={caseWords?.rulingLabel}
              metaEvidenceURI={request.metaEvidence?.uri}
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

        {/* Only rendered while the item has an appealable dispute; with
            nothing in it the rail takes no room. */}
        <Rail aria-label="Appeal funding">
          <CrowdfundingCard
            item={decodedItem}
            timestamp={timestamp}
            appealCost={appealCost}
          />
        </Rail>
      </Columns>
      {/* The action card draws itself in the hero, under the clock (a
          portal into HeroAction); mounted here it keeps the phone bar and
          the dialogs the URL can open out of the hero's layout. While
          jurors decide it draws no card at all. */}
      <ItemStatusCard
        item={decodedItem}
        timestamp={timestamp}
        request={item?.requests && { ...item.requests[0] }}
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        appealCost={appealCost}
        appealCostFailed={appealCostFailed}
        retryAppealCost={() => void appealCostQuery.refetch()}
        caseInRecord={latestCaseInRecord}
        heroSlot={actionSlot}
      />
      <StickyActionBarSpacer />
    </Page>
  )
}

export default ItemDetails
