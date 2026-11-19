import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styled, { css } from 'styled-components'
import type { BigNumber } from 'ethers'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import useNow from 'hooks/use-now'
import useTokenSymbol from 'hooks/token-symbol'
import useNativeCurrency from 'hooks/native-currency'
import useUrlChainId from 'hooks/use-url-chain-id'
import {
  formatAbsolute,
  formatDate,
  formatDuration,
  formatDurationLong,
} from 'utils/time'
import { STATUS_CODE } from 'utils/permanent-item-status'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { isKlerosArbitrator } from 'config/tcr-addresses'
import {
  Button,
  Label,
  SkeletonBlock,
  Small,
  Stack,
  Surface,
} from 'components/curate/primitives'
import { EntryStatus, stakeEntryStatus } from 'components/curate/entry-status'
import { StickyActionBar } from 'components/curate/item-standard-action-bar'
import { LaneBar } from 'components/curate/lane-bar'
import { BountyFigure } from 'components/curate/item-bounty-figure'
import ItemActionButton from 'components/permanent-item-action-button'
import { scrollToEvidenceComposer } from 'components/permanent-request-timelines'
import ItemActionModal from './item-action-modal'
import WithdrawModal from './modals/withdraw'
import AppealFundingCard from './crowdfunding-card'
import { WithdrawalStepper } from './withdrawal-stepper'
import {
  GateHelper,
  TX_PHASE_LABEL,
  applyMultiplier,
  formatTokenAmount,
  multiplierPercent,
  nativeText,
  tokenText,
  useActionGate,
  type TxPhase,
} from './modals/shell'
import {
  otherSide,
  stakeFacts,
  stakeStatusCode,
  toNum,
  type StakeItem,
  type StakeRegistry,
} from './facts'

export type { StakeChallenge, StakeItem, StakeRegistry } from './facts'
export { rulingSentence } from './facts'

/*
 * The status card of the Stake item page, which draws itself in two places:
 * its action in the hero, under the clock, as part of that panel rather
 * than a panel inside it (round 5: in the rail under the hero it had fallen
 * below the fold at 1440x900), and the withdrawal and the appeal funding in
 * the rail beside the history. While the entry can be challenged the card
 * leads with the bounty — the stake a correct challenger takes — as one
 * line, "Earn 9 sDAI", the verb as big as the amount, the same lead as the
 * Standard card's (rounds 4 and 5 of the design review; round 4 had only
 * reached the Standard card). Two short sentences then say what a challenge
 * is for, what filing it puts up and what winning returns in all, per coin.
 * An arbitration cost of zero is no cost: neither the button nor the
 * sentence names it. The stake-and-arbitration breakdown is the challenge dialog's,
 * before anything is signed (round 3: the card used to name the cost a
 * second time in words and to unfold that breakdown). Otherwise it
 * leads with the one thing to do now and its exact amount; off the list the
 * sentence says the stake stays locked and names the withdrawing period in
 * words, so no row below repeats it. Under it, the withdrawal as a
 * three-node stepper and, while an appeal is open, the funding of each
 * side. While jurors decide it renders no action card at all: the case
 * panel above holds the state and both of its actions, and takes the id the
 * phone bar steps aside for, so the bar's one control never doubles the
 * panel's. On phones the shared sticky bar repeats the one action while
 * this card is off screen and steps aside while it is on screen, so each
 * control shows once; the bar's copy has its own id.
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

const Sub = styled.span`
  margin-top: -4px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-variant-numeric: tabular-nums;
`

const Prompt = styled.p`
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
`

/*
 * The challenger's share of the stake at risk, drawn with the one bar
 * (LaneBar): a run in the chart's first hue as long as the share, with no
 * track behind it; the legend under it names the share and the stake.
 */
const ShareBar = styled.div`
  margin-top: 4px;
`

const ShareLegend = styled.ul`
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
    background: var(--viz-1);
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

const WithdrawalTop = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
`

const WithdrawalState = styled.span`
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
`

/** The challenger's share of the stake, as a bar that grows in. */
const ChallengerShare = ({
  share,
  amountText,
  percentText,
  verb,
  stakeText,
}: {
  share: number
  amountText: string
  percentText: string
  verb: string
  stakeText: string
}) => {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <div
      role="img"
      aria-label={`A challenger ${verb} ${amountText}, ${percentText} of the ${stakeText} at stake`}
    >
      <ShareBar aria-hidden>
        <LaneBar
          // No share, no run: nothing is drawn rather than a lone dot.
          runs={[
            {
              key: 'challenger',
              weight: share > 0 ? 1 : 0,
              hue: 'var(--viz-1)',
            },
          ]}
          extent={Math.min(1, Math.max(0, share))}
          armed={shown}
        />
      </ShareBar>
      <ShareLegend aria-hidden>
        <li>
          <i />
          Challenger {verb} <b>{amountText}</b>
        </li>
        <li>{percentText} of the stake</li>
      </ShareLegend>
    </div>
  )
}

interface ItemStatusCardProps {
  item?: StakeItem
  registry?: StakeRegistry
  timestamp?: BigNumber
  metaEvidence?: MetaEvidence
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  appealCost?: BigNumber
  /** The appeal cost could not be read, even after retrying. */
  appealCostFailed?: boolean
  onRetryAppealCost?: () => void
  /** What a new submission pays: the newest setting's arbitration cost. */
  arbitrationCost?: BigNumber
  /** What a challenge pays: the cost of the setting the contract picks for this entry. */
  challengeArbitrationCost?: BigNumber
  /** The submitter as the contract records it, else the subgraph's. */
  submitter?: string
  /** The policy this entry is judged by. */
  policyURI?: string
  /**
   * The hero's slot the action card draws itself into, bare. Until the slot
   * has mounted (null) nothing is drawn, so the card never flashes in place
   * first; without one (undefined) it renders where it is mounted, as a
   * panel. The phone bar and the dialogs always render where it is mounted.
   */
  heroSlot?: HTMLElement | null
  /** The same, for the withdrawal and the appeal funding panels. */
  railSlot?: HTMLElement | null
}

/** Into its slot when it has one, in place when it has none. */
const placeIn = (
  slot: HTMLElement | null | undefined,
  node: React.ReactNode,
) => (slot === undefined ? node : slot ? createPortal(node, slot) : null)

const ItemStatusCard = ({
  item,
  registry,
  timestamp,
  metaEvidence,
  modalOpen,
  setModalOpen,
  appealCost,
  appealCostFailed,
  onRetryAppealCost,
  arbitrationCost,
  challengeArbitrationCost,
  submitter: submitterProp,
  policyURI,
  heroSlot,
  railSlot,
}: ItemStatusCardProps) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const now = useNow()
  const chainId = useUrlChainId()
  const nativeCurrency = useNativeCurrency()
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [executePhase, setExecutePhase] = useState<TxPhase>()
  const { symbol: tokenSymbol, decimals: tokenDecimals } = useTokenSymbol(
    registry?.token,
  )
  const executeGate = useActionGate('execute the withdrawal')

  const statusCode =
    item && timestamp && registry
      ? stakeStatusCode(item, timestamp, registry)
      : undefined

  const bare = heroSlot !== undefined

  if (!item || !timestamp || !registry || statusCode === undefined)
    return placeIn(
      heroSlot,
      <Card
        $padding="standard"
        $bare={bare}
        aria-busy="true"
        aria-label="Loading status"
      >
        <SkeletonBlock $height="16px" $width="50%" />
        <SkeletonBlock $height="44px" $width="60%" />
        <SkeletonBlock $height="44px" />
      </Card>,
    )

  const view = stakeEntryStatus(item, timestamp, registry)
  const facts = stakeFacts({ item, registry, statusCode, chainId })
  const {
    offList,
    withdrawingAt,
    withdrawingPeriod,
    withdrawReadyAt,
    isWithdrawable,
    withdrawalStage,
    challenge,
    appealHalf,
    appealEnd,
    appealable,
    refusedToRule,
    fundedSide,
    underDispute,
    inCourt,
    loserName,
    winnerName,
    challengedAt,
  } = facts
  const itemName = metaEvidence?.metadata?.itemName || 'item'
  const submitter = submitterProp ?? item.submitter
  const isSubmitter =
    !!account &&
    !!submitter &&
    account.toLowerCase() === submitter.toLowerCase()

  const stakeText = tokenText(item.stake, tokenDecimals, tokenSymbol)
  const minStake = registry.submissionMinDeposit ?? 0
  const minStakeText = tokenText(minStake, tokenDecimals, tokenSymbol)
  // The chain's coin in words, left out where it shows as nothing: an
  // arbitrator that charges nothing, or a few gwei below the precision the
  // card shows, made the button read "0.025 sDAI + 0 xDAI" and the sentence
  // speak of an arbitration cost that is not there. The dialog that signs
  // the challenge still states the exact amount. The entry's deposit is
  // undefined while unknown, so a total is stated only once it is read,
  // and in the token alone when the deposit shows as nothing.
  const shownNative = (amount: BigNumber | string | null | undefined) =>
    amount === undefined ||
    amount === null ||
    formatTokenAmount(String(amount), 18, 5) === '0'
      ? undefined
      : nativeText(String(amount), nativeCurrency)
  const depositKnown =
    item.arbitrationDeposit !== undefined && item.arbitrationDeposit !== null
  const depositText = shownNative(item.arbitrationDeposit)
  const multiplier = registry.challengeStakeMultiplier
  const challengerStake = applyMultiplier(item.stake, multiplier)
  const challengerText = tokenText(challengerStake, tokenDecimals, tokenSymbol)
  const costText = shownNative(arbitrationCost)
  const challengeCostText = shownNative(challengeArbitrationCost)
  // While disputed the challenger's stake is on record; before, it is the
  // list's share of the entry's stake.
  const stakedByChallenger =
    underDispute && challenge?.challengerStake
      ? BigInt(String(challenge.challengerStake))
      : challengerStake
  const stakeWei = BigInt(String(item.stake || 0))
  const challengerShare =
    stakeWei > 0n
      ? Number((stakedByChallenger * 10_000n) / stakeWei) / 10_000
      : 0

  const executeWithdrawal = async () => {
    if (!walletClient || !publicClient) return
    setExecutePhase('wallet')
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: registry.id,
        abi: _gtcr,
        functionName: 'withdrawItem',
        args: [item.itemID],
        account,
      })

      await wrapWithToast(
        () =>
          walletClient.writeContract(request).then((hash) => {
            // Signed: the chain has yet to confirm it.
            setExecutePhase('mining')
            return hash
          }),
        publicClient,
      )
    } catch (err) {
      console.error('Error executing withdrawal:', err)
      errorToast(parseWagmiError(err))
    }
    setExecutePhase(undefined)
  }

  const onAction = () => {
    switch (statusCode) {
      case STATUS_CODE.REJECTED:
      case STATUS_CODE.REMOVED:
      case STATUS_CODE.WITHDRAWN:
      case STATUS_CODE.PENDING:
      case STATUS_CODE.ACCEPTED:
      case STATUS_CODE.CROWDFUNDING:
      case STATUS_CODE.CROWDFUNDING_WINNER:
        setModalOpen(true)
        return
      case STATUS_CODE.PENDING_WITHDRAWAL:
        void executeWithdrawal()
        return
      case STATUS_CODE.DISPUTED:
      case STATUS_CODE.WAITING_ARBITRATOR:
        return
      default:
        throw new Error(`Unhandled status code ${statusCode}`)
    }
  }

  const challengeable =
    statusCode === STATUS_CODE.PENDING || statusCode === STATUS_CODE.ACCEPTED
  const amounts = challengeable
    ? challengeCostText
      ? `${challengerText} + ${challengeCostText}`
      : challengerText
    : offList
      ? costText
        ? `${minStakeText} + ${costText}`
        : minStakeText
      : undefined
  const directAction = statusCode === STATUS_CODE.PENDING_WITHDRAWAL
  const actionBlocker =
    directAction && !executeGate.ready ? executeGate.blocker : undefined

  const actionButton = (id?: string) =>
    inCourt ? null : (
      <ItemActionButton
        id={id}
        statusCode={statusCode}
        itemName={itemName}
        itemID={item.itemID}
        onClick={onAction}
        type="primary"
        amounts={amounts}
        disabled={Boolean(actionBlocker)}
        blocker={actionBlocker}
        loading={!!executePhase}
        loadingLabel={executePhase && TX_PHASE_LABEL[executePhase]}
        block
      />
    )

  /* ---------- The figure ---------- */

  // While the entry can be challenged the figure is the bounty: the stake a
  // challenger the jurors agree with takes, on top of their own stake back
  // (DESIGN.md's bounty for a Stake list). It is the reason to challenge,
  // so it leads the card as "Earn 9 sDAI" (BountyFigure) and needs no label.
  // The exact amounts a challenge costs are on the button below and in the
  // challenge dialog, not behind the figure. Every other state labels its
  // figure.
  const figureLabel = offList
    ? 'Stake to resubmit'
    : directAction
      ? 'Returns to the submitter'
      : 'Stake at risk'
  const figureAmount = offList ? minStake : item.stake
  // Under the bounty the sentence names the entry's arbitration deposit in
  // the total a win returns, so a line of its own would say it twice.
  const figureSub = offList
    ? costText
      ? `Minimum, plus ${costText} arbitration deposit`
      : 'Minimum stake'
    : challengeable || !depositText
      ? undefined
      : `Plus ${depositText} arbitration deposit`

  // The loser can be fully funded before the half: then the winner's clock
  // runs, as in the second half.
  const loserFunded = fundedSide === loserName
  // A Stake list has no removal requests, so the stake behind a
  // resubmission is not refunded by a period running out: it stays locked
  // while the entry is listed. The withdrawing period is named here in
  // words, so the row that repeated it below is gone.
  const lockedLine = withdrawingPeriod
    ? `This stake stays locked while the ${itemName} is listed; it comes back when the submitter withdraws it and the withdrawing period of ${formatDurationLong(withdrawingPeriod)} ends.`
    : `This stake stays locked while the ${itemName} is listed; it comes back when the submitter withdraws it.`
  /*
   * Under the bounty, the Standard card's shape (round 4, "straight to the
   * point"): what a challenge is for, then the deposit filing it puts up
   * and why (so nobody files a frivolous one, asked for in rounds 3 and 4),
   * and what a win returns in all, with the real figures, about 150
   * characters (the sentence it replaces ran to 337, eight lines of the
   * 312px column). The
   * total is what PermanentGTCR.rule() pays a winning challenger: the
   * entry's stake and their own stake back in the list's token, and the
   * entry's arbitration deposit in the chain's coin. The arbitration cost
   * the challenger pays is spent on the case and does not come back, so it
   * is in what filing takes and not in the total. Two coins, so each figure
   * names both and adds neither (DESIGN.md: amounts stay per coin), the way
   * the button prices the challenge; a coin whose amount is zero is left
   * out of both. Jurors are named only where the arbitrator is Kleros.
   */
  const decider = isKlerosArbitrator(chainId, registry.arbitrator?.id)
    ? 'jurors agree'
    : 'the arbitrator agrees'
  const staked = challengerStake > 0n
  const filing = [staked ? challengerText : undefined, challengeCostText]
    .filter(Boolean)
    .join(' + ')
  const winToken = tokenText(
    stakeWei + challengerStake,
    tokenDecimals,
    tokenSymbol,
  )
  const winTotal = !depositKnown
    ? undefined
    : depositText
      ? `${winToken} + ${depositText}`
      : winToken
  // A figure never parts from its coin across a line break, nor a sum of
  // two coins from itself ("4.5 sDAI + 7.2 xDAI" is one run).
  const unbroken = (text: string) => text.replace(/ /g, '\u00A0')
  const winClause = winTotal
    ? `if ${decider}, you get ${unbroken(winTotal)}.`
    : ''
  const bountyLine = [
    'Found something that breaks the policy? Challenge it and win the bounty.',
    filing
      ? `A ${unbroken(filing)} deposit keeps challenges serious${winClause ? `; ${winClause}` : '.'}`
      : winClause.charAt(0).toUpperCase() + winClause.slice(1),
  ]
    .filter(Boolean)
    .join(' ')
  // In court there is no card and nothing to sign: the case panel above
  // says where the case stands.
  const prompt = challengeable
    ? bountyLine
    : appealable
      ? refusedToRule
        ? fundedSide
          ? `Jurors refused to rule. The ${fundedSide} funded an appeal; the ${otherSide(fundedSide)} has ${formatDuration(appealEnd - now)} to fund too, or loses.`
          : `Jurors refused to rule. If one side fully funds an appeal by ${formatAbsolute(appealEnd)}, the other must fund too or loses.`
        : statusCode === STATUS_CODE.CROWDFUNDING && !loserFunded
          ? `The ${loserName} has ${formatDuration(appealHalf - now)} to fund an appeal, or the ruling stands.`
          : `The ${loserName} funded the appeal. The ${winnerName} has ${formatDuration(appealEnd - now)} to fund too, or loses.`
      : offList
        ? lockedLine
        : undefined

  const submissionPeriod = toNum(registry.submissionPeriod)

  /* ---------- Withdrawal ---------- */

  const showWithdrawal = !offList || statusCode === STATUS_CODE.WITHDRAWN
  // The contract blocks the execution while disputed and settles the
  // withdrawal with the ruling, so its clock stops meaning anything: the
  // drawing holds where it was when the dispute began.
  const paused = underDispute && withdrawalStage === 'withdrawing'
  const clock = paused
    ? Math.max(withdrawingAt, Math.min(now, challengedAt || now))
    : now
  const elapsed =
    withdrawingPeriod > 0
      ? Math.min(1, Math.max(0, (clock - withdrawingAt) / withdrawingPeriod))
      : 1
  const periodShort = withdrawingPeriod
    ? formatDuration(withdrawingPeriod)
    : undefined
  const periodLong = withdrawingPeriod
    ? formatDurationLong(withdrawingPeriod)
    : undefined
  const withdrawalState =
    withdrawalStage === 'listed'
      ? 'Not started'
      : paused
        ? 'Paused by the dispute'
        : withdrawalStage === 'withdrawing'
          ? `${formatDuration(withdrawReadyAt - now)} left`
          : withdrawalStage === 'ready'
            ? 'Ready to execute'
            : 'Completed'
  const withdrawalLine =
    withdrawalStage === 'listed'
      ? `${isSubmitter ? 'Only you, the submitter, can start it' : 'Only the submitter can start it'}.${
          periodLong
            ? ` The ${itemName} stays listed and challengeable for ${periodLong} after.`
            : ''
        }`
      : withdrawalStage === 'withdrawing'
        ? paused
          ? `It resolves with the ruling: if the jurors keep the ${itemName} it is withdrawn at once; if they remove it, the withdrawal is void.`
          : `Still challengeable until ${formatAbsolute(withdrawReadyAt)}.`
        : withdrawalStage === 'ready'
          ? `Anyone can execute it: ${depositText ? `${stakeText} + ${depositText}` : stakeText} return to the submitter.`
          : 'Stake and arbitration deposit returned to the submitter.'
  const withdrawalLabel = `Withdrawal: ${
    withdrawalStage === 'listed'
      ? 'not started'
      : paused
        ? `started ${formatAbsolute(withdrawingAt)}, paused by the dispute at ${Math.round(elapsed * 100)}% of the ${periodLong ?? 'withdrawing period'}; it resolves with the ruling`
        : withdrawalStage === 'withdrawing'
          ? `started ${formatAbsolute(withdrawingAt)}, ${Math.round(elapsed * 100)}% of the ${periodLong ?? 'withdrawing period'} elapsed, executable from ${formatAbsolute(withdrawReadyAt)}`
          : withdrawalStage === 'ready'
            ? `ready to execute since ${formatAbsolute(withdrawReadyAt)}`
            : 'completed'
  }`

  const withdrawButton =
    isWithdrawable && isSubmitter ? (
      <Button
        type="button"
        $variant="secondary"
        $block
        onClick={() => setWithdrawModalOpen(true)}
      >
        Withdraw {itemName}
      </Button>
    ) : null

  const barAction =
    statusCode === STATUS_CODE.DISPUTED ? (
      <Button
        type="button"
        $variant="primary"
        $block
        onClick={scrollToEvidenceComposer}
      >
        Add evidence
      </Button>
    ) : (
      actionButton('item-action-button-mobile')
    )

  return (
    <>
      {/* While jurors decide there is nothing to do here: the case panel
          above holds the state and both of its actions, and takes the id
          the phone bar steps aside for. */}
      {!inCourt &&
        placeIn(
          heroSlot,
          <Card
            id="item-status-card"
            $padding="standard"
            $bare={bare}
            role="region"
            aria-label="What you can do"
          >
            <Head>
              {challengeable ? (
                <BountyFigure
                  amount={formatTokenAmount(item.stake, tokenDecimals)}
                  symbol={tokenSymbol}
                  title={stakeText}
                  countUp
                />
              ) : (
                // Only a bounty is drawn large (round 9): any other state
                // says its amount in one muted line.
                <Sub>
                  {figureLabel}:{' '}
                  {tokenText(figureAmount, tokenDecimals, tokenSymbol)}
                  {figureSub ? ` · ${figureSub}` : ''}
                </Sub>
              )}
              {challengeable && figureSub && <Sub>{figureSub}</Sub>}
              {prompt && <Prompt>{prompt}</Prompt>}
              {/* Nothing is drawn while the entry can be challenged: the
                bounty, the sentence and the button carry it, and round 3 of
                the design review took the breakdown off the card. */}
              {!challengeable && !offList && !directAction && stakeWei > 0n && (
                <ChallengerShare
                  share={challengerShare}
                  amountText={tokenText(
                    stakedByChallenger,
                    tokenDecimals,
                    tokenSymbol,
                  )}
                  percentText={
                    challenge?.challengerStake
                      ? `${Math.round(challengerShare * 100)}%`
                      : multiplierPercent(multiplier)
                  }
                  verb="staked"
                  stakeText={stakeText}
                />
              )}
            </Head>

            <Stack $gap={8}>
              {actionButton()}
              {directAction && <GateHelper gate={executeGate} />}
            </Stack>

            {offList && (
              <Rows>
                <div>
                  <dt>Submission period</dt>
                  <dd
                    title={
                      submissionPeriod
                        ? formatDurationLong(submissionPeriod)
                        : 'Accepted at once'
                    }
                  >
                    {submissionPeriod
                      ? formatDuration(submissionPeriod)
                      : 'None'}
                  </dd>
                </div>
              </Rows>
            )}
          </Card>,
        )}

      {placeIn(
        railSlot,
        <>
          {appealable && (
            <AppealFundingCard
              item={item}
              registry={registry}
              timestamp={timestamp}
              appealCost={appealCost}
            />
          )}

          {showWithdrawal && (
            <Card
              $padding="standard"
              role="region"
              aria-label="Withdrawal"
              style={{ gap: 20 }}
            >
              <WithdrawalTop>
                <Label $tone="faint">Withdrawal</Label>
                <WithdrawalState
                  title={
                    withdrawalStage === 'withdrawing' && !paused
                      ? `Executable from ${formatAbsolute(withdrawReadyAt)}`
                      : undefined
                  }
                >
                  {withdrawalState}
                </WithdrawalState>
              </WithdrawalTop>
              <WithdrawalStepper
                stage={withdrawalStage}
                elapsed={elapsed}
                paused={paused}
                label={withdrawalLabel}
                notes={[
                  withdrawalStage === 'listed' ? (
                    'Submitter only'
                  ) : withdrawingAt ? (
                    <span title={formatAbsolute(withdrawingAt)}>
                      {formatDate(withdrawingAt)}
                    </span>
                  ) : undefined,
                  paused
                    ? `Paused at ${Math.round(elapsed * 100)}%`
                    : withdrawalStage === 'withdrawing' && periodShort
                      ? `${Math.round(elapsed * 100)}% of ${periodShort}`
                      : periodShort,
                  withdrawalStage === 'ready' ? (
                    <span title={formatAbsolute(withdrawReadyAt)}>
                      since {formatDate(withdrawReadyAt)}
                    </span>
                  ) : withdrawalStage === 'withdrawn' && facts.endedAt ? (
                    <span title={formatAbsolute(facts.endedAt)}>
                      {formatDate(facts.endedAt)}
                    </span>
                  ) : (
                    'Anyone'
                  ),
                ]}
              />
              <Small $muted>{withdrawalLine}</Small>
              {withdrawButton}
            </Card>
          )}
        </>,
      )}

      {view && (
        <StickyActionBar
          status={<EntryStatus status={view} now={now} />}
          action={barAction}
          evidence={statusCode === STATUS_CODE.DISPUTED}
        />
      )}

      {!inCourt && (
        <ItemActionModal
          statusCode={statusCode}
          itemName={itemName}
          item={item}
          metaEvidence={metaEvidence}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          appealCost={appealCost}
          appealCostFailed={appealCostFailed}
          onRetryAppealCost={onRetryAppealCost}
          arbitrationCost={arbitrationCost}
          challengeArbitrationCost={challengeArbitrationCost}
          policyURI={policyURI}
        />
      )}
      <WithdrawModal
        isOpen={withdrawModalOpen}
        onCancel={() => setWithdrawModalOpen(false)}
        item={item}
        registry={registry}
        itemName={itemName}
        submitter={submitter}
      />
    </>
  )
}

export default ItemStatusCard
