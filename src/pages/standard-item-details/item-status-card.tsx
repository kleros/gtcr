import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import type { Address } from 'viem'
import type { BigNumber, BigNumberish } from 'ethers'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import {
  CONTRACT_STATUS,
  itemToStatusCode,
  STATUS_CODE,
  SUBGRAPH_RULING,
} from 'utils/item-status'
import { StandardTCRViewContext } from 'contexts/standard-tcr-view-context'
import useNativeCurrency from 'hooks/native-currency'
import useUrlChainId from 'hooks/use-url-chain-id'
import useNow from 'hooks/use-now'
import { wrapWithToast, errorToast, infoToast } from 'utils/wrap-with-toast'
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
  Label,
  SkeletonBlock,
  Small,
  Stack,
  Surface,
} from 'components/curate/primitives'
import {
  EntryStatus,
  standardEntryStatus,
} from 'components/curate/entry-status'
import { useActionGate } from 'components/curate/item-standard-gate'
import {
  sendPhaseLabel,
  type SendPhase,
} from 'components/curate/what-happens-next'
import { Notice } from 'components/curate/item-standard-notice'
import { DisclosurePill } from 'components/curate/item-disclosure-pill'
import { LIST_SETTINGS_FAILED } from 'pages/error-page/copy'
import { StickyActionBar } from 'components/curate/item-standard-action-bar'
import { AddressLink } from 'components/curate/item-standard-fields'
import {
  formatAmount,
  formatEther,
} from 'components/curate/item-standard-format'
import ItemActionModal from './item-action-modal'
import { appealFunding } from 'pages/standard-item-details/appeal-funding'
import {
  requestFacts,
  statusChangeNotice,
  type StandardRequest,
} from './request-facts'
import { useChallengeCost } from './challenge-cost'

/*
 * The action card (right rail; a bottom bar on phones). While a challenge
 * is open it leads with the bounty — the money a correct challenger takes —
 * and the cost follows as the guard that keeps careless challenges out,
 * with the base deposit and arbitration split one pill away (the design
 * review's point 4: the card used to shout the cost and whisper the
 * reward). Otherwise it leads with the one thing to do now and its exact
 * amount. While jurors decide it renders no card at all: the case panel
 * holds the state and both of its actions, and the phone bar keeps its one
 * control — the panel carries the id that bar steps aside for, so the two
 * never offer the same button at once.
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
      {/* Two categories, so two viz colours: a chart never borrows the
          accent or a status role (DESIGN.md). */}
      <SplitBar aria-hidden>
        {baseValue > 0 && (
          <span style={{ flexGrow: baseValue, background: 'var(--viz-1)' }} />
        )}
        {costValue > 0 && (
          <span style={{ flexGrow: costValue, background: 'var(--viz-2)' }} />
        )}
      </SplitBar>
      <SplitLegend aria-hidden>
        <li>
          <i style={{ background: 'var(--viz-1)' }} />
          {baseLabel} <b>{formatEther(base)}</b>
        </li>
        <li>
          <i style={{ background: 'var(--viz-2)' }} />
          Arbitration <b>{formatEther(cost)}</b>
        </li>
      </SplitLegend>
    </div>
  )
}

/**
 * The amount's total and its breakdown, one click away: DESIGN.md asks for
 * both before anything is signed, the design review asked for neither to be
 * the headline. The dialog that sends the transaction carries the full
 * receipt again.
 */
const DepositBreakdown = ({
  total,
  base,
  cost,
  baseLabel,
  currency,
  returns,
}: {
  total?: BigNumberish
  base?: BigNumberish
  cost?: BigNumberish
  baseLabel: string
  currency: string
  /** When the deposit comes back, in the page's words. */
  returns: string
}) => {
  const [open, setOpen] = useState(false)
  if (total === undefined || base === undefined || cost === undefined)
    return null
  return (
    <Stack $gap={10}>
      <DisclosurePill
        icon="layers"
        open={open}
        onToggle={() => setOpen((shown) => !shown)}
      >
        What the {formatAmount(total, currency)} is made of
      </DisclosurePill>
      {open && (
        <Stack $gap={8}>
          <AmountSplit
            base={base}
            cost={cost}
            baseLabel={baseLabel}
            currency={currency}
          />
          <Small $muted>{returns}</Small>
        </Stack>
      )}
    </Stack>
  )
}

interface ItemStatusCardProps {
  item: SubgraphItem
  timestamp?: BigNumber
  request: StandardRequest
  modalOpen?: boolean
  setModalOpen: (open: boolean) => void
  appealCost?: BigNumber
  /** The appeal cost could not be read; the funding dialog offers a retry. */
  appealCostFailed?: boolean
  retryAppealCost?: () => void
  dark?: boolean
}

const ItemStatusCard = ({
  item,
  timestamp,
  request,
  modalOpen,
  setModalOpen,
  appealCost,
  appealCostFailed,
  retryAppealCost,
}: ItemStatusCardProps) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const tcrView = useContext(StandardTCRViewContext)
  const {
    metaEvidence,
    challengePeriodDuration,
    tcrAddress,
    submissionDeposit,
    removalDeposit,
    submissionBaseDeposit,
    removalBaseDeposit,
    arbitrationCost,
    gtcrView,
  } = tcrView || {}
  const urlChainId = useUrlChainId()
  const nativeCurrency = useNativeCurrency()
  const now = useNow()
  // A challenge is priced with the settings the request was made with.
  const challenge = useChallengeCost({
    request,
    isRemoval: item?.status === CONTRACT_STATUS.REMOVAL_REQUESTED,
    list: tcrView,
  })

  const statusCode = useMemo(
    () =>
      item && timestamp && challengePeriodDuration
        ? itemToStatusCode(item, timestamp, challengePeriodDuration)
        : undefined,
    [item, timestamp, challengePeriodDuration],
  )
  const view = useMemo(
    () => standardEntryStatus(item, timestamp, challengePeriodDuration),
    [item, timestamp, challengePeriodDuration],
  )

  // A dialog belongs to the status it opened under. When the status moves
  // on while it is open (a period ends, someone else acts first), it closes
  // and says why: it used to vanish without a word, and the flag it left
  // set opened the next status's dialog by itself (Remove, after Execute).
  const shownStatus = useRef<number>()
  useEffect(() => {
    if (statusCode === undefined) return
    const previous = shownStatus.current
    shownStatus.current = statusCode
    if (previous === undefined || previous === statusCode || !modalOpen) return
    // The loser funded in its half: the same appeal dialog, for the same
    // side, now with the winner's deadline. It stays open with what was typed.
    if (
      previous === STATUS_CODE.CROWDFUNDING &&
      statusCode === STATUS_CODE.CROWDFUNDING_WINNER
    )
      return
    setModalOpen(false)
    const notice = statusChangeNotice(previous, statusCode)
    if (notice) infoToast(notice)
  }, [statusCode, modalOpen, setModalOpen])

  const executeGate = useActionGate({
    verb: 'execute the request',
    needsAuth: false,
  })
  // Busy until the transaction settles, so a second click (here or on the
  // phone bar) cannot send a second one.
  const [executing, setExecuting] = useState<SendPhase>()

  const executeRequest = async () => {
    if (!tcrAddress || !walletClient || !publicClient) return
    setExecuting('wallet')
    try {
      const { request: req } = await simulateContract(wagmiConfig, {
        address: tcrAddress as Address,
        abi: _gtcr,
        functionName: 'executeRequest',
        args: [item.itemID],
        account,
      })

      await wrapWithToast(
        () =>
          walletClient.writeContract(req).then((hash) => {
            setExecuting('mining')
            return hash
          }),
        publicClient,
      )
    } catch (err) {
      console.error('Error executing request:', err)
      errorToast(parseWagmiError(err))
    }
    setExecuting(undefined)
  }

  // The list's deposits and periods did not load: the card can tell
  // neither the status nor the amounts, and says so with a retry instead of
  // keeping its skeleton for ever.
  if (!challengePeriodDuration && tcrView?.paramsFailed)
    return (
      <Card id="item-status-card" $padding="standard">
        <Stack $gap={12}>
          <Notice tone="contested" role="alert">
            {LIST_SETTINGS_FAILED}
          </Notice>
          <div>
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              onClick={() => void tcrView.retryParams()}
            >
              Try again
            </Button>
          </div>
        </Stack>
      </Card>
    )

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

  const challengeCost = inWindow ? challenge.total : undefined
  const challengeBase = challenge.base
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
  // Once resolved, the outcome can differ from the jurors' last ruling: a
  // side that alone funded the last appeal wins (rule() in the list
  // contract). The request records that final outcome.
  const ruling = resolved
    ? (request.disputeOutcome ?? currentRuling)
    : currentRuling
  const rulingText =
    ruling === SUBGRAPH_RULING.ACCEPT
      ? `For the ${requesterName}`
      : ruling === SUBGRAPH_RULING.REJECT
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

  // Once one side is fully funded, the clock is the other side's (the loser
  // can be funded before its half is over).
  const funding = appealFunding(request, facts, statusCode)
  const prompt = isPending
    ? `The window closed ${formatAgo(windowEnd, now)} with no challenge. Anyone can execute it; the deposit returns to the ${requesterName}.`
    : funding
      ? `The ${funding.funded} is fully funded. The ${funding.pending} has ${formatDuration(funding.deadline - now)} to fund too, or loses.`
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
      loading={!!executing}
      loadingLabel={sendPhaseLabel(executing)}
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
      isPending && executeGate.fix ? (
        // The card names the blocker beside its control; the bar has room
        // for one button, so it offers the step that unblocks Execute
        // (connect, switch network) instead of a dead one.
        <Button
          type="button"
          $variant="primary"
          $block
          disabled={!!executeGate.fix.loading}
          onClick={executeGate.fix.onClick}
        >
          {executeGate.fix.label}
        </Button>
      ) : (
        <ItemActionButton
          statusCode={statusCode}
          itemName={itemName}
          itemID={item.itemID}
          onClick={onClick}
          amount={amountLabel}
          block
          disabled={isPending && !executeGate.ready}
          blocker={executeGate.blocker}
          loading={!!executing}
          loadingLabel={sendPhaseLabel(executing)}
        />
      )
    ) : null

  // The subgraph stores the request's base deposit: what a successful
  // challenger takes on top of their own deposit back (DESIGN.md's bounty).
  // It is the reason to challenge, so while a challenge is open it leads the
  // card and the cost becomes the guard behind it.
  const bounty =
    inWindow && !resolved && request.deposit !== undefined
      ? request.deposit
      : undefined
  // One sentence under the figure: what the bounty is made of and the cost
  // that guards it (DESIGN.md allows one, and the Label above already says
  // the figure is what a winning challenge takes).
  const bountyLine = amountLabel
    ? `The ${requesterName}’s deposit and your own back; challenging costs ${amountLabel}, so a careless challenge is not free.`
    : `The ${requesterName}’s deposit and your own back, if jurors agree the request breaks the listing policy.`
  const depositReturns = inWindow
    ? `Your deposit comes back in full if jurors agree with you. If they do not, it pays the arbitration and the ${requesterName} keeps the rest.`
    : 'It comes back in full once the request goes through unchallenged, or if jurors agree with you.'
  // The case panel below the hero carries the case and the ruling while one
  // is live; the card repeats neither.
  const caseInPanel = hasDispute && (inCourt || appealable)

  return (
    <>
      {/* While jurors decide there is nothing to do here: the case panel
          holds the state and both of its actions, and takes the id the
          phone bar steps aside for. */}
      {!inCourt && (
        <Card
          id="item-status-card"
          $padding="standard"
          role="region"
          aria-label="What you can do"
        >
          <Head>
            {bounty !== undefined ? (
              <>
                <Label $tone="faint">Win if your challenge succeeds</Label>
                <Amount title={formatAmount(bounty, nativeCurrency)}>
                  {formatEther(bounty)}
                  <small>{nativeCurrency}</small>
                </Amount>
                <Prompt>{bountyLine}</Prompt>
                <DepositBreakdown
                  total={buttonAmount}
                  base={amountBase}
                  cost={challenge.arbitrationCost}
                  baseLabel="Base deposit"
                  currency={nativeCurrency}
                  returns={depositReturns}
                />
              </>
            ) : (
              <>
                {heading && <Label $tone="faint">{heading}</Label>}
                {buttonAmount ? (
                  <>
                    <Amount title={amountLabel}>
                      {formatEther(buttonAmount)}
                      <small>{nativeCurrency}</small>
                    </Amount>
                    <DepositBreakdown
                      total={buttonAmount}
                      base={amountBase}
                      cost={
                        inWindow ? challenge.arbitrationCost : arbitrationCost
                      }
                      baseLabel="Base deposit"
                      currency={nativeCurrency}
                      returns={depositReturns}
                    />
                  </>
                ) : (
                  prompt && <Prompt>{prompt}</Prompt>
                )}
              </>
            )}
          </Head>

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
            {showRuling && !caseInPanel && (
              <div>
                <dt>Ruling</dt>
                <dd>{rulingText}</dd>
              </div>
            )}
            {hasDispute && !caseInPanel && (
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
      )}

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
            appealCostFailed={appealCostFailed}
            retryAppealCost={retryAppealCost}
          />
        )}
    </>
  )
}

export default ItemStatusCard
