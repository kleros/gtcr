import type { Address } from 'viem'
import type { BigNumber } from 'ethers'
import { klerosAddresses } from 'config/tcr-addresses'
import { getAddressPage } from 'utils/network-utils'
import { formatAbsolute } from 'utils/time'
import {
  CONTRACT_STATUS,
  STATUS_CODE,
  SUBGRAPH_RULING,
  itemToStatusCode,
} from 'utils/permanent-item-status'
import type { WithdrawalStage } from './withdrawal-stepper'

/*
 * Everything the Stake Curate item page derives from the item, its list and
 * the status code, in one place so the hero, the action card and the
 * withdrawal card never disagree: the periods and their deadlines, the
 * withdrawal stage, the dispute and its appeal period, the court link.
 */

/** A party to a dispute, as the page names it. */
export type Side = 'submitter' | 'challenger'

/** Challenge fields the item query selects. */
export interface StakeChallenge extends SubgraphChallenge {
  disputeID: string
  challenger: string
  challengerStake?: string
  disputeOutcome?: string | null
  createdAt?: string | null
  creationTx?: string | null
  resolutionTime?: string | null
  resolutionTx?: string | null
  arbitrationSetting: { arbitratorExtraData: string }
}

/** A submission row as the item query selects it. */
export interface StakeSubmission {
  id?: string
  createdAt?: string | null
  creationTx?: string | null
  finishedAt?: string | null
  finishedTx?: string | null
  withdrawingTimestamp?: string | null
  withdrawingTx?: string | null
  submitter?: string | null
  initialStake?: string | null
  arbitrationDeposit?: string | null
}

/** Evidence as the item query selects it. */
export interface StakeEvidence {
  party: string
  URI: string
  number?: string
  timestamp: string
  txHash: string
  metadata?: {
    name?: string | null
    title?: string | null
    description?: string | null
    fileURI?: string | null
    fileTypeExtension?: string | null
  } | null
}

/** A registry row where the fields the page needs are known to be present. */
export interface StakeRegistry extends SubgraphRegistry {
  id: Address
  token: Address
  arbitrator: { id: Address }
}

/** A Stake Curate item as the item query returns it. */
export interface StakeItem extends SubgraphItem {
  itemID: string
  submitter: string
  stake: string
  includedAt: string
  arbitrationDeposit?: string
  withdrawingTimestamp: string
  challenges: StakeChallenge[]
  submissions?: StakeSubmission[]
  evidences?: StakeEvidence[]
  registry?: StakeRegistry
  columns?: Column[]
}

export const toNum = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** "Jurors ruled for the challenger" */
export const rulingLine = (ruling: string | null | undefined): string => {
  switch (ruling) {
    case SUBGRAPH_RULING.NONE:
      return 'Jurors refused to rule'
    case SUBGRAPH_RULING.ACCEPT:
      return 'Jurors ruled for the submitter'
    case SUBGRAPH_RULING.REJECT:
      return 'Jurors ruled for the challenger'
    default:
      return 'No ruling yet'
  }
}

/**
 * The status the page acts on. The shared util splits the appeal period at
 * its half even when the jurors refused to rule, and calls the second half
 * "waiting for the arbitrator" when the submitter has not funded. With no
 * ruling the contract applies no half cutoff: either side can fund until the
 * period ends, so until then the item is still open to appeal funding.
 */
export const stakeStatusCode = (
  item: SubgraphItem,
  timestamp: BigNumber,
  registry: SubgraphRegistry,
): number | undefined => {
  const code = itemToStatusCode(item, timestamp, registry)
  if (
    code !== STATUS_CODE.WAITING_ARBITRATOR &&
    code !== STATUS_CODE.CROWDFUNDING_WINNER
  )
    return code
  const round = item.challenges?.[0]?.rounds?.[0]
  const refused =
    !!round &&
    toNum(round.rulingTime) > 0 &&
    round.ruling === SUBGRAPH_RULING.NONE
  return refused && timestamp.toNumber() < toNum(round?.appealPeriodEnd)
    ? STATUS_CODE.CROWDFUNDING
    : code
}

/** Kept for callers that want a full sentence. */
export const rulingSentence = (ruling: string | null | undefined): string =>
  `${rulingLine(ruling)}.`

/** "For the challenger": the ruling as a value under a label. */
export const rulingShort = (
  ruling: string | null | undefined,
): string | undefined => {
  switch (ruling) {
    case SUBGRAPH_RULING.NONE:
      return 'Refused to rule'
    case SUBGRAPH_RULING.ACCEPT:
      return 'For the submitter'
    case SUBGRAPH_RULING.REJECT:
      return 'For the challenger'
    default:
      return undefined
  }
}

export interface StakeFacts {
  offList: boolean
  includedAt: number
  reincluded: boolean
  /** The submission or reinclusion period, in seconds. */
  period: number
  acceptedAt: number
  withdrawingAt: number
  withdrawingPeriod: number
  withdrawReadyAt: number
  /** A withdrawal has started and the item is still on the list. */
  isWithdrawing: boolean
  /** No withdrawal yet: the submitter could start one. */
  isWithdrawable: boolean
  withdrawalStage: WithdrawalStage
  challenge?: StakeChallenge
  round?: SubgraphRound
  disputeID?: string
  hasDispute: boolean
  appealStart: number
  appealEnd: number
  appealHalf: number
  appealable: boolean
  /** The jurors gave their ruling and it was a refusal to rule. */
  refusedToRule: boolean
  /** Refused to rule and the appeal period still runs: either side can fund. */
  refusedOpen: boolean
  /**
   * The one side fully funded on the current round, if only one is. If the
   * period ends like this, that side wins whatever the jurors ruled.
   */
  fundedSide?: Side
  /** Disputed, waiting for the arbitrator, or in the appeal period. */
  underDispute: boolean
  /** Nobody can act on the item until the arbitrator does. */
  inCourt: boolean
  winnerName: Side
  loserName: Side
  submission?: StakeSubmission
  /** When the current challenge was raised (0 if there is none). */
  challengedAt: number
  /** When the latest submission started (its events and evidence count from here). */
  submissionStart: number
  /** When the item left the list, if it did. */
  endedAt: number
  courtHref?: string
  courtHost?: string
}

/**
 * The case page for one of the entry's challenges: the Kleros court when
 * Kleros arbitrates it, the arbitrator's own page otherwise. One place, so
 * the hero, the case panel and the record of decided cases link the same
 * way.
 */
export const stakeCourtLink = (
  chainId: number | null | undefined,
  arbitrator: string | undefined,
  disputeID: string | undefined,
): { href: string; host?: string } | undefined => {
  if (!disputeID || !arbitrator) return undefined
  const kleros = chainId ? klerosAddresses[chainId] : undefined
  const isKleros =
    !!kleros && kleros.arbitrator.toLowerCase() === arbitrator.toLowerCase()
  const href = isKleros
    ? kleros.uiURL.replace(':disputeID', disputeID.toString())
    : getAddressPage({ networkId: chainId ?? 0, address: arbitrator })
  try {
    return { href, host: new URL(href).host }
  } catch {
    return { href }
  }
}

export const stakeFacts = ({
  item,
  registry,
  statusCode,
  chainId,
}: {
  item: StakeItem
  registry: StakeRegistry
  /** From stakeStatusCode, so a refused-to-rule appeal counts as open. */
  statusCode: number
  chainId?: number | null
}): StakeFacts => {
  const offList =
    statusCode === STATUS_CODE.REJECTED ||
    statusCode === STATUS_CODE.REMOVED ||
    statusCode === STATUS_CODE.WITHDRAWN
  const includedAt = toNum(item.includedAt)
  const reincluded = item.status === CONTRACT_STATUS.REINCLUDED
  const period = toNum(
    reincluded ? registry.reinclusionPeriod : registry.submissionPeriod,
  )
  const withdrawingAt = toNum(item.withdrawingTimestamp)
  const withdrawingPeriod = toNum(registry.withdrawingPeriod)
  const isWithdrawing = !offList && withdrawingAt > 0
  const withdrawalStage: WithdrawalStage =
    statusCode === STATUS_CODE.WITHDRAWN
      ? 'withdrawn'
      : statusCode === STATUS_CODE.PENDING_WITHDRAWAL
        ? 'ready'
        : isWithdrawing
          ? 'withdrawing'
          : 'listed'

  const challenge = item.challenges?.[0]
  const round = challenge?.rounds?.[0]
  const disputeID = challenge?.disputeID
  const appealStart = toNum(round?.appealPeriodStart)
  const appealEnd = toNum(round?.appealPeriodEnd)
  const appealable =
    statusCode === STATUS_CODE.CROWDFUNDING ||
    statusCode === STATUS_CODE.CROWDFUNDING_WINNER
  const underDispute =
    statusCode === STATUS_CODE.DISPUTED ||
    statusCode === STATUS_CODE.WAITING_ARBITRATOR ||
    appealable
  const submitterWins = round?.ruling === SUBGRAPH_RULING.ACCEPT
  const ruled = toNum(round?.rulingTime) > 0
  const refusedToRule = ruled && round?.ruling === SUBGRAPH_RULING.NONE
  const paidSubmitter = !!round?.hasPaidRequester
  const paidChallenger = !!round?.hasPaidChallenger
  const fundedSide: Side | undefined =
    paidSubmitter !== paidChallenger
      ? paidSubmitter
        ? 'submitter'
        : 'challenger'
      : undefined
  const submission = item.submissions?.[0]

  const court = stakeCourtLink(chainId, registry.arbitrator.id, disputeID)

  return {
    offList,
    includedAt,
    reincluded,
    period,
    acceptedAt: includedAt + period,
    withdrawingAt,
    withdrawingPeriod,
    withdrawReadyAt: withdrawingAt + withdrawingPeriod,
    isWithdrawing,
    isWithdrawable: !offList && withdrawingAt === 0,
    withdrawalStage,
    challenge,
    round,
    disputeID,
    // A challenge always has a case, and the arbitrator numbers its first
    // one 0: the challenge is what says there is a dispute, never the
    // number (request-facts.ts says the same on the Standard side).
    hasDispute: !!challenge,
    appealStart,
    appealEnd,
    appealHalf: appealStart + (appealEnd - appealStart) / 2,
    appealable,
    // With no ruling there is no loser: either side funds with the shared
    // multiplier until the period ends, with no half cutoff.
    refusedToRule,
    refusedOpen: refusedToRule && appealable,
    fundedSide,
    underDispute,
    inCourt:
      statusCode === STATUS_CODE.DISPUTED ||
      statusCode === STATUS_CODE.WAITING_ARBITRATOR,
    winnerName: submitterWins ? 'submitter' : 'challenger',
    loserName: submitterWins ? 'challenger' : 'submitter',
    submission,
    challengedAt: toNum(challenge?.createdAt),
    submissionStart: toNum(submission?.createdAt) || includedAt,
    endedAt: offList
      ? toNum(submission?.finishedAt) || toNum(challenge?.resolutionTime)
      : 0,
    courtHref: court?.href,
    courtHost: court?.host,
  }
}

/** Where the case stands, in the page's words, for the case panel. */
export interface StakeCaseState {
  /** Used as the heading when the court itself cannot be read. */
  heading: string
  /**
   * The entry is waiting on the court, so the court's own word for its
   * current period leads the case panel. False once the jurors have ruled
   * and the list has settled what happens: the court's appeal period can
   * still be running then, and it is no longer what is happening here.
   */
  awaitingCourt: boolean
  /**
   * What it means for this entry, where the court cannot know it (a side
   * that alone funded an appeal wins whatever the jurors ruled). Left out
   * where the court's own sentence about the period says it better.
   */
  summary?: string
  /** The ruling in words, once the jurors have given one. */
  ruling?: string
  rulingLabel?: string
}

export const stakeCaseState = (
  facts: StakeFacts,
  statusCode: number,
  now: number,
): StakeCaseState => {
  const { round, appealable, fundedSide, appealEnd, loserName } = facts
  const ruled = toNum(round?.rulingTime) > 0
  const ruling = ruled ? rulingShort(round?.ruling) : undefined
  const rulingLabel = appealable ? 'Current ruling' : 'Ruling'

  if (statusCode === STATUS_CODE.DISPUTED)
    return { heading: 'Jurors are deciding', awaitingCourt: true }
  if (statusCode === STATUS_CODE.WAITING_ARBITRATOR) {
    // Before the period is over, the loser's half passed with nothing
    // funded: the ruling stands. After it, the ruling is final and waits to
    // be enforced — unless one side funded alone, which decides it instead
    // (rule() gives the ruling to the only side that paid).
    const stands = now < appealEnd
    return {
      heading: stands ? 'Ruling stands' : 'Ruling final',
      awaitingCourt: false,
      summary: stands
        ? // The date is not when the ruling becomes true — the heading says
          // it already is — but the first moment it can be enforced.
          `The ${loserName} did not fund the appeal, so the ruling stands; it can be enforced from ${formatAbsolute(appealEnd)}.`
        : fundedSide
          ? `The ${fundedSide} funded the appeal alone, so the ${fundedSide} wins when the ruling is enforced.`
          : undefined,
      ruling,
      rulingLabel,
    }
  }
  return {
    heading: 'Open for appeal',
    awaitingCourt: true,
    ruling,
    rulingLabel,
  }
}

export const otherSide = (side: Side): Side =>
  side === 'submitter' ? 'challenger' : 'submitter'

export const capitalize = (text: string): string =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text
