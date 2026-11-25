import { BigNumber } from 'ethers'
import { PARTY, SUBGRAPH_RULING, DISPUTE_STATUS } from './status-constants'

export { PARTY, SUBGRAPH_RULING, DISPUTE_STATUS }

export const CONTRACT_STATUS = {
  ABSENT: 'Absent',
  REGISTERED: 'Registered',
  REGISTRATION_REQUESTED: 'RegistrationRequested',
  REMOVAL_REQUESTED: 'ClearingRequested',
}

export const STATUS_CODE = {
  REJECTED: 0,
  REGISTERED: 1,
  SUBMITTED: 2,
  REMOVAL_REQUESTED: 3,
  CHALLENGED: 4,
  CROWDFUNDING: 5,
  CROWDFUNDING_WINNER: 6,
  WAITING_ARBITRATOR: 7,
  PENDING_SUBMISSION: 8,
  PENDING_REMOVAL: 9,
  WAITING_ENFORCEMENT: 10,
  REMOVED: 11,
}

export const REQUEST_TYPE_LABEL = {
  [CONTRACT_STATUS.REGISTRATION_REQUESTED]: 'Submission',
  [CONTRACT_STATUS.REMOVAL_REQUESTED]: 'Removal',
}

export const hasPendingRequest = (contractStatus: string): boolean =>
  contractStatus === CONTRACT_STATUS.REGISTRATION_REQUESTED ||
  contractStatus === CONTRACT_STATUS.REMOVAL_REQUESTED

export const itemToStatusCode = (
  item: SubgraphItem,
  timestamp: BigNumber | null | undefined,
  challengePeriodDuration: BigNumber | null | undefined,
): number | undefined => {
  const { status } = item
  const request = item.requests?.[0]

  if (!request) return undefined

  if (status === CONTRACT_STATUS.ABSENT) {
    // Differentiate between rejected (never made it) and removed (was registered then taken off)
    const lastRequestType = request?.requestType
    if (lastRequestType === CONTRACT_STATUS.REMOVAL_REQUESTED)
      return STATUS_CODE.REMOVED
    return STATUS_CODE.REJECTED
  }
  if (status === CONTRACT_STATUS.REGISTERED) return STATUS_CODE.REGISTERED

  // Time-dependent statuses can't be computed until the clock and TCR
  // params have loaded.
  if (!timestamp || !challengePeriodDuration) return undefined

  if (!request.disputed) {
    const challengePeriodEnd = BigNumber.from(
      Number(request.submissionTime) + challengePeriodDuration.toNumber(),
    )
    if (timestamp.gt(challengePeriodEnd))
      if (status === CONTRACT_STATUS.REGISTRATION_REQUESTED)
        // The challenge period has passed.
        return STATUS_CODE.PENDING_SUBMISSION
      else return STATUS_CODE.PENDING_REMOVAL

    // Still in challenge period.
    if (status === CONTRACT_STATUS.REGISTRATION_REQUESTED)
      return STATUS_CODE.SUBMITTED
    if (status === CONTRACT_STATUS.REMOVAL_REQUESTED)
      return STATUS_CODE.REMOVAL_REQUESTED
  }

  const round = request.rounds?.[0]
  if (!round) return undefined

  if (round.appealPeriodStart === '0')
    // appeal period didn't start yet
    return STATUS_CODE.CHALLENGED

  // The contracts take contributions while now < appealPeriodEnd.
  if (round.ruling === SUBGRAPH_RULING.NONE)
    if (timestamp.lt(round.appealPeriodEnd))
      // Arbitrator did not rule or refused to rule.
      return STATUS_CODE.CROWDFUNDING
    else return STATUS_CODE.WAITING_ARBITRATOR

  // Arbitrator gave a decisive ruling (i.e. Ruled in favor of either the requester or challenger).
  if (timestamp.gte(round.appealPeriodEnd))
    return STATUS_CODE.WAITING_ARBITRATOR
  const appealPeriodDuration =
    Number(round.appealPeriodEnd) - Number(round.appealPeriodStart)
  // The loser's half ends where the contracts' integer division puts it.
  const appealHalfTime =
    Number(round.appealPeriodStart) + Math.floor(appealPeriodDuration / 2)
  if (timestamp.lt(appealHalfTime)) return STATUS_CODE.CROWDFUNDING // In first half of appeal period

  // If the party that lost the previous round is not fully funded
  // before the end of the first half, the dispute is over
  // and awaits enforcement.
  const loser =
    round.ruling === SUBGRAPH_RULING.ACCEPT ? PARTY.CHALLENGER : PARTY.REQUESTER
  if (
    loser === PARTY.REQUESTER ? round.hasPaidRequester : round.hasPaidChallenger
  )
    return STATUS_CODE.CROWDFUNDING_WINNER
  else return STATUS_CODE.WAITING_ENFORCEMENT
}
