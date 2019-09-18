import { bigNumberify } from 'ethers/utils'

export const PARTY = {
  NONE: 0,
  REQUESTER: 1,
  CHALLENGER: 2
}

export const DISPUTE_STATUS = {
  WAITING: 0,
  APPEALABLE: 1,
  SOLVED: 2
}

export const CONTRACT_STATUS = {
  ABSENT: 0,
  REGISTERED: 1,
  REGISTRATION_REQUESTED: 2,
  REMOVAL_REQUESTED: 3
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
  [STATUS_CODE.REMOVAL_REQUESTED]: 'Removal Requested',
  [STATUS_CODE.CHALLENGED]: 'Challenged',
  [STATUS_CODE.CROWDFUNDING]: 'Crowdfunding',
  [STATUS_CODE.CROWDFUNDING_WINNER]: 'Crowdfunding Winner',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'Waiting Arbitrator',
  [STATUS_CODE.PENDING_SUBMISSION]: 'Pending Submission',
  [STATUS_CODE.PENDING_REMOVAL]: 'Pending Removal',
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

export const itemToStatusCode = (
  {
    status,
    disputed,
    submissionTime,
    disputeStatus,
    hasPaid,
    currentRuling,
    appealStart,
    appealEnd
  },
  timestamp,
  challengePeriodDuration
) => {
  if (status === CONTRACT_STATUS.ABSENT) return STATUS_CODE.REJECTED
  if (status === CONTRACT_STATUS.REGISTERED) return STATUS_CODE.REGISTERED
  if (!disputed) {
    const challengePeriodEnd = submissionTime.add(challengePeriodDuration)
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

  if (disputeStatus === DISPUTE_STATUS.WAITING) return STATUS_CODE.CHALLENGED
  if (disputeStatus === DISPUTE_STATUS.APPEALABLE) {
    if (appealStart.eq(bigNumberify(0)) && appealEnd.eq(bigNumberify(0)))
      return STATUS_CODE.CROWDFUNDING // Dispute is appealable but the arbitrator does not use appeal period.

    if (currentRuling === PARTY.NONE)
      if (timestamp.lte(appealEnd))
        // Arbitrator did not rule or refused to rule.
        return STATUS_CODE.CROWDFUNDING
      else return STATUS_CODE.WAITING_ARBITRATOR

    // Arbitrator gave a decisive ruling (i.e. Ruled in favor of either the requester or challenger).
    if (timestamp.gt(appealEnd)) return STATUS_CODE.WAITING_ARBITRATOR
    const appealPeriodDuration = appealEnd.sub(appealStart)
    const appealHalfTime = appealStart.add(
      appealPeriodDuration.div(bigNumberify(2))
    )
    if (timestamp.lt(appealHalfTime)) return STATUS_CODE.CROWDFUNDING // In first half of appeal period

    // If the party that lost the previous round is not fully funded
    // before the end of the first half, the dispute is over
    // and awaits enforecement.
    const loser =
      currentRuling === PARTY.REQUESTER ? PARTY.CHALLENGER : PARTY.REQUESTER
    if (hasPaid[loser]) return STATUS_CODE.CROWDFUNDING_WINNER
    else return STATUS_CODE.WAITING_ENFORCEMENT
  }
}
