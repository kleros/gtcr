import React, { useContext, useMemo } from 'react'
import styled from 'styled-components'
import type { Address } from 'viem'
import type { BigNumber, BigNumberish } from 'ethers'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import {
  itemToStatusCode,
  STATUS_CODE,
  SUBGRAPH_RULING,
} from 'utils/item-status'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import useNativeCurrency from 'hooks/native-currency'
import useUrlChainId from 'hooks/use-url-chain-id'
import useNow from 'hooks/use-now'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import {
  formatAbsolute,
  formatAgo,
  formatDuration,
  formatDurationLong,
} from 'utils/time'
import ItemActionButton from 'components/item-action-button'
import { scrollToEvidenceComposer } from 'components/request-timelines'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ButtonAnchor,
  Label,
  SkeletonBlock,
  Small,
  Stack,
  Surface,
} from 'components/curate/primitives'
import { EntryStatus, lightEntryStatus } from 'components/curate/entry-status'
import { useActionGate } from 'components/curate/item-light-gate'
import { StickyActionBar } from 'components/curate/item-light-action-bar'
import { AddressLink } from 'components/curate/item-light-fields'
import { formatAmount, formatEther } from 'components/curate/item-light-format'
import ItemActionModal from './item-action-modal'
import { requestFacts, type LightRequest } from './request-facts'

/*
 * The action card (right rail; a bottom bar on phones). It leads with the
 * one thing to do now and its exact amount, split into deposit and
 * arbitration cost, then what a successful challenge wins and the court
 * case. While jurors decide, it asks for evidence instead of showing a dead
 * button.
 */

const Card = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 18px;
`

const Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const Amount = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 44px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;

  small {
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0;
  }
`

const Prompt = styled.p`
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
`

const SplitBar = styled.div`
  display: flex;
  gap: 3px;
  height: 6px;

  span {
    min-width: 4px;
    border-radius: var(--radius-pill);
  }
`

const SplitLegend = styled.ul`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
  }

  i {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
  }

  b {
    color: var(--color-text);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

const Rows = styled.dl`
  display: flex;
  flex-direction: column;
  margin: 0;
  border-top: 1px solid var(--glass-border);

  div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 11px 0;
    border-bottom: 1px solid var(--glass-border);
  }

  div:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  dt {
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  dd {
    margin: 0;
    min-width: 0;
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
    text-align: right;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--color-primary);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`

interface RulingProps {
  currentRuling: string | null
}

/** The current ruling as a sentence. Kept for the Classic item page. */
export const Ruling = ({ currentRuling }: RulingProps) => {
  if (currentRuling == null)
    return <SkeletonBlock $height="18px" $width="160px" />

  switch (currentRuling) {
    case 'None':
      return <>Jurors refused to rule.</>
    case 'Accept':
      return <>Jurors ruled for the requester.</>
    case 'Reject':
      return <>Jurors ruled for the challenger.</>
    default:
      throw new Error(`Unhandled ruling ${currentRuling}`)
  }
}

/** What the amount is made of: the list's deposit and the court's fee. */
const AmountSplit = ({
  base,
  cost,
  baseLabel,
  currency,
}: {
  base?: BigNumberish
  cost?: BigNumberish
  baseLabel: string
  currency: string
}) => {
  if (base === undefined || cost === undefined) return null
  const baseValue = Number(formatEther(base))
  const costValue = Number(formatEther(cost))
  return (
    <div
      role="img"
      aria-label={`Split of the amount: ${baseLabel} ${formatAmount(
        base,
        currency,
      )}, arbitration cost ${formatAmount(cost, currency)}`}
    >
      <SplitBar aria-hidden>
        {baseValue > 0 && (
          <span
            style={{ flexGrow: baseValue, background: 'var(--color-primary)' }}
          />
        )}
        {costValue > 0 && (
          <span
            style={{ flexGrow: costValue, background: 'var(--color-muted)' }}
          />
        )}
      </SplitBar>
      <SplitLegend aria-hidden>
        <li>
          <i style={{ background: 'var(--color-primary)' }} />
          {baseLabel} <b>{formatEther(base)}</b>
        </li>
        <li>
          <i style={{ background: 'var(--color-muted)' }} />
          Arbitration <b>{formatEther(cost)}</b>
        </li>
      </SplitLegend>
    </div>
  )
}

interface ItemStatusCardProps {
  item: SubgraphItem
  timestamp?: BigNumber
  request: LightRequest
  modalOpen?: boolean
  setModalOpen: (open: boolean) => void
  appealCost?: BigNumber
  dark?: boolean
}

const ItemStatusCard = ({
  item,
  timestamp,
  request,
  modalOpen,
  setModalOpen,
  appealCost,
}: ItemStatusCardProps) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const {
    metaEvidence,
    challengePeriodDuration,
    tcrAddress,
    submissionDeposit,
    removalDeposit,
    submissionChallengeDeposit,
    removalChallengeDeposit,
    submissionBaseDeposit,
    removalBaseDeposit,
    submissionChallengeBaseDeposit,
    removalChallengeBaseDeposit,
    arbitrationCost,
    gtcrView,
  } = useContext(LightTCRViewContext) || {}
  const urlChainId = useUrlChainId()
  const nativeCurrency = useNativeCurrency()
  const now = useNow()

  const statusCode = useMemo(
    () =>
      item && timestamp && challengePeriodDuration
        ? itemToStatusCode(item, timestamp, challengePeriodDuration)
        : undefined,
    [item, timestamp, challengePeriodDuration],
  )
  const view = useMemo(
    () => lightEntryStatus(item, timestamp, challengePeriodDuration),
    [item, timestamp, challengePeriodDuration],
  )
  const executeGate = useActionGate({
    verb: 'execute the request',
    needsAuth: false,
  })

  const executeRequest = async () => {
    if (!tcrAddress || !walletClient || !publicClient) return
    try {
      const { request: req } = await simulateContract(wagmiConfig, {
        address: tcrAddress as Address,
        abi: _gtcr,
        functionName: 'executeRequest',
        args: [item.itemID],
        account,
      })

      await wrapWithToast(() => walletClient.writeContract(req), publicClient)
    } catch (err) {
      console.error('Error executing request:', err)
      errorToast(parseWagmiError(err))
    }
  }

  if (!item || !timestamp || !challengePeriodDuration || !request)
    return (
      <Card id="item-status-card" $padding="standard" aria-busy="true">
        <SkeletonBlock $height="16px" $width="50%" />
        <SkeletonBlock $height="44px" $width="60%" />
        <SkeletonBlock $height="44px" />
      </Card>
    )

  if (statusCode === undefined || !view) return null

  const facts = requestFacts({
    item,
    request,
    statusCode,
    challengePeriodDuration,
    chainId: urlChainId,
  })
  const {
    inWindow,
    isPending,
    appealable,
    inCourt,
    requesterName,
    loserName,
    winnerName,
    currentRuling,
    windowEnd,
    appealHalf,
    appealEnd,
    disputeHref,
    disputeHost,
    disputeID,
    hasDispute,
  } = facts
  const { metadata, fileURI } = metaEvidence || {}
  const itemName = metadata?.itemName || 'entry'
  const { resolved } = request

  const challengeCost =
    statusCode === STATUS_CODE.SUBMITTED
      ? submissionChallengeDeposit
      : statusCode === STATUS_CODE.REMOVAL_REQUESTED
        ? removalChallengeDeposit
        : undefined
  const challengeBase =
    statusCode === STATUS_CODE.SUBMITTED
      ? submissionChallengeBaseDeposit
      : removalChallengeBaseDeposit
  const isResubmit =
    statusCode === STATUS_CODE.REJECTED || statusCode === STATUS_CODE.REMOVED
  const buttonAmount = inWindow
    ? challengeCost
    : statusCode === STATUS_CODE.REGISTERED
      ? removalDeposit
      : isResubmit
        ? submissionDeposit
        : undefined
  const amountBase = inWindow
    ? challengeBase
    : statusCode === STATUS_CODE.REGISTERED
      ? removalBaseDeposit
      : isResubmit
        ? submissionBaseDeposit
        : undefined
  const amountLabel = buttonAmount
    ? formatAmount(buttonAmount, nativeCurrency)
    : undefined
  const hasRequestAction = !inCourt

  const onClick = () => {
    switch (statusCode) {
      case STATUS_CODE.REJECTED:
      case STATUS_CODE.REMOVED:
      case STATUS_CODE.REGISTERED:
      case STATUS_CODE.SUBMITTED:
      case STATUS_CODE.REMOVAL_REQUESTED:
      case STATUS_CODE.CROWDFUNDING:
      case STATUS_CODE.CROWDFUNDING_WINNER: {
        setModalOpen(true)
        break
      }
      case STATUS_CODE.PENDING_SUBMISSION:
      case STATUS_CODE.PENDING_REMOVAL:
        return executeRequest()
      case STATUS_CODE.CHALLENGED:
      case STATUS_CODE.WAITING_ARBITRATOR:
        return null
      default:
        throw new Error(`Unhandled status code ${statusCode}`)
    }
  }

  const showRuling =
    !!request.disputed &&
    (resolved ||
      appealable ||
      statusCode === STATUS_CODE.WAITING_ARBITRATOR ||
      statusCode === STATUS_CODE.WAITING_ENFORCEMENT)
  const rulingText =
    currentRuling === SUBGRAPH_RULING.ACCEPT
      ? `For the ${requesterName}`
      : currentRuling === SUBGRAPH_RULING.REJECT
        ? 'For the challenger'
        : 'Refused to rule'

  const heading = inWindow
    ? statusCode === STATUS_CODE.SUBMITTED
      ? `Challenge this ${itemName}`
      : 'Challenge this removal'
    : statusCode === STATUS_CODE.REGISTERED
      ? `Remove this ${itemName}`
      : isResubmit
        ? `Resubmit this ${itemName}`
        : isPending
          ? 'Execute the request'
          : appealable
            ? 'Fund the appeal'
            : undefined

  const prompt = isPending
    ? `The window closed ${formatAgo(windowEnd, now)} with no challenge. Anyone can execute it; the deposit returns to the ${requesterName}.`
    : appealable
      ? currentRuling === SUBGRAPH_RULING.NONE
        ? `Jurors refused to rule. If one side fully funds an appeal by ${formatAbsolute(appealEnd)}, the other must fund too or loses.`
        : statusCode === STATUS_CODE.CROWDFUNDING
          ? `The ${loserName} has ${formatDuration(appealHalf - now)} to fund an appeal, or the ruling stands.`
          : `The ${loserName} funded the appeal. The ${winnerName} has ${formatDuration(appealEnd - now)} to fund too, or loses.`
      : undefined

  const action = hasRequestAction ? (
    <ItemActionButton
      statusCode={statusCode}
      itemName={itemName}
      itemID={item.itemID}
      onClick={onClick}
      amount={amountLabel}
      block
      disabled={isPending && !executeGate.ready}
      blocker={executeGate.blocker}
    />
  ) : null

  const barAction =
    statusCode === STATUS_CODE.CHALLENGED ? (
      <Button
        type="button"
        $variant="primary"
        $block
        onClick={scrollToEvidenceComposer}
      >
        Add evidence
      </Button>
    ) : hasRequestAction ? (
      <ItemActionButton
        statusCode={statusCode}
        itemName={itemName}
        itemID={item.itemID}
        onClick={onClick}
        amount={amountLabel}
        block
        disabled={isPending && !executeGate.ready}
        blocker={executeGate.blocker}
      />
    ) : null

  // The subgraph stores the request's base deposit: what a successful
  // challenger nets (the requester also loses the arbitration cost they
  // paid). Shown while a challenge is possible or under way.
  const challengeBounty =
    !resolved &&
    request.deposit !== undefined &&
    (inWindow || !!request.disputed)
      ? request.deposit
      : undefined

  return (
    <>
      <Card
        id="item-status-card"
        $padding="standard"
        role="region"
        aria-label="What you can do"
      >
        {inCourt ? (
          <Head>
            {/* The status is the hero's (and the bar's on phones); the card
                only asks for the action. */}
            <Prompt>
              {statusCode === STATUS_CODE.CHALLENGED
                ? 'Know something the jurors should? Add it before they vote.'
                : statusCode === STATUS_CODE.WAITING_ARBITRATOR
                  ? 'Enforced once the court gives the final ruling.'
                  : 'Waiting to be enforced.'}
            </Prompt>
            {statusCode === STATUS_CODE.CHALLENGED && (
              <Stack $gap={8}>
                <Button
                  type="button"
                  $variant="primary"
                  $block
                  onClick={scrollToEvidenceComposer}
                >
                  <CurateIcon name="policy" size={16} />
                  Add evidence
                </Button>
                {disputeHref && (
                  <ButtonAnchor
                    $variant="secondary"
                    $block
                    href={disputeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Follow case {disputeID} in court
                    <CurateIcon name="external" size={14} />
                  </ButtonAnchor>
                )}
              </Stack>
            )}
          </Head>
        ) : (
          <Head>
            {heading && <Label $tone="faint">{heading}</Label>}
            {buttonAmount ? (
              <>
                <Amount title={amountLabel}>
                  {formatEther(buttonAmount)}
                  <small>{nativeCurrency}</small>
                </Amount>
                <AmountSplit
                  base={amountBase}
                  cost={arbitrationCost}
                  baseLabel={inWindow ? 'Challenge deposit' : 'Deposit'}
                  currency={nativeCurrency}
                />
              </>
            ) : (
              prompt && <Prompt>{prompt}</Prompt>
            )}
          </Head>
        )}

        {action && (
          <Stack $gap={8}>
            {action}
            {isPending && executeGate.controls && (
              <Stack $gap={8}>{executeGate.controls}</Stack>
            )}
            {isPending && executeGate.blocker && (
              <Small $muted role="status">
                {executeGate.blocker}
              </Small>
            )}
          </Stack>
        )}

        <Rows>
          {challengeBounty !== undefined && (
            <div>
              <dt
                title={`The ${requesterName}'s base deposit. A successful challenger also gets their own deposit back.`}
              >
                A successful challenger wins
              </dt>
              <dd>{formatAmount(challengeBounty, nativeCurrency)}</dd>
            </div>
          )}
          {(statusCode === STATUS_CODE.REGISTERED || isResubmit) && (
            <div>
              <dt>Challenge period once sent</dt>
              <dd
                title={formatDurationLong(challengePeriodDuration.toNumber())}
              >
                {formatDuration(challengePeriodDuration.toNumber())}
              </dd>
            </div>
          )}
          {showRuling && (
            <div>
              <dt>{appealable ? 'Current ruling' : 'Ruling'}</dt>
              <dd>{rulingText}</dd>
            </div>
          )}
          {hasDispute &&
            !(statusCode === STATUS_CODE.CHALLENGED && disputeHref) && (
              <div>
                <dt>Court case</dt>
                <dd>
                  {disputeHref ? (
                    <a
                      href={disputeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Case ${disputeID} on ${disputeHost}`}
                    >
                      Case {disputeID}
                      <CurateIcon name="external" size={12} />
                    </a>
                  ) : (
                    <>
                      #{disputeID} at{' '}
                      <AddressLink address={request.arbitrator} />
                    </>
                  )}
                </dd>
              </div>
            )}
        </Rows>
      </Card>

      <StickyActionBar
        status={
          <EntryStatus
            status={
              // The hero's ring draws this window; the bar keeps the words.
              inWindow || isPending || appealable
                ? { ...view, windowStart: undefined }
                : view
            }
            now={now}
          />
        }
        action={barAction}
      />

      {statusCode !== STATUS_CODE.PENDING_SUBMISSION &&
        statusCode !== STATUS_CODE.PENDING_REMOVAL &&
        statusCode !== STATUS_CODE.CHALLENGED && (
          <ItemActionModal
            statusCode={statusCode}
            itemName={itemName}
            item={item}
            fileURI={fileURI || ''}
            isOpen={!!modalOpen}
            onClose={() => setModalOpen(false)}
            submissionDeposit={submissionDeposit}
            tcrAddress={tcrAddress}
            metaEvidence={metaEvidence}
            challengePeriodDuration={challengePeriodDuration}
            gtcrView={gtcrView}
            appealCost={appealCost}
          />
        )}
    </>
  )
}

export default ItemStatusCard
