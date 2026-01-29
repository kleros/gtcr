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
  SUBMITTED: 'Submitted',
  REINCLUDED: 'Reincluded',
  DISPUTED: 'Disputed'
}

export const STATUS_CODE = {
  ABSENT: 0,
  PENDING: 1,
  ACCEPTED: 2,
  DISPUTED: 3,
  CROWDFUNDING: 4,
  CROWDFUNDING_WINNER: 5,
  WAITING_ARBITRATOR: 6,
  PENDING_WITHDRAWAL: 7
}

export const STATUS_TEXT = {
  [STATUS_CODE.ABSENT]: 'Removed',
  [STATUS_CODE.PENDING]: 'Pending',
  [STATUS_CODE.ACCEPTED]: 'Accepted',
  [STATUS_CODE.DISPUTED]: 'Disputed',
  [STATUS_CODE.CROWDFUNDING]: 'Crowdfunding',
  [STATUS_CODE.CROWDFUNDING_WINNER]: 'Crowdfunding Winner',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'Waiting Arbitrator',
  [STATUS_CODE.PENDING_WITHDRAWAL]: 'Pending Withdrawal'
}

export const STATUS_COLOR = {
  [STATUS_CODE.ABSENT]: 'red',
  [STATUS_CODE.PENDING]: 'blue',
  [STATUS_CODE.ACCEPTED]: 'green',
  [STATUS_CODE.DISPUTED]: 'orange',
  [STATUS_CODE.CROWDFUNDING]: 'purple',
  [STATUS_CODE.CROWDFUNDING_WINNER]: '#9d52d6',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'magenta',
  [STATUS_CODE.PENDING_WITHDRAWAL]: 'cyan'
}

export const getActionLabel = ({ statusCode, itemName = 'item' }) => {
  switch (statusCode) {
    case STATUS_CODE.ABSENT:
      return `Resubmit ${itemName}`
    case STATUS_CODE.PENDING:
    case STATUS_CODE.ACCEPTED:
      return `Challenge ${itemName}`
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return 'Contribute Fees'
    case STATUS_CODE.DISPUTED:
    case STATUS_CODE.WAITING_ARBITRATOR:
      return 'Waiting Arbitrator'
    case STATUS_CODE.PENDING_WITHDRAWAL:
      return 'Execute Withdrawal'
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

export const itemToStatusCode = (item, timestamp, registry) => {
  const { status } = item
  timestamp = timestamp.toNumber()

  if (status === CONTRACT_STATUS.ABSENT) return STATUS_CODE.ABSENT
  if (
    status === CONTRACT_STATUS.SUBMITTED ||
    status === CONTRACT_STATUS.REINCLUDED
  )
    if (
      Number(item.withdrawingTimestamp) > 0 &&
      Number(item.withdrawingTimestamp) + Number(registry.withdrawingPeriod) <
        timestamp
    )
      return STATUS_CODE.PENDING_WITHDRAWAL

  if (status === CONTRACT_STATUS.SUBMITTED) {
    const period = Number(registry.submissionPeriod)
    return period + Number(item.includedAt) < timestamp
      ? STATUS_CODE.ACCEPTED
      : STATUS_CODE.PENDING
  }

  if (status === CONTRACT_STATUS.REINCLUDED) {
    const period = Number(registry.reinclusionPeriod)

    return period + Number(item.includedAt) < timestamp
      ? STATUS_CODE.ACCEPTED
      : STATUS_CODE.PENDING
  }

  if (status === CONTRACT_STATUS.DISPUTED) {
    const challenge = item.challenges[0]
    const round = challenge.rounds[0]
    if (round.rulingTime === '0') return STATUS_CODE.DISPUTED

    if (Number(round.appealPeriodEnd) <= timestamp)
      return STATUS_CODE.WAITING_ARBITRATOR

    const appealHalfTime =
      (Number(round.appealPeriodEnd) + Number(round.appealPeriodStart)) / 2
    if (timestamp < appealHalfTime) return STATUS_CODE.CROWDFUNDING

    // has loser funded?
    const loser =
      round.ruling === SUBGRAPH_RULING.ACCEPT
        ? PARTY.CHALLENGER
        : PARTY.REQUESTER
    if (
      loser === PARTY.REQUESTER
        ? round.hasPaidRequester
        : round.hasPaidChallenger
    )
      return STATUS_CODE.CROWDFUNDING_WINNER

    return STATUS_CODE.WAITING_ARBITRATOR
  }
}
