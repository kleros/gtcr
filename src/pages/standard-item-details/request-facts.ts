import type { BigNumber } from 'ethers'
import {
  CONTRACT_STATUS,
  STATUS_CODE,
  SUBGRAPH_RULING,
} from 'utils/item-status'
import { klerosAddresses } from 'config/tcr-addresses'
import { toSeconds } from 'components/curate/item-standard-format'

/*
 * Everything the hero and the action card derive from the latest request:
 * the window and appeal times, who the parties are called, and the court
 * link. One place, so both blocks always describe the same request.
 */

export interface StandardRequest extends SubgraphRequest {
  requestType?: string
  deposit?: BigNumber | string
  disputeID: string
  arbitrator: string
  /** The extra data the request was made with; its challenge is priced with it. */
  arbitratorExtraData?: string
  /**
   * The final ruling once the request is resolved. It differs from the
   * jurors' last ruling when only one side funded the last appeal.
   */
  disputeOutcome?: string | null
  resolutionTime?: string | null
}

export interface RequestFacts {
  isRegistration: boolean
  /** "submitter" for a submission, "requester" for a removal. */
  requesterName: string
  submissionTime: number
  windowEnd: number
  appealStart: number
  appealEnd: number
  appealHalf: number
  currentRuling: string | null
  /** Parties named by the current ruling (meaningful once jurors ruled). */
  loserName: string
  winnerName: string
  inWindow: boolean
  isPending: boolean
  appealable: boolean
  /** Challenged, awaiting the ruling or its enforcement: no action to take. */
  inCourt: boolean
  hasDispute: boolean
  disputeID?: string
  /** The case on the Kleros court site, when the arbitrator is Kleros. */
  disputeHref?: string
  disputeHost?: string
}

/**
 * The case on the Kleros court site, for any of the entry's requests: a
 * request made with another arbitrator has no court page to open. One
 * place, so the hero, the case panel and the record of past cases all link
 * the same way.
 */
export const courtLink = (
  chainId: number | null | undefined,
  arbitrator: string | undefined,
  disputeID: string | number | undefined,
): { href: string; host?: string } | undefined => {
  const { arbitrator: kleros, uiURL } =
    (chainId && klerosAddresses[chainId as keyof typeof klerosAddresses]) || {}
  if (
    !uiURL ||
    !arbitrator ||
    kleros?.toLowerCase() !== arbitrator.toLowerCase()
  )
    return undefined
  const href = uiURL.replace(':disputeID', String(disputeID))
  try {
    return { href, host: new URL(href).host }
  } catch {
    return { href }
  }
}

/** "For the challenger": a ruling as a value under a label. */
export const rulingShort = (
  ruling: string | null | undefined,
  requesterName: string,
): string | undefined =>
  ruling === SUBGRAPH_RULING.ACCEPT
    ? `For the ${requesterName}`
    : ruling === SUBGRAPH_RULING.REJECT
      ? 'For the challenger'
      : ruling === SUBGRAPH_RULING.NONE
        ? 'Refused to rule'
        : undefined

export const requestFacts = ({
  item,
  request,
  statusCode,
  challengePeriodDuration,
  chainId,
}: {
  item: SubgraphItem
  request: StandardRequest
  statusCode: number
  challengePeriodDuration: BigNumber
  chainId?: number | null
}): RequestFacts => {
  const round = request.rounds?.[0]
  const currentRuling = round?.ruling ?? null
  const submissionTime = toSeconds(request.submissionTime)
  const appealStart = toSeconds(round?.appealPeriodStart)
  const appealEnd = toSeconds(round?.appealPeriodEnd)
  const isRegistration = request.requestType
    ? request.requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
    : item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED
  const requesterName = isRegistration ? 'submitter' : 'requester'
  const requesterWins = currentRuling === SUBGRAPH_RULING.ACCEPT

  // A disputed request always has a case, and the arbitrator numbers its
  // first one 0.
  const hasDispute = !!request.disputed
  const court = hasDispute
    ? courtLink(chainId, request.arbitrator, request.disputeID)
    : undefined

  return {
    isRegistration,
    requesterName,
    submissionTime,
    windowEnd: submissionTime + challengePeriodDuration.toNumber(),
    appealStart,
    appealEnd,
    // Where the contracts' integer division puts it (utils/item-status.ts).
    appealHalf: appealStart + Math.floor((appealEnd - appealStart) / 2),
    currentRuling,
    loserName: requesterWins ? 'challenger' : requesterName,
    winnerName: requesterWins ? requesterName : 'challenger',
    inWindow:
      statusCode === STATUS_CODE.SUBMITTED ||
      statusCode === STATUS_CODE.REMOVAL_REQUESTED,
    isPending:
      statusCode === STATUS_CODE.PENDING_SUBMISSION ||
      statusCode === STATUS_CODE.PENDING_REMOVAL,
    appealable:
      statusCode === STATUS_CODE.CROWDFUNDING ||
      statusCode === STATUS_CODE.CROWDFUNDING_WINNER,
    inCourt:
      statusCode === STATUS_CODE.CHALLENGED ||
      statusCode === STATUS_CODE.WAITING_ARBITRATOR ||
      statusCode === STATUS_CODE.WAITING_ENFORCEMENT,
    hasDispute,
    disputeID: hasDispute ? String(request.disputeID) : undefined,
    disputeHref: court?.href,
    disputeHost: court?.host,
  }
}

/** Where the case stands, in the page's words, for the case panel. */
export interface CaseState {
  /** Used as the heading when the court itself cannot be read. */
  heading: string
  /**
   * The request is waiting on the court, so the court's own word for its
   * current period leads the case panel. False once the request has its
   * ruling state: the court's appeal period can still be running then, and
   * it is no longer what is happening to this entry.
   */
  awaitingCourt: boolean
  /**
   * What it means for this entry, when the court cannot know it (a side
   * that alone funded an appeal wins whatever the jurors ruled). Left out
   * where the court's own sentence about the period says it better.
   */
  summary?: string
  /** The ruling in words, once the jurors have given one. */
  ruling?: string
  rulingLabel?: string
}

export const caseState = (
  request: StandardRequest,
  facts: RequestFacts,
  statusCode: number,
): CaseState => {
  // Once resolved the outcome can differ from the jurors' last ruling: a
  // side that alone funded the last appeal wins (rule() in the list
  // contract). The request records that final outcome.
  const decided = request.resolved
    ? (request.disputeOutcome ?? facts.currentRuling)
    : facts.currentRuling
  const ruling =
    statusCode === STATUS_CODE.CHALLENGED
      ? undefined
      : rulingShort(decided, facts.requesterName)
  const rulingLabel = facts.appealable ? 'Current ruling' : 'Ruling'

  if (statusCode === STATUS_CODE.CHALLENGED)
    return { heading: 'Jurors are deciding', awaitingCourt: true }
  if (statusCode === STATUS_CODE.WAITING_ARBITRATOR) {
    const alone = request.resolved
      ? undefined
      : fundedAlone(request, facts.requesterName)
    return {
      heading: 'Ruling final',
      awaitingCourt: false,
      summary: alone
        ? `The ${alone} funded the appeal alone, so the ${alone} wins when the ruling is enforced.`
        : undefined,
      ruling,
      rulingLabel,
    }
  }
  if (statusCode === STATUS_CODE.WAITING_ENFORCEMENT)
    return {
      heading: 'Ruling stands',
      awaitingCourt: false,
      summary: 'The losing side did not fund its appeal, so the ruling stands.',
      ruling,
      rulingLabel,
    }
  return {
    heading: 'Open for appeal',
    awaitingCourt: true,
    ruling,
    rulingLabel,
  }
}

/** "Submitter" from "submitter". */
export const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1)

/** The statuses whose action opens a dialog (ItemActionModal). */
const DIALOG_STATUSES = new Set([
  STATUS_CODE.REJECTED,
  STATUS_CODE.REMOVED,
  STATUS_CODE.REGISTERED,
  STATUS_CODE.SUBMITTED,
  STATUS_CODE.REMOVAL_REQUESTED,
  STATUS_CODE.CROWDFUNDING,
  STATUS_CODE.CROWDFUNDING_WINNER,
])

/**
 * Why the entry's dialog closed when its status moved from `from` to `to`
 * while it was open, for a toast; undefined when `from` had no dialog
 * showing (a link's ?action= under a status without one), which closes
 * quietly.
 */
export const statusChangeNotice = (
  from: number,
  to: number,
): string | undefined => {
  if (!DIALOG_STATUSES.has(from)) return undefined
  if (
    (from === STATUS_CODE.SUBMITTED ||
      from === STATUS_CODE.REMOVAL_REQUESTED) &&
    (to === STATUS_CODE.PENDING_SUBMISSION ||
      to === STATUS_CODE.PENDING_REMOVAL)
  )
    return 'The challenge period has ended.'
  if (
    (from === STATUS_CODE.CROWDFUNDING ||
      from === STATUS_CODE.CROWDFUNDING_WINNER) &&
    to === STATUS_CODE.WAITING_ARBITRATOR
  )
    return 'The appeal period has ended.'
  if (
    from === STATUS_CODE.CROWDFUNDING &&
    to === STATUS_CODE.WAITING_ENFORCEMENT
  )
    return "The losing side's half of the appeal period has ended."
  return "This entry's status changed."
}

/**
 * The side that alone fully funded the latest round's appeal, when exactly
 * one did. Once the appeal period is over that side wins, whatever the
 * jurors ruled: rule() in the list contracts gives the ruling to the only
 * side that paid, and the other side's backers are reimbursed.
 */
export const fundedAlone = (
  request: StandardRequest | undefined,
  requesterName: string,
): string | undefined => {
  const round = request?.rounds?.[0]
  if (!round) return undefined
  const requesterPaid = !!round.hasPaidRequester
  const challengerPaid = !!round.hasPaidChallenger
  if (requesterPaid === challengerPaid) return undefined
  return requesterPaid ? requesterName : 'challenger'
}
