import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styled, { css } from 'styled-components'
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
import { isKlerosArbitrator } from 'config/tcr-addresses'
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
import { useResubmit } from 'pages/submit-item/resubmit'
import { StickyActionBar } from 'components/curate/item-standard-action-bar'
import { ExplorerAddressLink } from 'components/curate/item-standard-fields'
import { BountyFigure } from 'components/curate/item-bounty-figure'
import {
  formatAmount,
  formatEther,
  groupThousands,
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
 * The action card. It draws itself in the entry page's hero, under the
 * clock, as part of that panel rather than a panel inside it (round 5: in
 * the rail under the hero it had fallen below the fold at 1440x900 in every
 * state); at 1000px and below a fixed bottom bar carries its action as
 * well. While a challenge is open it leads with the bounty — the money a
 * correct challenger takes — as one line, "Earn 30 xDAI", the verb as big
 * as the amount (round 5). Two short sentences then say what a challenge
 * is for, what filing it takes and what winning returns in all (round 4:
 * "straight to the point"); a removal request opens them the other way
 * round, because challenging a removal defends the entry. The deposit's base and
 * arbitration split is the dialog's, where DESIGN.md asks for it (round 3:
 * the card used to name the cost a second time in words and to unfold that
 * split, which the dialog that sends the transaction carries anyway).
 * Otherwise it leads with the one thing to do now, its exact amount and one
 * sentence that names the challenge period in words, so no row below
 * repeats that duration. While jurors decide it renders no card at all: the
 * case panel holds the state and both of its actions, and the phone bar
 * keeps its one control — the panel carries the id that bar steps aside
 * for, so the two never offer the same button at once. The ruling and the
 * case are never rows here while a panel below the hero states them: the
 * live case panel, or the court record once the ruling stands.
 */

/* `$bare` when it is drawn inside the hero: no border, fill, shadow or
   padding of its own, because a panel inside a panel is a stack
   (DESIGN.md). */
const Card = styled(Surface)<{ $bare?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 18px;

  ${({ $bare }) =>
    $bare &&
    css`
      padding: 0;
      border: 0;
      border-radius: 0;
      background: none;
      box-shadow: none;
    `}
`

const Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
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

  /* The case link only: the arbitrator's address is a ChromeAddress, which
     styles its own link. */
  dd > a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--color-primary);
    text-decoration: none;
  }

  dd > a:hover {
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
  /**
   * The court record under the hero holds this request's case: its ruling
   * stands, or it was resolved. The card then repeats neither the ruling
   * nor the case, as it does not while the live case panel holds them.
   */
  caseInRecord?: boolean
  /**
   * The hero's slot the card draws itself into, bare. Until the slot has
   * mounted (null) nothing is drawn, so the card never flashes in place
   * first; without one (undefined) it renders where it is mounted, as a
   * panel. The phone bar and the dialogs always render where it is mounted.
   */
  heroSlot?: HTMLElement | null
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
  caseInRecord = false,
  heroSlot,
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
  } = tcrView || {}
  const urlChainId = useUrlChainId()
  const nativeCurrency = useNativeCurrency()
  const now = useNow()
  const resubmit = useResubmit()
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

  const bare = heroSlot !== undefined
  const place = (card: React.ReactElement) =>
    heroSlot === undefined
      ? card
      : heroSlot
        ? createPortal(card, heroSlot)
        : null

  // The list's deposits and periods did not load: the card can tell
  // neither the status nor the amounts, and says so with a retry instead of
  // keeping its skeleton for ever.
  if (!challengePeriodDuration && tcrView?.paramsFailed)
    return place(
      <Card id="item-status-card" $padding="standard" $bare={bare}>
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
      </Card>,
    )

  if (!item || !timestamp || !challengePeriodDuration || !request)
    return place(
      <Card
        id="item-status-card"
        $padding="standard"
        $bare={bare}
        aria-busy="true"
      >
        <SkeletonBlock $height="16px" $width="50%" />
        <SkeletonBlock $height="44px" $width="60%" />
        <SkeletonBlock $height="44px" />
      </Card>,
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
      // Off the list: the submit page, its fields filled with the entry's.
      case STATUS_CODE.REJECTED:
      case STATUS_CODE.REMOVED: {
        resubmit(metadata?.columns, item.decodedData)
        break
      }
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
        // The bar's copy of the card's button: an id of its own, as on Stake.
        <ItemActionButton
          id="item-action-button-mobile"
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
  // dialog that sends the transaction, not behind the figure. Until the
  // request's deposit is read there is no figure to lead with, and the card
  // falls back to the cost of challenging. A list whose base deposit is 0
  // has no bounty either: "Earn 0 xDAI" is not a reason to challenge.
  const noBounty =
    request.deposit !== undefined && BigNumber.from(request.deposit).isZero()
  const bounty =
    inWindow && !resolved && request.deposit !== undefined && !noBounty
      ? request.deposit
      : undefined
  /*
   * Under the figure, the owner's shape from round 4, straight to the
   * point: what a challenge is for, then the deposit filing it takes and
   * why (round 3 and round 4 both asked for the reason: so nobody files a
   * frivolous challenge), and what a win returns in all, with the real
   * figures (about 150 characters; the three-clause sentence it replaces
   * ran to twice that). The total is the
   * bounty plus the challenger's own deposit back, stated only where both
   * halves are known; otherwise the sentence says it in words, without the
   * figure the card is already leading with.
   *
   * A registration is challenged for breaking the policy. A removal request
   * is the opposite case: its challenger argues the entry still follows the
   * policy and should stay, so the sentence opens that way (the audit found
   * the removal box telling its challenger the entry broke the policy). The
   * bounty is then the removal requester's deposit, and the rest holds for
   * both. Jurors are named only where the arbitrator is Kleros, as in the
   * page's explainer, here and in the deposit sentence below: an open
   * request is decided by the arbitrator it was made with, a new one by the
   * list's.
   */
  const decider = isKlerosArbitrator(
    urlChainId,
    resolved ? tcrView?.arbitrator : request.arbitrator,
  )
    ? 'jurors agree'
    : 'the arbitrator agrees'
  const opening =
    statusCode === STATUS_CODE.REMOVAL_REQUESTED
      ? `Does this ${itemName} still follow the policy? Challenge the removal${noBounty ? '.' : ' and win the bounty.'}`
      : `Found something that breaks the policy? Challenge it${noBounty ? '.' : ' and win the bounty.'}`
  const challengeTotal =
    bounty !== undefined && challengeCost !== undefined
      ? formatAmount(BigNumber.from(bounty).add(challengeCost), nativeCurrency)
      : undefined
  // A figure never parts from its coin across a line break.
  const unbroken = (text: string) => text.replace(/ /g, '\u00A0')
  const bountyLine =
    challengeTotal && challengeCost !== undefined
      ? `${opening} A ${unbroken(formatAmount(challengeCost, nativeCurrency))} deposit keeps challenges serious; if ${decider}, you get ${unbroken(challengeTotal)}.`
      : noBounty
        ? `${opening} ${challengeCost !== undefined ? `A ${unbroken(formatAmount(challengeCost, nativeCurrency))} deposit` : 'A deposit of your own'} keeps challenges serious; if ${decider}, it comes back.`
        : `${opening} A deposit of your own keeps challenges serious; if ${decider}, it comes back with the bounty.`
  // The sentence for the states that have no bounty to lead with: what the
  // figure backs, and when it comes back, with the period in words. A
  // challenge whose bounty the indexer did not record leads with its cost
  // and keeps the challenge sentence, without the total it cannot state; it
  // no longer says what a lost deposit pays for, the clause round 3 removed.
  const depositLine = inWindow
    ? bountyLine
    : statusCode === STATUS_CODE.REGISTERED || isResubmit
      ? `${isResubmit ? 'A resubmission' : 'A removal request'} has to be backed by a deposit; it comes back in full once the challenge period of ${challengePeriodText} ends and the request is executed, or when ${decider} with you.`
      : undefined
  // A panel below the hero carries the case and the ruling: the case panel
  // while one is live, the court record once its ruling stands. The card
  // repeats neither (the audit found "Ruling" and "Court case" stated in
  // the card and again in the record right under it).
  const caseInPanel = hasDispute && (inCourt || appealable || caseInRecord)
  // Both rows are about a dispute, so an entry that was never challenged has
  // none of them. Rows carries the hairline that separates it from the
  // button, so an empty list would leave that line floating on its own.
  const hasRows = !caseInPanel && (showRuling || hasDispute)

  return (
    <>
      {/* While jurors decide there is nothing to do here: the case panel
          holds the state and both of its actions, and takes the id the
          phone bar steps aside for. */}
      {!inCourt &&
        place(
          <Card
            id="item-status-card"
            $padding="standard"
            $bare={bare}
            role="region"
            aria-label="What you can do"
          >
            <Head>
              {bounty !== undefined ? (
                <>
                  <BountyFigure
                    amount={groupThousands(formatEther(bounty))}
                    symbol={nativeCurrency}
                    title={formatAmount(bounty, nativeCurrency)}
                  />
                  <Prompt>{bountyLine}</Prompt>
                </>
              ) : (
                <>
                  {/* Only a bounty is drawn large (round 9: "it should be
                      that huge only when it is earn"): any other action is
                      its sentence and its button, which carries the
                      amount. */}
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
                          <ExplorerAddressLink address={request.arbitrator} />
                        </>
                      )}
                    </dd>
                  </div>
                )}
              </Rows>
            )}
          </Card>,
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
        evidence={statusCode === STATUS_CODE.CHALLENGED}
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
            metaEvidence={metaEvidence}
            appealCost={appealCost}
            appealCostFailed={appealCostFailed}
            retryAppealCost={retryAppealCost}
          />
        )}
    </>
  )
}

export default ItemStatusCard
