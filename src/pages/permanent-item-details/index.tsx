import React, { useState, useEffect, useContext, useMemo } from 'react'
import styled from 'styled-components'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ethers, BigNumber } from 'ethers'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import useStickyTop from 'hooks/use-sticky-top'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import useArbitrationCost from 'hooks/arbitration-cost'
import { useEthersProvider } from 'hooks/ethers-adapters'
import { useAttachment } from 'hooks/use-attachment'
import { WalletContext } from 'contexts/wallet-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import {
  PERMANENT_ITEM_DETAILS_QUERY,
  PERMANENT_REGISTRY_QUERY,
} from 'utils/graphql'
import { STALE_TIME } from 'consts'
import { parseIpfs } from 'utils/ipfs-parse'
import { type ItemFile, sanitizeItemFile } from 'utils/item-file-guard'
import { sanitizeMetaEvidence } from 'utils/meta-evidence-guard'
import { capitalizeFirstLetter } from 'utils/string'
import { CONTRACT_STATUS } from 'utils/permanent-item-status'
import { truncateAtWord } from 'utils/truncate-at-word'
import { formatAbsolute, formatDurationLong } from 'utils/time'
import RequestTimelines from 'components/permanent-request-timelines'
import { AddressLink } from 'components/curate/item-stake-address'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ChainChip,
  Label,
  Page,
  SkeletonBlock,
  Surface,
} from 'components/curate/primitives'
import { EntryStatus, stakeEntryStatus } from 'components/curate/entry-status'
import { Explainer } from 'components/curate/explainer'
import { reveal } from 'components/curate/motion/reveal'
import {
  FieldValue,
  hasValue,
  titleField,
  type EntryField,
} from 'components/curate/item-standard-fields'
import { StickyActionBarSpacer } from 'components/curate/item-standard-action-bar'
import ErrorPage from '../error-page'
import {
  ENTRY_LINK_TIP,
  ENTRY_LOAD_FAILED,
  ENTRY_INDEXING_MESSAGE,
  ENTRY_INDEXING_TITLE,
  ENTRY_MISSING_TIP,
  justSubmitted,
  missingEntryPollMs,
} from '../error-page/copy'
import ItemStatusCard from './item-status-card'
import { formatSince } from 'utils/format-since'
import { StakeWindowPanel } from './item-window'
import { ItemSubmissionPanel } from 'components/curate/item-submission-panel'
import SeerExtraDetails from 'components/custom-registries/seer/seer-item-details'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'
import { DisputeCasePanel } from 'components/curate/dispute-case-panel'
import {
  DisputeRecordPanel,
  type DisputeRecord,
} from 'components/curate/dispute-record-panel'
import { PolicySince, policyInForceSince } from './policy-since'
import { multiplierPercent, nativeText, tokenText } from './modals/shell'
import { entrySetting } from './arbitration-setting'
import {
  rulingShort,
  stakeCaseState,
  stakeCourtLink,
  stakeFacts,
  stakeStatusCode,
  toNum,
  type StakeItem,
  type StakeRegistry,
} from './facts'

/*
 * Stake Curate item page, one layout in three states (listed, in its
 * submission or withdrawal period, in court), on the Standard item
 * composition. A top line — where the entry sits, and at its right end the
 * policy it is judged by — then the hero (the one featured panel): the
 * entry named large with its status and a short facts strip, and on the
 * right the page's one clock — the submission period, the withdrawal
 * period, the appeal period, the court period, or the date it settled; then,
 * across the bottom of the same box, the entry's full details — every field
 * it has, with its one picture beside them (round 4: the details were a
 * second box below). While a case is live, one full-width panel holds it:
 * where it stands, its periods, its jury and its actions. Then two columns:
 * the history on the left; on the right the action card, the withdrawal
 * stepper and the appeal funding (a bottom bar on phones). A case the court
 * has already
 * decided is not live: it sits quietly at the top of the left column as a
 * record of what the jurors did, and an entry challenged more than once
 * keeps one record box with a tab per case. Every figure comes from the
 * subgraph, the list contract and the clock.
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
   it stacks, the clock comes straight after the identity.

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

/** How long the list's MetaEvidence file may take before its read fails. */
const META_EVIDENCE_TIMEOUT_MS = 20_000

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
  const [ipfsError, setIpfsError] = useState(false)
  const timestamp = useContext(WalletContext)?.timestamp
  // The actions column stays reachable on short windows (useStickyTop).
  const railRef = useStickyTop(24)
  const [modalOpen, setModalOpen] = useState(false)
  const { graphqlBatcher } = useGraphqlBatcher()
  const now = useNow()
  const openAttachment = useAttachment()
  const nativeCurrency = useNativeCurrency()

  // Opened right after submitting it (submit-item): a missing entry is
  // still being indexed, not absent.
  const location = useLocation()
  const recentlySubmitted = justSubmitted(location.state)
  // Subgraph item entities have id "<itemID>@<listaddress>".
  const compoundId = `${itemID}@${tcrAddress?.toLowerCase()}`
  const query = useQuery({
    queryKey: ['permanentItemDetails', compoundId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: PERMANENT_ITEM_DETAILS_QUERY,
        variables: { id: compoundId },
        chainId: chainId!,
        isPermanent: true,
      }),
    enabled: !!chainId,
    staleTime: STALE_TIME,
    // An entry sent a moment ago can take a while to reach the subgraph:
    // keep looking for a while before settling on "not found".
    refetchInterval: (query) =>
      query.state.status === 'success' && !query.state.data?.item
        ? missingEntryPollMs(query.state.dataUpdateCount, recentlySubmitted)
        : false,
  })

  // Every settings change of the list, for the date of the policy in force.
  // The list page reads the same query, so it is cached when coming from it.
  const settingsQuery = useQuery({
    queryKey: ['permanentRegistry', tcrAddress, chainId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: PERMANENT_REGISTRY_QUERY,
        variables: { lowerCaseTCRAddress: tcrAddress?.toLowerCase() },
        chainId: chainId!,
        isPermanent: true,
      }),
    enabled: !!chainId && !!tcrAddress,
    staleTime: STALE_TIME,
  })
  const listSettings = settingsQuery.data?.registry?.arbitrationSettings as
    | SubgraphArbitrationSetting[]
    | undefined

  const item = useMemo(
    () =>
      (query.isLoading ? undefined : query.data?.item) as StakeItem | undefined,
    [query.isLoading, query.data],
  )

  const registry = useMemo(
    () =>
      (query.isLoading ? undefined : query.data?.item?.registry) as
        | StakeRegistry
        | undefined,
    [query.isLoading, query.data],
  )

  useEffect(() => {
    if (!item || ipfsItemData || ipfsError) return
    fetch(parseIpfs(item.data))
      .then((r) => r.json())
      .then((r) => {
        const file = sanitizeItemFile(r)
        if (!file) throw new Error('The entry file is not an entry')
        return setIpfsItemData(file)
      })
      .catch((err: unknown) => {
        console.error('Could not get ipfs file', err)
        setIpfsError(true)
      })
  }, [item, ipfsItemData, ipfsError])

  // A new submission takes the newest arbitration setting. A challenge, and
  // the policy the entry is judged by, take the one the contract picks for
  // this entry (arbitration-setting.ts): for a while after the governor
  // changes the settings, that is still the previous one.
  const latestSetting = registry?.arbitrationSettings?.[0]
  const chainNow = timestamp?.toNumber()
  const setting = useMemo(() => {
    if (!item || !registry || chainNow === undefined) return undefined
    return entrySetting(listSettings, {
      status: item.status,
      includedAt: toNum(item.includedAt),
      withdrawingAt: toNum(item.withdrawingTimestamp),
      challengedAt: toNum(item.challenges?.[0]?.createdAt),
      cooldown: toNum(registry.arbitrationParamsCooldown),
      now: chainNow,
    })
  }, [item, registry, listSettings, chainNow])
  const settingInForce = setting ?? latestSetting

  const arbitrationCost = useArbitrationCost({
    address: registry?.arbitrator?.id,
    arbitratorExtraData: latestSetting?.arbitratorExtraData,
    library,
  })
  // Until the list's settings load, which one a challenge uses is unknown,
  // so no challenge cost is offered yet.
  const challengeCost = useArbitrationCost({
    address: registry?.arbitrator?.id,
    arbitratorExtraData: settingsQuery.isLoading
      ? undefined
      : settingInForce?.arbitratorExtraData,
    library,
  })

  // The submitter as the contract records it (msg.sender). The subgraph
  // records the transaction's sender, another address when a contract wallet
  // such as a Safe submitted, and only the contract's record can start a
  // withdrawal. The subgraph's value stands in while this loads.
  const submitterQuery = useQuery({
    queryKey: [
      'permanentItemSubmitter',
      chainId,
      registry?.id,
      item?.itemID,
      item?.includedAt,
    ],
    queryFn: async () => {
      const list = new ethers.Contract(registry!.id, _gtcr, library!)
      const record = await list.items(item!.itemID)
      return String(record.submitter).toLowerCase()
    },
    enabled: !!registry?.id && !!library && !!item?.itemID,
    staleTime: STALE_TIME,
  })
  const submitter = submitterQuery.data ?? item?.submitter

  // What the next appeal costs, for the appeal funding card and dialog. It
  // is read again for each new challenge or round, and a failed read is
  // retried, so the dialog never waits on a stale or missing figure.
  const latestChallenge = item?.challenges?.[0]
  const appealCostQuery = useQuery({
    queryKey: [
      'permanentAppealCost',
      chainId,
      registry?.arbitrator?.id,
      latestChallenge?.disputeID,
      latestChallenge?.rounds?.length,
    ],
    queryFn: async (): Promise<BigNumber> => {
      const arbitrator = new ethers.Contract(
        registry!.arbitrator.id,
        _IArbitrator,
        library!,
      )
      return arbitrator.appealCost(
        latestChallenge!.disputeID,
        latestChallenge!.arbitrationSetting.arbitratorExtraData,
      )
    },
    enabled:
      !!registry &&
      !!library &&
      !!latestChallenge &&
      !latestChallenge.disputeOutcome,
    staleTime: STALE_TIME,
  })
  const appealCostFailed =
    appealCostQuery.isError && !appealCostQuery.isFetching

  // The list's MetaEvidence: its title, item name and field names. Whoever
  // governs the list writes it, so it gets the shape the page reads before
  // anything renders it (a title that is an object took the page down). A
  // gateway that errors or hangs, or a file that is not a MetaEvidence with
  // its metadata, is a failed read: retried, then said, with Try again,
  // rather than left loading for ever.
  const metaEvidenceURI = latestSetting?.metaEvidenceURI
  const metaEvidenceQuery = useQuery({
    queryKey: ['permanentMetaEvidence', metaEvidenceURI],
    queryFn: async (): Promise<MetaEvidence> => {
      const controller = new AbortController()
      // Not AbortSignal.timeout: iOS 15 lacks it.
      const timer = setTimeout(
        () => controller.abort(),
        META_EVIDENCE_TIMEOUT_MS,
      )
      try {
        const response = await fetch(parseIpfs(metaEvidenceURI!), {
          signal: controller.signal,
        })
        if (!response.ok)
          throw new Error(`The list metadata answered ${response.status}`)
        const file = sanitizeMetaEvidence(await response.json())
        if (!file?.metadata)
          throw new Error('The list metadata is not a MetaEvidence file')
        return file
      } finally {
        clearTimeout(timer)
      }
    },
    enabled: !!metaEvidenceURI,
    staleTime: Infinity,
  })
  const metaEvidence = metaEvidenceQuery.data
  const metaEvidenceFailed = metaEvidenceQuery.isError && !metaEvidence

  const decodedItem = useMemo(() => {
    if (!item || !metaEvidence?.metadata?.columns || !ipfsItemData)
      return undefined

    const orderDecodedData = (columns: Column[], values: ItemFile['values']) =>
      columns.map((column) => values[column.label] ?? null)

    return {
      ...item, // Spread to convert from array to object.
      errors: [] as string[],
      columns: metaEvidence.metadata.columns,
      decodedData: orderDecodedData(
        metaEvidence.metadata.columns,
        ipfsItemData.values,
      ),
    }
  }, [item, metaEvidence, ipfsItemData])

  const { metadata } = metaEvidence || {}
  const { decodedData, columns } = decodedItem || {}
  const { tcrTitle, itemName } = metadata || {}
  const { symbol: tokenSymbol, decimals: tokenDecimals } = useTokenSymbol(
    registry?.token,
  )

  const statusCode = useMemo(() => {
    if (!item || !timestamp || !registry) return null
    return stakeStatusCode(item, timestamp, registry) ?? null
  }, [item, timestamp, registry])

  const entryStatus = useMemo(
    () => stakeEntryStatus(item, timestamp, registry),
    [item, timestamp, registry],
  )

  const fields = useMemo<EntryField[]>(
    () =>
      columns
        ? columns.map((column, index) => ({
            ...column,
            value: decodedData?.[index],
          }))
        : [],
    [columns, decodedData],
  )
  const primaryField = useMemo(() => titleField(fields), [fields])

  // The tab names the entry itself (its heading), then its list.
  const seoName =
    primaryField && hasValue(primaryField)
      ? String(primaryField.value)
      : capitalizeFirstLetter(itemName ?? '') || 'Entry'
  const fullSeoTitle =
    decodedItem && metadata
      ? `${seoName} · ${tcrTitle} | Kleros Curate`
      : 'Kleros Curate'
  const truncatedSeoTitle = truncateAtWord(fullSeoTitle, 160)

  // The status as the page labels it, as on Standard entries. Accepted only
  // means nobody challenged it in time, and it stays challengeable: the
  // description claims no verification.
  const fullSeoMetaDescription =
    decodedItem && metadata && entryStatus && decodedData
      ? `${decodedData.join(' ')} · ${entryStatus.label} on ${
          metadata.tcrTitle
        } in Kleros Curate`
      : 'View item details on Kleros Curate.'
  const truncatedSeoMetaDescription = truncateAtWord(
    fullSeoMetaDescription,
    160,
  )

  const loading =
    !metadata ||
    (!decodedData && decodedItem && decodedItem.errors.length === 0)
  // The subgraph item is here but its fields cannot be decoded: the IPFS
  // file failed to load, or the list's metadata declares no columns.
  const fieldsUnavailable = Boolean(
    item && metadata && !decodedItem && (ipfsError || !metadata.columns),
  )

  // Check if there is some action on the URL and, if so, run it.
  useEffect(() => {
    if (loading) return

    const params = new URLSearchParams(search)
    if (!params.get('action')) return

    setModalOpen(true)
  }, [loading, search])

  const loadFailed = query.isError && !query.data
  const missing = query.isSuccess && !query.data?.item
  // An error page sets its own title, and keeps a missing entry out of
  // search results: this page's head would overwrite both (its effects run
  // after the error page's), so it waits for an entry to describe.
  const errorPage = !tcrAddress || !itemID || loadFailed || missing
  useDocumentHead(
    errorPage ? undefined : truncatedSeoTitle,
    errorPage ? undefined : truncatedSeoMetaDescription,
  )
  const registryHref = `/tcr/${chainId}/${tcrAddress}`

  if (!tcrAddress || !itemID)
    return (
      <ErrorPage
        code="400"
        message="This entry could not be found."
        tip={ENTRY_LINK_TIP}
      />
    )

  // A failed read and a missing entry each get their own page; neither is
  // left as a loading skeleton. Each leads back to the list.
  if (loadFailed)
    return (
      <ErrorPage
        code="Error"
        title="This entry did not load"
        message={ENTRY_LOAD_FAILED}
        onRetry={() => query.refetch()}
        home={{ to: registryHref, label: 'Back to the list' }}
      />
    )

  if (missing && recentlySubmitted)
    return (
      <ErrorPage
        code="Indexing"
        tone="window"
        title={ENTRY_INDEXING_TITLE}
        message={ENTRY_INDEXING_MESSAGE}
        home={{ to: registryHref, label: 'Back to the list' }}
      />
    )

  if (missing)
    return (
      <ErrorPage
        code="404"
        title="Entry not found"
        message="This list has no entry with this ID."
        tip={ENTRY_MISSING_TIP}
        home={{ to: registryHref, label: 'Back to the list' }}
      />
    )

  const name = itemName || 'item'
  const Name = capitalizeFirstLetter(name)
  // Without the list's file there are no fields to title the entry with:
  // the list's item name as the subgraph keeps it stands in, else "Entry".
  const heading = metaEvidenceFailed
    ? capitalizeFirstLetter(latestSetting?.metadata?.itemName ?? '') || 'Entry'
    : Name
  const policyURI =
    settingInForce?.metadata?.policyURI ?? latestSetting?.metadata?.policyURI
  // When that policy took effect: settings newer than the one in force for
  // this entry do not apply to it yet.
  const policySince = policyInForceSince(
    setting && listSettings
      ? listSettings.filter(
          (other) => toNum(other.timestamp) <= toNum(setting.timestamp),
        )
      : listSettings,
  )
  const titleText =
    primaryField && hasValue(primaryField)
      ? String(primaryField.value)
      : heading

  const facts =
    item && registry && statusCode !== null
      ? stakeFacts({ item, registry, statusCode, chainId })
      : undefined
  const challenge = facts?.challenge
  const challengeInSubmission =
    !!facts &&
    !!challenge?.challenger &&
    facts.hasDispute &&
    toNum(challenge.createdAt) >= facts.submissionStart
  // Where the case stands in the page's own words, for the case panel: the
  // court names the period, the page knows what it means for this entry.
  const caseWords =
    facts && statusCode !== null
      ? stakeCaseState(facts, statusCode, now)
      : undefined
  // The contract takes evidence on any entry that is not Absent, as the
  // history's composer does.
  const canAddEvidence = !!item && item.status !== CONTRACT_STATUS.ABSENT
  /*
   * The cases the court has already decided, newest first as the history
   * numbers them. An entry here can be challenged again and again, so
   * several are literally possible. An appeal being funded is not over —
   * money is being raised and the rail's funding card is live — so only a
   * challenge whose ruling already stands, or one long settled, is a
   * record.
   *
   * Every challenge is a case, so there is no case number to test: the
   * arbitrator numbers its first dispute 0, and that case is as real as
   * any other.
   */
  const decidedDisputes: DisputeRecord[] = (item?.challenges ?? [])
    .filter(
      (past, index) =>
        toNum(past.resolutionTime) > 0 ||
        (index === 0 && caseWords?.awaitingCourt === false),
    )
    .map((past) => {
      const court = stakeCourtLink(
        chainId,
        registry?.arbitrator?.id,
        past.disputeID,
      )
      const round = past.rounds?.[0]
      const settled = toNum(past.resolutionTime) > 0
      return {
        disputeID: String(past.disputeID),
        arbitrator: registry?.arbitrator?.id,
        requesterName: 'submitter',
        // Once settled the outcome can differ from the jurors' last
        // ruling: a side that alone funded the last appeal wins. Until
        // then the challenge still records 'None', which would read as
        // "Refused to rule", so the ruling is the jurors' own and only
        // once the court has given one — as stakeCaseState reads it, so
        // the hero and the record never disagree about the same case.
        ruling: settled
          ? rulingShort(past.disputeOutcome ?? round?.ruling)
          : toNum(round?.rulingTime) > 0
            ? rulingShort(round?.ruling)
            : undefined,
        href: court?.href,
        host: court?.host,
      }
    })

  // Why the fields cannot be read, said in the full-details panel itself:
  // one region holds the entry's fields, whether or not they came through.
  const submissionErrors = metaEvidenceFailed
    ? ["The list's field names could not be loaded from IPFS."]
    : fieldsUnavailable
      ? [
          ipfsError
            ? `The ${name}'s data could not be loaded from IPFS.`
            : `This list's metadata declares no fields, so the ${name} cannot be displayed.`,
        ]
      : (decodedItem?.errors ?? [])

  const minStake = registry?.submissionMinDeposit
  const explainerSteps = [
    {
      title: 'A stake backs every entry',
      body: registry
        ? `At least ${tokenText(minStake ?? 0, tokenDecimals, tokenSymbol)} in the list's token${
            arbitrationCost.arbitrationCost
              ? ` plus ${nativeText(arbitrationCost.arbitrationCost, nativeCurrency)} for arbitration`
              : ' plus an arbitration deposit'
          }. It backs the ${name} while listed and comes back when the submitter withdraws.`
        : `A token stake and an arbitration deposit back the ${name} while listed, and come back when the submitter withdraws.`,
    },
    {
      title: 'Spot a mistake, earn the stake',
      body: registry
        ? `Challenge a ${name} that breaks the policy, at any time, with ${multiplierPercent(registry.challengeStakeMultiplier)} of its stake plus the arbitration cost. If jurors agree, you take its stake and arbitration deposit and your stake comes back; if not, your stake is added to the ${name}'s. ${
            toNum(registry.submissionPeriod) > 0
              ? `Pending for ${formatDurationLong(toNum(registry.submissionPeriod))}, then accepted.`
              : `Accepted at once: this list has no submission period.`
          }`
        : `Challenge a ${name} that breaks the policy, at any time, with a share of its stake. If jurors agree, you take its stake and your stake comes back; if not, your stake is added to the ${name}'s.`,
    },
    {
      title: 'Withdraw to get the stake back',
      body: registry
        ? `The submitter starts a withdrawal${
            toNum(registry.withdrawingPeriod) > 0
              ? `, waits ${formatDurationLong(toNum(registry.withdrawingPeriod))}`
              : ''
          }, then anyone executes it. Still challengeable while withdrawing.`
        : `The submitter starts a withdrawal, waits the withdrawing period, then anyone executes it.`,
    },
  ]

  return (
    <Page>
      <TopRow>
        <Crumbs aria-label="Breadcrumb">
          <Link to={registryHref}>
            <CurateIcon name="registry" size={14} />
            {tcrTitle || 'Registry'}
          </Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{Name}</span>
        </Crumbs>
        {/* Outside the breadcrumb: the policy is what the entry is judged
            by, not a place on the way to it. */}
        {policyURI && (
          <PolicyButton
            type="button"
            onClick={() => openAttachment(parseIpfs(policyURI), true)}
          >
            <CurateIcon name="policy" size={14} />
            Listing policy
            <PolicySince
              since={policySince}
              loading={settingsQuery.isLoading}
              now={now}
            />
          </PolicyButton>
        )}
      </TopRow>

      <Hero
        as="section"
        $featured
        $padding="none"
        aria-label={`${Name} overview`}
        style={{ ['--i' as string]: 1 }}
      >
        <HeroMain>
          <Eyebrow>
            <Label $tone="faint">
              {metadata ? Name : 'Stake Curate entry'}
            </Label>
            {chainId && <ChainChip chainId={chainId} size="sm" />}
          </Eyebrow>
          {loading && !fieldsUnavailable && !metaEvidenceFailed ? (
            <SkeletonBlock $height="40px" $width="min(420px, 100%)" />
          ) : (
            <Title $size={titleSize(titleText)}>
              {primaryField ? (
                <FieldValue field={primaryField} detailed />
              ) : (
                heading
              )}
            </Title>
          )}
          <StatusRow>
            {entryStatus ? (
              // The ring beside it already draws whatever window is
              // running, so the chip keeps its dot, its label and the
              // countdown, and leaves the track to the ring.
              <EntryStatus
                status={{ ...entryStatus, windowStart: undefined }}
                now={now}
              />
            ) : (
              <SkeletonBlock $height="18px" $width="220px" />
            )}
          </StatusRow>
        </HeroMain>
        <HeroSide>
          {item && facts && statusCode !== null ? (
            <StakeWindowPanel
              facts={facts}
              statusCode={statusCode}
              arbitrator={registry?.arbitrator?.id}
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
          {item && facts ? (
            <Stats>
              <div>
                <Label as="dt" $tone="faint">
                  {facts.reincluded ? 'Reincluded' : 'Submitted'}
                </Label>
                <dd
                  title={
                    facts.includedAt
                      ? formatAbsolute(facts.includedAt)
                      : undefined
                  }
                >
                  {facts.includedAt ? formatSince(facts.includedAt, now) : '—'}
                </dd>
              </div>
              {submitter && (
                <div>
                  <Label as="dt" $tone="faint">
                    By
                  </Label>
                  <dd>
                    <AddressLink address={submitter} />
                  </dd>
                </div>
              )}
              {challengeInSubmission && challenge && (
                <div>
                  <Label as="dt" $tone="faint">
                    Challenged by
                  </Label>
                  <dd>
                    <AddressLink address={challenge.challenger} />
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
            item={decodedItem ?? item}
            itemID={item?.itemID}
            errors={submissionErrors}
            loading={
              Boolean(loading) && !fieldsUnavailable && !metaEvidenceFailed
            }
            retry={
              metaEvidenceFailed ? (
                <Button
                  type="button"
                  $variant="secondary"
                  $size="sm"
                  disabled={metaEvidenceQuery.isFetching}
                  onClick={() => void metaEvidenceQuery.refetch()}
                >
                  {metaEvidenceQuery.isFetching ? 'Loading…' : 'Try again'}
                </Button>
              ) : undefined
            }
            kind="stake"
          />
        </HeroFields>
      </Hero>

      {/* One region for a live case: where it stands, its periods, its jury
          and its actions (the design review's point 6.2). Only while the
          court is still deciding or an appeal is being funded — once the
          ruling stands, the record box below says so instead. */}
      {facts?.hasDispute &&
        facts.underDispute &&
        (caseWords?.awaitingCourt ?? true) && (
          <CaseRegion style={{ ['--i' as string]: 2 }}>
            <DisputeCasePanel
              chainId={chainId}
              arbitrator={registry?.arbitrator?.id}
              arbitrable={tcrAddress}
              disputeID={facts.disputeID}
              disputeHref={facts.courtHref}
              disputeHost={facts.courtHost}
              requesterName="submitter"
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
          <RequestTimelines item={item} metaEvidence={metaEvidence} />
          <Explainer
            id="stake-curate-item"
            eyebrow="How this list works"
            heading="A stake backs every entry. Spot a bad one and it is yours."
            steps={explainerSteps}
          />
        </Main>

        <Rail ref={railRef} aria-label="Actions">
          <ItemStatusCard
            item={decodedItem ?? item}
            registry={registry}
            timestamp={timestamp}
            modalOpen={modalOpen}
            metaEvidence={metaEvidence}
            setModalOpen={setModalOpen}
            appealCost={appealCostQuery.data}
            appealCostFailed={appealCostFailed}
            onRetryAppealCost={() => void appealCostQuery.refetch()}
            arbitrationCost={arbitrationCost.arbitrationCost}
            challengeArbitrationCost={challengeCost.arbitrationCost}
            submitter={submitter}
            policyURI={policyURI}
          />
        </Rail>
      </Columns>
      <StickyActionBarSpacer aria-hidden />
    </Page>
  )
}

export default ItemDetails
