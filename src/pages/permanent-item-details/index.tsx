import React, { useState, useEffect, useContext, useMemo } from 'react'
import styled from 'styled-components'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ethers, BigNumber } from 'ethers'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
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
import { capitalizeFirstLetter } from 'utils/string'
import { truncateAtWord } from 'utils/truncate-at-word'
import { formatAbsolute, formatDurationLong } from 'utils/time'
import { STATUS_CODE } from 'utils/permanent-item-status'
import ItemDetailsCard from 'components/item-details-card'
import RequestTimelines from 'components/permanent-request-timelines'
import { AddressLink } from 'components/curate/item-stake-address'
import { CurateIcon } from 'components/curate/icons'
import {
  ChainChip,
  Label,
  Page,
  SkeletonBlock,
  Surface,
} from 'components/curate/primitives'
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
import ItemStatusCard from './item-status-card'
import { formatSince } from 'pages/item-details/format-since'
import { StakeWindowPanel } from './item-window'
import { PolicySince, policyInForceSince } from './policy-since'
import { multiplierPercent, nativeText, tokenText } from './modals/shell'
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

const ItemDetails = ({ itemID, search }: ItemDetailsProps) => {
  const { tcrAddress } = useParams()
  const chainId = useUrlChainId()
  const library = useEthersProvider({
    chainId: chainId ?? undefined,
  })
  const [ipfsItemData, setIpfsItemData] = useState<
    { values?: Record<string, unknown> } | undefined
  >()
  const [ipfsError, setIpfsError] = useState(false)
  const timestamp = useContext(WalletContext)?.timestamp
  const [modalOpen, setModalOpen] = useState(false)
  const { graphqlBatcher } = useGraphqlBatcher()
  const [appealCost, setAppealCost] = useState<BigNumber | null | undefined>()
  const [metaEvidence, setMetaEvidence] = useState<MetaEvidence | undefined>()
  const now = useNow()
  const openAttachment = useAttachment()
  const nativeCurrency = useNativeCurrency()

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
  const policySince = policyInForceSince(
    settingsQuery.data?.registry?.arbitrationSettings,
  )

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
      .then((r) => setIpfsItemData(r))
      .catch((err: unknown) => {
        console.error('Could not get ipfs file', err)
        setIpfsError(true)
      })
  }, [item, ipfsItemData, ipfsError])

  const arbitrationCost = useArbitrationCost({
    address: registry?.arbitrator?.id,
    arbitratorExtraData:
      registry?.arbitrationSettings?.[0]?.arbitratorExtraData,
    library,
  })

  useEffect(() => {
    if (!registry) return
    ;(async () => {
      const arbSetting = registry.arbitrationSettings?.[0]
      if (!arbSetting?.metaEvidenceURI) return
      const response = await fetch(parseIpfs(arbSetting.metaEvidenceURI))
      const file = await response.json()
      setMetaEvidence(file)
    })().catch((err: unknown) => {
      console.error('Could not get the list metadata', err)
    })
  }, [registry])

  const decodedItem = useMemo(() => {
    if (!item || !metaEvidence?.metadata?.columns || !ipfsItemData)
      return undefined

    const orderDecodedData = (
      columns: Column[],
      values: Record<string, unknown> | undefined,
    ) => columns.map((column) => values?.[column.label])

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

  const getStatusPhrase = (code: number | null | undefined) => {
    switch (code) {
      case STATUS_CODE.ACCEPTED:
        return 'is verified to be safe'
      case STATUS_CODE.PENDING:
        return 'is pending verification'
      case STATUS_CODE.DISPUTED:
        return 'is under challenge'
      case STATUS_CODE.CROWDFUNDING:
      case STATUS_CODE.CROWDFUNDING_WINNER:
        return 'is crowdfunding appeal'
      case STATUS_CODE.PENDING_WITHDRAWAL:
        return 'awaits withdrawal'
      case STATUS_CODE.WAITING_ARBITRATOR:
        return 'awaits arbitrator ruling'
      case STATUS_CODE.REJECTED:
        return 'was rejected'
      case STATUS_CODE.REMOVED:
        return 'was removed'
      case STATUS_CODE.WITHDRAWN:
        return 'was withdrawn'
      default:
        return 'has unknown status'
    }
  }

  const fullSeoTitle =
    decodedItem && metadata
      ? `${capitalizeFirstLetter(itemName ?? '')} - ${tcrTitle} - Kleros · Curate`
      : 'Kleros · Curate'
  const truncatedSeoTitle = truncateAtWord(fullSeoTitle, 160)

  const fullSeoMetaDescription =
    decodedItem && metadata && statusCode !== null && decodedData
      ? `${decodedData.join(' ')} - ${getStatusPhrase(statusCode)} on ${
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

  // If the item is disputed, unresolved etc, get the appealCost to propagate it
  // to the appeal funding components.
  useEffect(() => {
    if (!item || !registry || appealCost !== undefined) return
    const challenge = item.challenges[0]
    // Appeal cost might not be applicable.
    if (!challenge || challenge.disputeOutcome) setAppealCost(null)
    else {
      const arbitrator = new ethers.Contract(
        registry.arbitrator.id,
        _IArbitrator,
        library,
      )

      arbitrator
        .appealCost(
          challenge.disputeID,
          challenge.arbitrationSetting.arbitratorExtraData,
        )
        .then((cost: BigNumber) => setAppealCost(cost))
        .catch((err: unknown) => {
          console.error(err)
          setAppealCost(null)
        })
    }
  }, [item, appealCost, library, registry])

  useDocumentHead(truncatedSeoTitle, truncatedSeoMetaDescription)

  if (!tcrAddress || !itemID)
    return (
      <ErrorPage
        code="400"
        message={'This item could not be found.'}
        tip="Make sure your wallet is set to the correct network (is this on Gnosis Chain?)."
      />
    )

  const name = itemName || 'item'
  const Name = capitalizeFirstLetter(name)
  const registryHref = `/tcr/${chainId}/${tcrAddress}`
  const policyURI = registry?.arbitrationSettings?.[0]?.metadata?.policyURI
  const logo = logoOf(fields)
  const titleText =
    primaryField && hasValue(primaryField) ? String(primaryField.value) : Name

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
            {loading && !fieldsUnavailable ? (
              <SkeletonBlock $height="40px" $width="min(420px, 100%)" />
            ) : (
              <Title $size={titleSize(titleText)}>
                {primaryField ? (
                  <FieldValue field={primaryField} detailed />
                ) : (
                  Name
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
              {item.submitter && (
                <div>
                  <Label as="dt" $tone="faint">
                    By
                  </Label>
                  <dd>
                    <AddressLink address={item.submitter} />
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
          <ItemDetailsCard
            columns={columns ?? metadata?.columns}
            item={cardItem}
            title="Fields"
            loading={Boolean(loading) && !fieldsUnavailable}
          />
          <RequestTimelines item={item} metaEvidence={metaEvidence} />
          <Explainer
            id="stake-curate-item"
            eyebrow="How this list works"
            heading="A stake backs every entry. Spot a bad one and it is yours."
            steps={explainerSteps}
          />
        </Main>

        <Rail aria-label="Actions">
          <ItemStatusCard
            item={decodedItem ?? item}
            registry={registry}
            timestamp={timestamp}
            modalOpen={modalOpen}
            metaEvidence={metaEvidence}
            setModalOpen={setModalOpen}
            appealCost={appealCost ?? undefined}
            arbitrationCost={arbitrationCost.arbitrationCost}
          />
        </Rail>
      </Columns>
      <StickyActionBarSpacer aria-hidden />
    </Page>
  )
}

export default ItemDetails
