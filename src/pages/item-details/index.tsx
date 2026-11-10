import React, { useState, useEffect, useContext, useMemo } from 'react'
import { ethers, type BigNumber } from 'ethers'
import styled from 'styled-components'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { request } from 'graphql-request'
import { gtcrDecode } from '@kleros/gtcr-encoder'
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
import { TCRViewContext } from 'contexts/tcr-view-context'
import { WalletContext } from 'contexts/wallet-context'
import { capitalizeFirstLetter, ZERO_ADDRESS } from 'utils/string'
import { CLASSIC_ITEM_DETAILS_QUERY } from 'utils/graphql'
import {
  CONTRACT_STATUS,
  hasPendingRequest,
  itemToStatusCode,
} from 'utils/item-status'
import { formatAbsolute } from 'utils/time'
import { STALE_TIME } from 'consts'
import { parseIpfs } from 'utils/ipfs-parse'
import { truncateAtWord } from 'utils/truncate-at-word'
import { subgraphUrl } from 'config/tcr-addresses'
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
import {
  requestFacts,
  type LightRequest as ClassicRequest,
} from 'pages/light-item-details/request-facts'
import ItemStatusCard from './item-status-card'
import { formatSince } from './format-since'
import CrowdfundingCard from './crowdfunding-card'
import Badges from './badges'
import { ClassicWindowPanel } from './appeal-funding'

/*
 * Classic Curate item page, composed like the Light one. A breadcrumb, then
 * the hero (the one featured panel): the entry's identifiers set large with
 * its status, and on the right whatever clock is running (challenge window,
 * appeal period, the court case, or the date it settled). Under it, two
 * columns: the fields, the history and the badges on the left, the sticky
 * action card on the right (a bottom bar on phones). The entry is read from
 * the subgraph and decoded on the client with the list's columns
 * (gtcrDecode); every figure comes from the subgraph, the list contract and
 * the clock.
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

  /* Stacked: the settled date and the court block keep their own height
     (no desktop min-height), so the action card comes up on a phone. */
  @media (max-width: 1000px) {
    padding-block: 20px;
    border-top: 1px solid var(--glass-border);
    border-left: 0;

    > div {
      min-height: 0;
      justify-content: flex-start;
    }
  }

  @media (max-width: 720px) {
    padding: 18px;
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

  > :nth-child(n + 5) {
    --i: 7;
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

/** The list's policy, opened in the attachment viewer, with its last update. */
const PolicyLink = ({ href }: { href: string }) => {
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

/** A subgraph item plus the fields decoded from its data blob. */
type DecodedItem = SubgraphItem & { errors: string[] }

const ItemDetails = ({ itemID, search }: ItemDetailsProps) => {
  const { tcrAddress } = useParams()
  const chainId = useUrlChainId()
  const library = useEthersProvider({
    chainId: chainId ?? undefined,
  })
  const timestamp = useContext(WalletContext)?.timestamp
  const [modalOpen, setModalOpen] = useState<boolean | undefined>()
  const tcrViewContext = useContext(TCRViewContext)
  const tcrError = tcrViewContext?.tcrError
  const connectedTCRAddr = tcrViewContext?.connectedTCRAddr
  const metaEvidence = tcrViewContext?.metaEvidence
  const challengePeriodDuration = tcrViewContext?.challengePeriodDuration
  // null means "resolved, but no appeal cost applies"; undefined means "not yet fetched".
  const [appealCost, setAppealCost] = useState<BigNumber | null | undefined>()
  const now = useNow()

  // subgraph item entities have id "<itemID>@<listaddress>"
  const compoundId = `${itemID}@${tcrAddress?.toLowerCase()}`
  const detailsViewQuery = useQuery({
    queryKey: ['classicItemDetails', compoundId],
    queryFn: () => {
      const url = subgraphUrl[chainId!]
      if (!url) throw new Error(`No subgraph URL for chain ${chainId}`)
      return request(url, CLASSIC_ITEM_DETAILS_QUERY, { id: compoundId })
    },
    enabled: !!chainId,
    staleTime: STALE_TIME,
  })

  const item = useMemo<SubgraphItem | undefined>(
    () =>
      detailsViewQuery.isLoading
        ? undefined
        : (detailsViewQuery.data?.item ?? undefined),
    [detailsViewQuery.isLoading, detailsViewQuery.data],
  )

  const { metadata } = metaEvidence || {}
  const columns = metadata?.columns

  // Decode the item's bytes with the list's columns. Until the meta evidence
  // is in, the item is there without fields. `resolved` mirrors the latest
  // request, which the fields card needs to offer the reward withdrawal.
  const decodedItem = useMemo<DecodedItem | undefined>(() => {
    if (!item) return undefined
    const base = { ...item, resolved: !!item.requests?.[0]?.resolved }
    if (!columns) return { ...base, errors: [] }

    const errors: string[] = []
    let decodedData: unknown[] | undefined
    try {
      decodedData = gtcrDecode({ columns, values: item.data })
    } catch {
      errors.push(`Error decoding ${item.itemID} of TCR at ${tcrAddress}`)
    }
    return { ...base, decodedData, errors }
  }, [item, columns, tcrAddress])

  const decodedData = decodedItem?.decodedData
  const { tcrTitle, itemName } = metadata || {}

  const view = useMemo(
    () => lightEntryStatus(item, timestamp, challengePeriodDuration),
    [item, timestamp, challengePeriodDuration],
  )

  const fields = useMemo<EntryField[]>(
    () =>
      columns && decodedData
        ? columns.map((column: Column, index: number) => ({
            ...column,
            value: decodedData[index],
          }))
        : [],
    [columns, decodedData],
  )
  const primaryField = useMemo(() => titleField(fields), [fields])
  const otherIdentifiers = useMemo(
    () => identifierFields(fields).filter((field) => field !== primaryField),
    [fields, primaryField],
  )

  const fullSeoTitle =
    decodedItem && metadata
      ? `${capitalizeFirstLetter(itemName || 'entry')} - ${tcrTitle} - Kleros · Curate`
      : 'Kleros · Curate'
  const fullSeoMetaDescription =
    decodedItem && metadata && view && (decodedData?.length ?? 0) > 0
      ? `${decodedData?.join(' ')} · ${view.label} on ${tcrTitle} in Kleros Curate`
      : 'View entry details on Kleros Curate.'
  useDocumentHead(
    truncateAtWord(fullSeoTitle, 160),
    truncateAtWord(fullSeoMetaDescription, 160),
  )

  // If this is a TCR in a TCR of TCRs, fetch its metadata via cached hook.
  const firstDecodedValue = decodedData?.[0]
  const itemAddress =
    metadata?.isTCRofTCRs && typeof firstDecodedValue === 'string'
      ? firstDecodedValue
      : undefined
  const itemMetaQuery = useTcrMetaEvidence(itemAddress, chainId ?? undefined)
  const itemMetaEvidence = useMemo(() => {
    if (itemMetaQuery.error) return { error: itemMetaQuery.error }
    if (itemMetaQuery.data) return { file: itemMetaQuery.data }
    return undefined
  }, [itemMetaQuery.data, itemMetaQuery.error])

  // The fields wait for the subgraph item and the list's columns.
  const loading = !item || !metadata

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
    const latest = item.requests?.[0] as ClassicRequest | undefined
    if (!latest) return
    // appeal cost might not be applicable
    if (latest.resolved || !latest.disputed) setAppealCost(null)
    else {
      const arbitrator = new ethers.Contract(
        latest.arbitrator,
        _IArbitrator,
        library,
      )
      arbitrator
        .appealCost(
          latest.disputeID,
          (latest as { arbitratorExtraData?: string }).arbitratorExtraData,
        )
        .then((cost: BigNumber) => setAppealCost(cost))
        .catch((err: unknown) => {
          console.error(err)
          setAppealCost(null)
        })
    }
  }, [item, appealCost, library])

  if (
    !tcrAddress ||
    !itemID ||
    tcrError ||
    (!detailsViewQuery.isLoading && !detailsViewQuery.data?.item)
  )
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
  const latestRequest = item?.requests?.[0] as ClassicRequest | undefined
  const statusCode =
    item && timestamp && challengePeriodDuration
      ? itemToStatusCode(item, timestamp, challengePeriodDuration)
      : undefined
  const facts =
    item && latestRequest && statusCode !== undefined && challengePeriodDuration
      ? requestFacts({
          item,
          request: latestRequest,
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
  const showBadges =
    !!connectedTCRAddr &&
    connectedTCRAddr !== ZERO_ADDRESS &&
    !!metadata &&
    !metadata.isConnectedTCR &&
    !metadata.relTcrDisabled

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
                    <FieldValue field={field} />
                  </dd>
                </div>
              ))}
            </KeyRow>
          )}
          <StatusRow>
            {view ? (
              <EntryStatus status={view} now={now} />
            ) : (
              <SkeletonBlock $height="18px" $width="220px" />
            )}
            {metaEvidence?.fileURI && (
              <PolicyLink href={parseIpfs(metaEvidence.fileURI)} />
            )}
          </StatusRow>
        </HeroMain>
        <HeroSide>
          {item && latestRequest && facts && statusCode !== undefined ? (
            <ClassicWindowPanel
              item={item}
              request={latestRequest}
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
          {latestRequest && facts ? (
            <Stats>
              <div>
                <Label as="dt" $tone="faint">
                  {facts.isRegistration ? 'Submitted' : 'Removal requested'}
                </Label>
                <dd title={formatAbsolute(facts.submissionTime)}>
                  {formatSince(facts.submissionTime, now)}
                </dd>
              </div>
              {latestRequest.requester && (
                <div>
                  <Label as="dt" $tone="faint">
                    By
                  </Label>
                  <dd>
                    <AddressLink address={latestRequest.requester} />
                  </dd>
                </div>
              )}
              {facts.hasDispute && latestRequest.challenger && (
                <div>
                  <Label as="dt" $tone="faint">
                    Challenged by
                  </Label>
                  <dd>
                    <AddressLink address={latestRequest.challenger} />
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
            columns={columns}
            item={decodedItem}
            title="Fields"
            loading={loading}
            itemMetaEvidence={itemMetaEvidence}
          />
          {/* Spread the `requests` parameter to convert elements from array to an object */}
          <RequestTimelines
            item={item as SubgraphItem}
            requests={
              item?.requests &&
              item.requests.map((r) => ({ ...(r as TimelineRequest) }))
            }
            kind="classic"
            metaEvidence={metaEvidence}
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
          {showBadges && (
            <Badges
              connectedTCRAddr={connectedTCRAddr}
              item={decodedItem?.decodedData ? decodedItem : undefined}
              tcrAddress={tcrAddress}
            />
          )}
          <Explainer
            id="item-classic-how-entries-are-judged"
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
            request={latestRequest && { ...latestRequest }}
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            appealCost={appealCost ?? undefined}
          />
          {/* Appeal funding is only rendered if the item has an appealable dispute. */}
          <CrowdfundingCard
            item={decodedItem as SubgraphItem}
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
