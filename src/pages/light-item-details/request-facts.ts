import type { BigNumber } from 'ethers'
import {
  CONTRACT_STATUS,
  STATUS_CODE,
  SUBGRAPH_RULING,
} from 'utils/item-status'
import { klerosAddresses } from 'config/tcr-addresses'
import { toSeconds } from 'components/curate/item-light-format'

/*
 * Everything the hero and the action card derive from the latest request:
 * the window and appeal times, who the parties are called, and the court
 * link. One place, so both blocks always describe the same request.
 */

export interface LightRequest extends SubgraphRequest {
  requestType?: string
  deposit?: BigNumber | string
  disputeID: string
  arbitrator: string
  resolutionTime?: string | null
  evidenceGroup?: { evidences?: unknown[] }
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
  evidenceCount: number
}

export const requestFacts = ({
  item,
  request,
  statusCode,
  challengePeriodDuration,
  chainId,
}: {
  item: SubgraphItem
  request: LightRequest
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

  const { arbitrator: klerosArbitrator, uiURL } =
    (chainId && klerosAddresses[chainId as keyof typeof klerosAddresses]) || {}
  const hasDispute = !!request.disputed && Number(request.disputeID) !== 0
  const disputeHref =
    hasDispute &&
    uiURL &&
    klerosArbitrator?.toLowerCase() === request.arbitrator?.toLowerCase()
      ? uiURL.replace(':disputeID', String(request.disputeID))
      : undefined

  return {
    isRegistration,
    requesterName,
    submissionTime,
    windowEnd: submissionTime + challengePeriodDuration.toNumber(),
    appealStart,
    appealEnd,
    appealHalf: appealStart + (appealEnd - appealStart) / 2,
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
    disputeHref,
    disputeHost: disputeHref ? new URL(disputeHref).host : undefined,
    evidenceCount: request.evidenceGroup?.evidences?.length ?? 0,
  }
}

/** "Submitter" from "submitter". */
export const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1)
