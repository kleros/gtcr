import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import type { Address } from 'viem'
import { BigNumber } from 'ethers'
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
 * and one sentence says that winning it takes a deposit of your own and
 * when that deposit comes back (round 3 of the design review: the card used
 * to name the cost a second time in words and to unfold its base and
 * arbitration split, which the dialog that sends the transaction carries
 * anyway, where DESIGN.md asks for it). Otherwise it leads with the one
 * thing to do now, its exact amount and one sentence that names the
 * challenge period in words, so no row below repeats that duration. While
 * jurors decide it renders no card at all: the case panel holds the state
 * and both of its actions, and the phone bar keeps its one control — the
 * panel carries the id that bar steps aside for, so the two never offer the
 * same button at once.
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

const Amount = styled.div<{ $lead?: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: ${({ $lead }) => ($lead ? '56px' : '44px')};
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
  const isResubmit =
    statusCode === STATUS_CODE.REJECTED || statusCode === STATUS_CODE.REMOVED
  const buttonAmount = inWindow
    ? challengeCost
    : statusCode === STATUS_CODE.REGISTERED
      ? removalDeposit
      : isResubmit
        ? submissionDeposit
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

  // The challenge period in words, for the sentence that stands where the
  // breakdown pill used to: the row that repeated the same duration below
  // the button is gone, so the card states it once.
  const challengePeriodText = formatDurationLong(
    challengePeriodDuration.toNumber(),
  )

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
  // card. The exact cost of challenging is on the button below and in the
  // dialog that sends the transaction, not behind the figure.
  const bounty =
    inWindow && !resolved && request.deposit !== undefined
      ? request.deposit
      : undefined
  /*
   * Under the figure: why anyone would do this, in the order it happens.
   * Filing takes a deposit, which is what keeps frivolous challenges off the
   * list; win and both come back together, so the sentence ends on the one
   * number a challenger actually wants — the bounty plus their own deposit
   * back. That total is only stated where both halves are known.
   */
  const challengeTotal =
    bounty !== undefined && challengeCost !== undefined
      ? formatAmount(BigNumber.from(bounty).add(challengeCost), nativeCurrency)
      : undefined
  const bountyLine = `Found something that breaks this list's policy? Challenge the ${itemName} and the bounty is yours if jurors agree. Filing takes a deposit of your own, so a challenge nobody believes in costs something${
    challengeTotal
      ? `; win, and your deposit comes back with the bounty on top — ${challengeTotal} in all.`
      : '; win, and your deposit comes back with the bounty on top.'
  }`
  // The same sentence for the states that have no bounty to lead with: what
  // the figure backs, and when it comes back, with the period in words.
  const depositLine = inWindow
    ? `A challenge has to be backed by a deposit; it comes back in full if jurors agree with you, and if they do not it pays the arbitration and the ${requesterName} keeps the rest.`
    : statusCode === STATUS_CODE.REGISTERED || isResubmit
      ? `${isResubmit ? 'A resubmission' : 'A removal request'} has to be backed by a deposit; it comes back in full once the challenge period of ${challengePeriodText} ends and the request is executed, or when jurors agree with you.`
      : undefined
  // The case panel below the hero carries the case and the ruling while one
  // is live; the card repeats neither.
  const caseInPanel = hasDispute && (inCourt || appealable)
  // Both rows are about a dispute, so an entry that was never challenged has
  // none of them. Rows carries the hairline that separates it from the
  // button, so an empty list would leave that line floating on its own.
  const hasRows = !caseInPanel && (showRuling || hasDispute)

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
                <Label $tone="faint">Earn</Label>
                <Amount $lead title={formatAmount(bounty, nativeCurrency)}>
                  {formatEther(bounty)}
                  <small>{nativeCurrency}</small>
                </Amount>
                <Prompt>{bountyLine}</Prompt>
              </>
            ) : (
              <>
                {heading && <Label $tone="faint">{heading}</Label>}
                {buttonAmount && (
                  <Amount title={amountLabel}>
                    {formatEther(buttonAmount)}
                    <small>{nativeCurrency}</small>
                  </Amount>
                )}
                {depositLine ? (
                  <Prompt>{depositLine}</Prompt>
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

          {hasRows && (
            <Rows>
              {showRuling && (
                <div>
                  <dt>Ruling</dt>
                  <dd>{rulingText}</dd>
                </div>
              )}
              {hasDispute && (
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
          )}
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
