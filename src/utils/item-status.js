import { BigNumber } from 'ethers/utils'

export const PARTY = {
  NONE: 0,
  REQUESTER: 1,
  CHALLENGER: 2
}

export const SUBGRAPH_RULING = {
  NONE: 'None',
  ACCEPT: 'Accept',
  REJECT: 'Reject'
}

export const DISPUTE_STATUS = {
  WAITING: 0,
  APPEALABLE: 1,
  SOLVED: 2
}

export const CONTRACT_STATUS = {
  ABSENT: 'Absent',
  REGISTERED: 'Registered',
  REGISTRATION_REQUESTED: 'RegistrationRequested',
  REMOVAL_REQUESTED: 'ClearingRequested'
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
  WAITING_ENFORCEMENT: 10
}

export const STATUS_TEXT = {
  [STATUS_CODE.REJECTED]: 'Rejected',
  [STATUS_CODE.REGISTERED]: 'Registered',
  [STATUS_CODE.SUBMITTED]: 'Submitted',
  [STATUS_CODE.REMOVAL_REQUESTED]: 'Removing',
  [STATUS_CODE.CHALLENGED]: 'Challenged',
  [STATUS_CODE.CROWDFUNDING]: 'Crowdfunding',
  [STATUS_CODE.CROWDFUNDING_WINNER]: 'Crowdfunding Winner',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'Waiting Arbitrator',
  [STATUS_CODE.PENDING_SUBMISSION]: 'Pending Execution',
  [STATUS_CODE.PENDING_REMOVAL]: 'Pending Execution',
  [STATUS_CODE.WAITING_ENFORCEMENT]: 'Waiting enforcement'
}

export const STATUS_COLOR = {
  [STATUS_CODE.REJECTED]: 'red',
  [STATUS_CODE.REGISTERED]: 'green',
  [STATUS_CODE.SUBMITTED]: 'blue',
  [STATUS_CODE.REMOVAL_REQUESTED]: 'pink',
  [STATUS_CODE.CHALLENGED]: 'orange',
  [STATUS_CODE.CROWDFUNDING]: 'purple',
  [STATUS_CODE.CROWDFUNDING_WINNER]: '#9d52d6',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'magenta',
  [STATUS_CODE.PENDING_SUBMISSION]: 'cyan',
  [STATUS_CODE.PENDING_REMOVAL]: 'volcano',
  [STATUS_CODE.WAITING_ENFORCEMENT]: 'gold'
}

export const SUBGRAPH_STATUS_TO_CODE = {
  Absent: 0,
  Registered: 1,
  RegistrationRequested: 2,
  ClearingRequested: 3
}

export const REQUEST_TYPE_LABEL = {
  [CONTRACT_STATUS.REGISTRATION_REQUESTED]: 'Submission',
  [CONTRACT_STATUS.REMOVAL_REQUESTED]: 'Removal'
}

export const hasPendingRequest = contractStatus =>
  contractStatus === CONTRACT_STATUS.REGISTRATION_REQUESTED ||
  contractStatus === CONTRACT_STATUS.REMOVAL_REQUESTED

export const getResultStatus = ({ ruling, requestType }) => {
  let status
  if (requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED)
    switch (ruling) {
      case PARTY.NONE:
      case PARTY.CHALLENGER:
        status = CONTRACT_STATUS.ABSENT
        break
      case PARTY.REQUESTER:
        status = CONTRACT_STATUS.REGISTERED
        break
      default:
        throw new Error('Unhandled ruling')
    }
  else
    switch (ruling) {
      case PARTY.NONE:
      case PARTY.CHALLENGER:
        status = CONTRACT_STATUS.REGISTERED
        break
      case PARTY.REQUESTER:
        status = CONTRACT_STATUS.ABSENT
        break
      default:
        throw new Error('Unhandled ruling')
    }
  return status
}

export const getActionLabel = ({ statusCode, itemName = 'item' }) => {
  switch (statusCode) {
    case STATUS_CODE.REJECTED:
      return `Resubmit ${itemName}`
    case STATUS_CODE.REGISTERED:
      return `Remove ${itemName}`
    case STATUS_CODE.SUBMITTED:
      return 'Challenge submission'
    case STATUS_CODE.REMOVAL_REQUESTED:
      return 'Challenge removal'
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return 'Contribute Fees'
    case STATUS_CODE.PENDING_SUBMISSION:
      return 'Execute submission'
    case STATUS_CODE.PENDING_REMOVAL:
      return 'Execute removal'
    case STATUS_CODE.CHALLENGED:
    case STATUS_CODE.WAITING_ARBITRATOR:
      return 'Waiting Arbitrator'
    case STATUS_CODE.WAITING_ENFORCEMENT:
      return 'Waiting Enforcement'
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

export const itemToStatusCode = (item, timestamp, challengePeriodDuration) => {
  const { status } = item
  const request = item.requests?.[0]

  if (!request) return undefined

  if (status === CONTRACT_STATUS.ABSENT) return STATUS_CODE.REJECTED
  if (status === CONTRACT_STATUS.REGISTERED) return STATUS_CODE.REGISTERED
  if (!request.disputed) {
    const challengePeriodEnd = new BigNumber(
      Number(request.submissionTime) + challengePeriodDuration.toNumber()
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
  if (round?.appealPeriodStart === '0')
    // appeal period didn't start yet
    return STATUS_CODE.CHALLENGED

  // if (appealStart.eq(bigNumberify(0)) && appealEnd.eq(bigNumberify(0)))
  //   return STATUS_CODE.CROWDFUNDING // Dispute is appealable but the arbitrator does not use appeal period.

  if (round.ruling === SUBGRAPH_RULING.NONE)
    if (timestamp.lte(round.appealPeriodEnd))
      // Arbitrator did not rule or refused to rule.
      return STATUS_CODE.CROWDFUNDING
    else return STATUS_CODE.WAITING_ARBITRATOR

  // Arbitrator gave a decisive ruling (i.e. Ruled in favor of either the requester or challenger).
  if (timestamp.gt(round.appealPeriodEnd)) return STATUS_CODE.WAITING_ARBITRATOR
  const appealPeriodDuration =
    Number(round.appealPeriodEnd) - Number(round.appealPeriodStart)
  const appealHalfTime =
    Number(round.appealPeriodStart) + appealPeriodDuration / 2
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
