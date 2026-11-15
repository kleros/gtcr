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
import { inkPlate, PlatedImg } from 'components/curate/logo-ink'
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
import { ipfsImageUrl, parseIpfs } from 'utils/ipfs-parse'
import { type ItemFile, sanitizeItemFile } from 'utils/item-file-guard'
import { sanitizeMetaEvidence } from 'utils/meta-evidence-guard'
import { capitalizeFirstLetter } from 'utils/string'
import { truncateAtWord } from 'utils/truncate-at-word'
import { formatAbsolute, formatDurationLong } from 'utils/time'
import ItemDetailsCard from 'components/item-details-card'
import RequestTimelines from 'components/permanent-request-timelines'
import { AddressLink } from 'components/curate/item-stake-address'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ChainChip,
  Label,
  Page,
  Row,
  SkeletonBlock,
  Stack,
  Surface,
} from 'components/curate/primitives'
import { Notice } from 'components/curate/item-light-notice'
import { EntryStatus, stakeEntryStatus } from 'components/curate/entry-status'
import { Explainer } from 'components/curate/explainer'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { reveal } from 'components/curate/motion/reveal'
import {
  FieldValue,
  hasValue,
  identifierFields,
  isImageField,
  titleField,
  type EntryField,
} from 'components/curate/item-light-fields'
import { StickyActionBarSpacer } from 'components/curate/item-light-action-bar'
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
import { formatSince } from 'pages/item-details/format-since'
import { StakeWindowPanel } from './item-window'
import { PolicySince, policyInForceSince } from './policy-since'
import { multiplierPercent, nativeText, tokenText } from './modals/shell'
import { entrySetting } from './arbitration-setting'
import {
  stakeFacts,
  stakeStatusCode,
  toNum,
  type StakeItem,
  type StakeRegistry,
} from './facts'

/*
 * Stake Curate item page, on the Light item composition. A breadcrumb, then
 * the hero (the one featured panel): the entry's identifiers set large with
 * its status, and on the right whatever clock is running (submission
 * period, withdrawal period, appeal period, the court case, or the date it
 * settled). Under it, two columns: the fields and the history on the left;
 * on the right the action card led by the stake at risk, the withdrawal
 * stepper and the appeal funding (a bottom bar on phones). Every figure
 * comes from the subgraph, the list contract and the clock.
 */

const Crumbs = styled.nav`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  ${reveal}

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

/* Desktop: identity and stats on the left, the clock on the right. When it
   stacks, the clock comes straight after the identity. */
const Hero = styled(Surface)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  grid-template-rows: 1fr auto;
  grid-template-areas:
    'main side'
    'stats side';
  margin-top: 20px;
  ${reveal}

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    grid-template-areas:
      'main'
      'side'
      'stats';
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

const Eyebrow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
`

const Identity = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 18px;
  min-width: 0;
`

/* The entry's picture, on its own tile; a plate when its ink is lost. */
const Logo = styled(PlatedImg)`
  flex: 0 0 auto;
  width: 64px;
  height: 64px;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  background: var(--color-raised);
  object-fit: contain;
  ${inkPlate}

  @media (max-width: 720px) {
    width: 48px;
    height: 48px;
    border-radius: 12px;
  }
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

const KeyRow = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin: 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    max-width: 100%;
  }

  dt {
    color: var(--color-faint);
    font-size: 12px;
    line-height: 16px;
  }

  dd {
    margin: 0;
    min-width: 0;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    overflow-wrap: anywhere;
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

const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
  align-items: start;
  margin-top: 24px;

  @media (max-width: 1100px) {
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

  @media (max-width: 1100px) {
    position: static;
    order: -1;
  }
`

/* The Fields card's title, set as the card sets it. */
const FieldsTitle = styled.h2`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.02em;
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

/** A logo or picture among the fields, shown next to the title. */
const logoOf = (fields: EntryField[]): string | undefined => {
  const image = fields.find((field) => isImageField(field) && hasValue(field))
  if (!image) return undefined
  // On the IPFS gateway only (ipfsImageUrl says why).
  return ipfsImageUrl(image.value)
}

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
  const otherIdentifiers = useMemo(
    () => identifierFields(fields).filter((field) => field !== primaryField),
    [fields, primaryField],
  )

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

  // The status as the page labels it, as on Light entries. Accepted only
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
  const logo = logoOf(fields)
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
  const evidenceCount = facts
    ? (item?.evidences ?? []).filter(
        (evidence) => toNum(evidence.timestamp) >= facts.submissionStart,
      ).length
    : 0

  // The fields card shows why the fields cannot be read.
  const cardItem = fieldsUnavailable
    ? {
        ...(item as StakeItem),
        errors: [
          ipfsError
            ? `The ${name}'s data could not be loaded from IPFS.`
            : `This list's metadata declares no fields, so the ${name} cannot be displayed.`,
        ],
      }
    : decodedItem

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
      <Crumbs aria-label="Breadcrumb">
        <Link to={registryHref}>
          <CurateIcon name="registry" size={14} />
          {tcrTitle || 'Registry'}
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{Name}</span>
      </Crumbs>

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
          <Identity>
            {logo && <Logo src={logo} alt="" />}
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
          </Identity>
          {otherIdentifiers.length > 0 && (
            <KeyRow>
              {otherIdentifiers.map((field, index) => (
                <div key={`${field.label}-${index}`}>
                  <dt>{field.label}</dt>
                  <dd>
                    <FieldValue field={field} />
                  </dd>
                </div>
              ))}
            </KeyRow>
          )}
          <StatusRow>
            {entryStatus ? (
              <EntryStatus status={entryStatus} now={now} />
            ) : (
              <SkeletonBlock $height="18px" $width="220px" />
            )}
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
          </StatusRow>
        </HeroMain>
        <HeroSide>
          {item && facts && statusCode !== null ? (
            <StakeWindowPanel
              item={item}
              facts={facts}
              statusCode={statusCode}
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
              {/* While jurors decide the court panel leads with the same count. */}
              {!facts.inCourt && (
                <div>
                  <Label as="dt" $tone="faint">
                    Evidence
                  </Label>
                  <dd>
                    <AnimatedNumber value={evidenceCount} />
                  </dd>
                </div>
              )}
              <div>
                <Label as="dt" $tone="faint">
                  Submissions
                </Label>
                <dd>
                  {item.submissions ? (
                    <AnimatedNumber value={item.submissions.length} />
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </Stats>
          ) : (
            <SkeletonBlock $height="44px" />
          )}
        </HeroStats>
      </Hero>

      <Columns>
        <Main>
          {metaEvidenceFailed ? (
            // The card's own notice, with a way to read the file again.
            <Surface id="item-details-card" $padding="standard">
              <Stack $gap={10}>
                <FieldsTitle>Fields</FieldsTitle>
                <Notice tone="contested" role="alert">
                  The list&apos;s field names could not be loaded from IPFS.
                </Notice>
                <Row>
                  <Button
                    type="button"
                    $variant="secondary"
                    $size="sm"
                    disabled={metaEvidenceQuery.isFetching}
                    onClick={() => void metaEvidenceQuery.refetch()}
                  >
                    {metaEvidenceQuery.isFetching ? 'Loading…' : 'Try again'}
                  </Button>
                </Row>
              </Stack>
            </Surface>
          ) : (
            <ItemDetailsCard
              columns={columns ?? metadata?.columns}
              item={cardItem}
              title="Fields"
              loading={Boolean(loading) && !fieldsUnavailable}
              kind="stake"
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
