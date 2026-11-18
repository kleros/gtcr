import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
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
import {
  Button,
  Label,
  SkeletonBlock,
  Small,
  Stack,
  Surface,
} from 'components/curate/primitives'
import { EntryStatus, stakeEntryStatus } from 'components/curate/entry-status'
import { DisclosurePill } from 'components/curate/item-disclosure-pill'
import { StickyActionBar } from 'components/curate/item-standard-action-bar'
import { CountUpText } from 'components/curate/registry-shared-count'
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
 * The right rail of the Stake item page. While the entry can be challenged
 * the card leads with the bounty — the stake a correct challenger takes —
 * and what a challenge costs follows as the guard that keeps careless
 * challenges out, with the stake to match and the arbitration cost one pill
 * away (the design review's point 4: the card used to lead with the stake
 * the submitter has at risk and the share a challenger must put up).
 * Otherwise it leads with the one thing to do now and its exact amount.
 * Under it, the withdrawal as a three-node stepper and, while an appeal is
 * open, the funding of each side. While jurors decide it renders no action
 * card at all: the case panel above holds the state and both of its
 * actions, and takes the id the phone bar steps aside for, so the bar's one
 * control never doubles the panel's. On phones the
 * shared sticky bar repeats the one action while this card is off screen
 * and steps aside while it is on screen, so each control shows once; the
 * bar's copy has its own id.
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
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 44px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;

  small {
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0;
  }
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

/* The stake at risk as the whole track; the fill is the challenger's share. */
const ShareTrack = styled.div`
  position: relative;
  height: 8px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: repeating-linear-gradient(
    135deg,
    var(--color-raised) 0 3px,
    transparent 3px 7px
  );
  box-shadow: inset 0 0 0 1px var(--glass-border);
`

const ShareFill = styled.span`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: var(--radius-pill);
  /* A chart category, so a viz colour: never the accent, never a status
     role (DESIGN.md). */
  background: var(--viz-1);
  box-shadow: 0 0 12px color-mix(in srgb, var(--viz-1) 55%, transparent);
  transition:
    width 900ms var(--ease-out),
    min-width 900ms var(--ease-out);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
  const width = Math.round(Math.min(1, Math.max(0, share)) * 100)
  return (
    <div
      role="img"
      aria-label={`A challenger ${verb} ${amountText}, ${percentText} of the ${stakeText} at stake`}
    >
      <ShareTrack aria-hidden>
        <ShareFill
          style={{
            width: shown ? `${width}%` : '0%',
            minWidth: shown && width > 0 ? 8 : 0,
          }}
        />
      </ShareTrack>
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

/**
 * What a challenge costs and when it comes back, one pill away: DESIGN.md
 * asks for the total and the breakdown before anything is signed, and the
 * design review asked for neither to be the headline (the challenge dialog
 * carries the full receipt again). A Stake challenge is priced in two
 * assets, so the breakdown stays per coin — amounts are never added across
 * coins — and the one chart compares like with like: the stake the
 * challenger matches against the stake already on the entry.
 */
const ChallengeCost = ({
  share,
  stakeText,
  percentText,
  entryStakeText,
  costText,
  itemName,
}: {
  share: number
  /** What the challenger must stake, in the list's token. */
  stakeText: string
  percentText: string
  entryStakeText: string
  /** The arbitration cost, in the chain's currency. */
  costText?: string
  itemName: string
}) => {
  const [open, setOpen] = useState(false)
  return (
    <Stack $gap={10}>
      <DisclosurePill
        icon="layers"
        open={open}
        onToggle={() => setOpen((shown) => !shown)}
      >
        What a challenge costs
      </DisclosurePill>
      {open && (
        <Stack $gap={10}>
          <ChallengerShare
            share={share}
            amountText={stakeText}
            percentText={percentText}
            verb="stakes"
            stakeText={entryStakeText}
          />
          <Rows>
            <div>
              <dt>Stake to match</dt>
              <dd>{stakeText}</dd>
            </div>
            {costText && (
              <div>
                <dt>Arbitration cost</dt>
                <dd>{costText}</dd>
              </div>
            )}
          </Rows>
          <Small $muted>
            Your stake comes back if jurors agree with you, along with the{' '}
            {itemName}’s stake and its arbitration deposit, which repays what
            you paid the court. If they do not, your stake is added to the{' '}
            {itemName}’s and the arbitration cost is not returned.
          </Small>
        </Stack>
      )}
    </Stack>
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
}

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

  if (!item || !timestamp || !registry || statusCode === undefined)
    return (
      <Card $padding="standard" aria-busy="true" aria-label="Loading status">
        <SkeletonBlock $height="16px" $width="50%" />
        <SkeletonBlock $height="44px" $width="60%" />
        <SkeletonBlock $height="44px" />
      </Card>
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
  const depositText = item.arbitrationDeposit
    ? nativeText(item.arbitrationDeposit, nativeCurrency)
    : undefined
  const multiplier = registry.challengeStakeMultiplier
  const challengerStake = applyMultiplier(item.stake, multiplier)
  const challengerText = tokenText(challengerStake, tokenDecimals, tokenSymbol)
  const costText = arbitrationCost
    ? nativeText(arbitrationCost, nativeCurrency)
    : undefined
  const challengeCostText = challengeArbitrationCost
    ? nativeText(challengeArbitrationCost, nativeCurrency)
    : undefined
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
  // so it leads and the cost becomes the guard behind it.
  const figureLabel = challengeable
    ? 'Win if your challenge succeeds'
    : offList
      ? 'Stake to resubmit'
      : directAction
        ? 'Returns to the submitter'
        : 'Stake at risk'
  const figureAmount = offList ? minStake : item.stake
  // Under the bounty the sentence says what the figure is, so the line that
  // names the entry's arbitration deposit would only crowd it.
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
  // In court there is no card and nothing to sign: the case panel above
  // says where the case stands.
  const prompt = challengeable
    ? // One sentence under the figure: what the bounty is made of and the
      // cost that guards it (DESIGN.md allows one, and the Label above
      // already says the figure is what a winning challenge takes).
      `The ${itemName}’s stake and your own back; challenging costs ${challengerText}${
        challengeCostText ? ` plus ${challengeCostText}` : ''
      }, so a careless challenge is not free.`
    : appealable
      ? refusedToRule
        ? fundedSide
          ? `Jurors refused to rule. The ${fundedSide} funded an appeal; the ${otherSide(fundedSide)} has ${formatDuration(appealEnd - now)} to fund too, or loses.`
          : `Jurors refused to rule. If one side fully funds an appeal by ${formatAbsolute(appealEnd)}, the other must fund too or loses.`
        : statusCode === STATUS_CODE.CROWDFUNDING && !loserFunded
          ? `The ${loserName} has ${formatDuration(appealHalf - now)} to fund an appeal, or the ruling stands.`
          : `The ${loserName} funded the appeal. The ${winnerName} has ${formatDuration(appealEnd - now)} to fund too, or loses.`
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
      {!inCourt && (
        <Card
          id="item-status-card"
          $padding="standard"
          role="region"
          aria-label="What you can do"
        >
          <Head>
            <Label $tone="faint">{figureLabel}</Label>
            <Amount title={tokenText(figureAmount, tokenDecimals, tokenSymbol)}>
              <CountUpText
                value={formatTokenAmount(figureAmount, tokenDecimals)}
              />
              <small>{tokenSymbol}</small>
            </Amount>
            {figureSub && <Sub>{figureSub}</Sub>}
            {prompt && <Prompt>{prompt}</Prompt>}
            {challengeable
              ? stakeWei > 0n && (
                  <ChallengeCost
                    share={challengerShare}
                    stakeText={challengerText}
                    percentText={multiplierPercent(multiplier)}
                    entryStakeText={stakeText}
                    costText={challengeCostText}
                    itemName={itemName}
                  />
                )
              : !offList &&
                !directAction &&
                stakeWei > 0n && (
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
                  {submissionPeriod ? formatDuration(submissionPeriod) : 'None'}
                </dd>
              </div>
              {periodShort && (
                <div>
                  <dt>Withdrawing period</dt>
                  <dd title={periodLong}>{periodShort}</dd>
                </div>
              )}
            </Rows>
          )}
        </Card>
      )}

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

      {view && (
        <StickyActionBar
          status={<EntryStatus status={view} now={now} />}
          action={barAction}
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
