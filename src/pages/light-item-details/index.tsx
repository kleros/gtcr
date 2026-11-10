import React, { useState, useEffect, useContext, useMemo } from 'react'
import { ethers, type BigNumber } from 'ethers'
import { ItemTypes } from '@kleros/gtcr-encoder'
import styled from 'styled-components'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useTcrMetaEvidence from 'hooks/use-tcr-meta-evidence'
import { useAttachment } from 'hooks/use-attachment'
import ErrorPage from '../error-page'
import ItemDetailsCard from 'components/item-details-card'
import RequestTimelines, {
  type TimelineRequest,
} from 'components/request-timelines'
import PolicyUpdatedBadge from 'components/policy-updated-badge'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import { WalletContext } from 'contexts/wallet-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { capitalizeFirstLetter } from 'utils/string'
import { LIGHT_ITEM_DETAILS_QUERY } from 'utils/graphql'
import {
  CONTRACT_STATUS,
  hasPendingRequest,
  itemToStatusCode,
} from 'utils/item-status'
import { formatAbsolute } from 'utils/time'
import { formatSince } from 'pages/item-details/format-since'
import { STALE_TIME } from 'consts'
import { parseIpfs } from 'utils/ipfs-parse'
import { truncateAtWord } from 'utils/truncate-at-word'
import { CurateIcon } from 'components/curate/icons'
import {
  ChainChip,
  Label,
  Page,
  SkeletonBlock,
  Surface,
} from 'components/curate/primitives'
import { EntryStatus, lightEntryStatus } from 'components/curate/entry-status'
import { Explainer } from 'components/curate/explainer'
import { EvidenceClosed } from 'components/inline-evidence-composer'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { reveal } from 'components/curate/motion/reveal'
import {
  AddressLink,
  FieldValue,
  hasValue,
  identifierFields,
  isImageField,
  titleField,
  type EntryField,
} from 'components/curate/item-light-fields'
import { StickyActionBarSpacer } from 'components/curate/item-light-action-bar'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { WindowPanel } from './item-window'
import { requestFacts, type LightRequest } from './request-facts'

/*
 * Light Curate item page. A breadcrumb, then the hero (the one featured
 * panel): the entry's identifiers set large with its status, and on the
 * right whatever clock is running (challenge window, appeal period, the
 * court case, or the date it settled). Under it, two columns: the fields
 * and the history on the left, the sticky action card on the right (a
 * bottom bar on phones). Every figure comes from the subgraph, the list
 * contract and the clock.
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
   stacks, the clock comes straight after the identity so the time pressure
   is on screen on load, ahead of the stats. */
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

const Logo = styled.img`
  flex: 0 0 auto;
  width: 64px;
  height: 64px;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  background: var(--color-raised);
  object-fit: contain;

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
  top: calc(var(--app-bar-height) + 24px);
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

/*
 * Identifiers the hero shows in full, so the Details panel can leave them
 * out. Links are set untruncated in the hero; long text and files keep
 * their compact form there, so they stay in the panel too.
 */
const HERO_FULL_TYPES = new Set(
  [
    ItemTypes.TEXT,
    ItemTypes.ADDRESS,
    ItemTypes.RICH_ADDRESS,
    ItemTypes.GTCR_ADDRESS,
    ItemTypes.NUMBER,
    ItemTypes.BOOLEAN,
    ItemTypes.LINK,
  ].map((type) => String(type).toLowerCase()),
)
const isLinkField = (field: EntryField) =>
  String(field.type || '').toLowerCase() ===
  String(ItemTypes.LINK).toLowerCase()

/** A logo or picture among the fields, shown next to the title. */
const logoOf = (fields: EntryField[]): string | undefined => {
  const image = fields.find((field) => isImageField(field) && hasValue(field))
  if (!image) return undefined
  const value = String(image.value)
  return /^https?:\/\//i.test(value) ? value : parseIpfs(value)
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
  const [ipfsItemData, setIpfsItemData] = useState<
    Record<string, unknown> | undefined
  >()
  const timestamp = useContext(WalletContext)?.timestamp
  const [modalOpen, setModalOpen] = useState<boolean | undefined>()
  const tcrViewContext = useContext(LightTCRViewContext)
  const tcrError = tcrViewContext?.tcrError
  const metaEvidence = tcrViewContext?.metaEvidence
  const challengePeriodDuration = tcrViewContext?.challengePeriodDuration
  // null means "resolved, but no appeal cost applies"; undefined means "not yet fetched".
  const [appealCost, setAppealCost] = useState<BigNumber | null | undefined>()
  const now = useNow()

  // subgraph item entities have id "<itemID>@<listaddress>"
  const compoundId = `${itemID}@${tcrAddress?.toLowerCase()}`
  const { graphqlBatcher } = useGraphqlBatcher()
  const detailsViewQuery = useQuery({
    queryKey: ['lightItemDetails', compoundId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: LIGHT_ITEM_DETAILS_QUERY,
        variables: { id: compoundId },
        chainId: chainId!,
      }),
    enabled: !!chainId,
    staleTime: STALE_TIME,
  })

  const item = useMemo(
    () =>
      detailsViewQuery.isLoading ? undefined : detailsViewQuery.data?.litem,
    [detailsViewQuery.isLoading, detailsViewQuery.data],
  )

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
    ;(async () => {
      try {
        const r = await fetch(parseIpfs(item.data), {
          signal: controller.signal,
        })
        if (!r.ok) return
        const data = await r.json()
        if (!cancelled) setIpfsItemData(data)
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
        errors: [],
        columns,
        decodedData: columns.map(
          (c: { label: string }) =>
            (ipfsItemData.values as Record<string, unknown>)?.[c.label],
        ),
      }
    }

    return {
      ...item,
      errors: [`IPFS data unavailable for this item (${item.data}).`],
      columns: metaEvidence?.metadata?.columns ?? [],
      decodedData: [],
    }
  }, [item, metaEvidence, ipfsItemData])

  const { metadata } = metaEvidence || {}
  const { decodedData } = decodedItem || {}
  const { tcrTitle, itemName } = metadata || {}

  const view = useMemo(
    () => lightEntryStatus(item, timestamp, challengePeriodDuration),
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
  const primaryField = useMemo(() => titleField(fields), [fields])
  const otherIdentifiers = useMemo(
    () => identifierFields(fields).filter((field) => field !== primaryField),
    [fields, primaryField],
  )
  const heroFields = useMemo(
    () => [
      ...(primaryField ? [primaryField] : []),
      ...otherIdentifiers.filter((field) =>
        HERO_FULL_TYPES.has(String(field.type || '').toLowerCase()),
      ),
    ],
    [primaryField, otherIdentifiers],
  )

  const capitalizeFirst = (s: string | undefined) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

  const fullSeoTitle =
    decodedItem && metadata
      ? `${capitalizeFirst(itemName)} - ${tcrTitle} - Kleros · Curate`
      : 'Kleros · Curate'
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

  // If this is a TCR in a TCR of TCRs, fetch its metadata via cached hook.
  const itemAddress = metadata?.isTCRofTCRs
    ? decodedItem?.decodedData?.[0]
    : undefined
  const itemMetaQuery = useTcrMetaEvidence(itemAddress, chainId ?? undefined)
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

  // If the item is disputed, unresolved etc, get the appealCost to propagate it to
  // crowdfunding related components
  useEffect(() => {
    if (!item || appealCost !== undefined) return
    const request = item.requests[0]
    // appeal cost might not be applicable
    if (request.resolved || !request.disputed) setAppealCost(null)
    else {
      const arbitrator = new ethers.Contract(
        request.arbitrator,
        _IArbitrator,
        library,
      )
      arbitrator
        .appealCost(request.disputeID, request.arbitratorExtraData)
        .then((cost: BigNumber) => setAppealCost(cost))
        .catch((err: unknown) => {
          console.error(err)
          setAppealCost(null)
        })
    }
  }, [item, appealCost, library])

  useDocumentHead(truncatedSeoTitle, truncatedSeoMetaDescription)

  if (!tcrAddress || !itemID || tcrError)
    return (
      <ErrorPage
        code="400"
        message={
          typeof tcrError === 'string'
            ? tcrError
            : 'This entry could not be found.'
        }
        tip="Make sure your wallet is set to the correct network (is this on Gnosis Chain?)."
      />
    )

  const entryName = itemName ? capitalizeFirstLetter(itemName) : 'Entry'
  const registryHref = `/tcr/${chainId}/${tcrAddress}`
  const request = item?.requests?.[0] as LightRequest | undefined
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
  const logo = logoOf(fields)
  const titleText =
    primaryField && hasValue(primaryField)
      ? String(primaryField.value)
      : entryName

  return (
    <Page>
      <Crumbs aria-label="Breadcrumb">
        <Link to={registryHref}>
          <CurateIcon name="registry" size={14} />
          {tcrTitle || 'Registry'}
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{entryName}</span>
      </Crumbs>

      <Hero
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
          <Identity>
            {logo && <Logo src={logo} alt="" />}
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
          </Identity>
          {otherIdentifiers.length > 0 && (
            <KeyRow>
              {otherIdentifiers.map((field, index) => (
                <div key={`${field.label}-${index}`}>
                  <dt>{field.label}</dt>
                  <dd>
                    <FieldValue field={field} detailed={isLinkField(field)} />
                  </dd>
                </div>
              ))}
            </KeyRow>
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
            {metaEvidence?.fileURI && (
              <PolicyLink href={parseIpfs(metaEvidence.fileURI)} />
            )}
          </StatusRow>
        </HeroMain>
        <HeroSide>
          {item && request && facts && statusCode !== undefined ? (
            <WindowPanel
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
              {/* The latest request, like every stat here; while jurors
                    decide the court panel leads with the same count. */}
              {!facts.inCourt && (
                <div>
                  <Label as="dt" $tone="faint">
                    Evidence
                  </Label>
                  <dd>
                    <AnimatedNumber value={facts.evidenceCount} />
                  </dd>
                </div>
              )}
              <div>
                <Label as="dt" $tone="faint">
                  Requests
                </Label>
                <dd>
                  <AnimatedNumber value={item?.requests?.length ?? 0} />
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
          <ItemDetailsCard
            columns={decodedItem?.columns}
            item={decodedItem}
            title="Details"
            loading={loading}
            itemMetaEvidence={itemMetaEvidence}
            exclude={heroFields}
          />
          {/* Spread the `requests` parameter to convert elements from array to an object */}
          <RequestTimelines
            item={item}
            requests={
              item?.requests &&
              item.requests.map((r: TimelineRequest) => ({ ...r }))
            }
            kind="light"
            metaEvidence={metaEvidence}
            caseInHero={!!facts?.inCourt && !!facts.disputeID}
          />
          {/* The contracts take evidence only while the latest request is
              open; otherwise the section stays, saying when it opens. */}
          {item && !hasPendingRequest(item.status) && (
            <EvidenceClosed
              reason={
                item.status === CONTRACT_STATUS.REGISTERED
                  ? `Opens if someone asks to remove this ${itemName || 'entry'}.`
                  : `Opens if this ${itemName || 'entry'} is submitted again.`
              }
            />
          )}
          <Explainer
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
                body: "Challenge a request that breaks the policy during its challenge period. If jurors agree, you earn the requester's base deposit and yours comes back.",
              },
              {
                title: 'Kleros jurors decide',
                body: "The side they agree with gets its deposit back plus the other side's, less the arbitration cost.",
              },
            ]}
            footer={<Link to="/guide">Read the guide</Link>}
          />
        </Main>

        <Rail aria-label="Actions">
          <ItemStatusCard
            item={decodedItem}
            timestamp={timestamp}
            request={item?.requests && { ...item.requests[0] }}
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            appealCost={appealCost ?? undefined}
            dark
          />
          {/* Appeal funding is only rendered if the item has an appealable dispute. */}
          <CrowdfundingCard
            item={decodedItem}
            timestamp={timestamp}
            appealCost={appealCost ?? undefined}
          />
        </Rail>
      </Columns>
      <StickyActionBarSpacer />
    </Page>
  )
}

export default ItemDetails
