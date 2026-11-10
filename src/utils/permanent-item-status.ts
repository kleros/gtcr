import { BigNumber } from 'ethers'
import { PARTY, SUBGRAPH_RULING, DISPUTE_STATUS } from './status-constants'

export { PARTY, SUBGRAPH_RULING, DISPUTE_STATUS }

export const CONTRACT_STATUS = {
  ABSENT: 'Absent',
  SUBMITTED: 'Submitted',
  REINCLUDED: 'Reincluded',
  DISPUTED: 'Disputed',
}

export const STATUS_CODE = {
  REJECTED: 0,
  PENDING: 1,
  ACCEPTED: 2,
  DISPUTED: 3,
  CROWDFUNDING: 4,
  CROWDFUNDING_WINNER: 5,
  WAITING_ARBITRATOR: 6,
  PENDING_WITHDRAWAL: 7,
  REMOVED: 8,
  WITHDRAWN: 9,
}

export const STATUS_TEXT = {
  [STATUS_CODE.REJECTED]: 'Rejected',
  [STATUS_CODE.PENDING]: 'Pending',
  [STATUS_CODE.ACCEPTED]: 'Accepted',
  [STATUS_CODE.DISPUTED]: 'Disputed',
  [STATUS_CODE.CROWDFUNDING]: 'Crowdfunding',
  [STATUS_CODE.CROWDFUNDING_WINNER]: 'Crowdfunding Winner',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'Waiting Arbitrator',
  [STATUS_CODE.PENDING_WITHDRAWAL]: 'Pending Withdrawal',
  [STATUS_CODE.REMOVED]: 'Removed',
  [STATUS_CODE.WITHDRAWN]: 'Withdrawn',
}

/** DESIGN.md status roles for Stake Curate items; see utils/item-status.ts. */
export const STATUS_ROLE = {
  [STATUS_CODE.REJECTED]: 'off',
  [STATUS_CODE.PENDING]: 'window',
  [STATUS_CODE.ACCEPTED]: 'registered',
  [STATUS_CODE.DISPUTED]: 'contested',
  [STATUS_CODE.CROWDFUNDING]: 'contested',
  [STATUS_CODE.CROWDFUNDING_WINNER]: 'contested',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'contested',
  [STATUS_CODE.PENDING_WITHDRAWAL]: 'neutral',
  [STATUS_CODE.REMOVED]: 'off',
  [STATUS_CODE.WITHDRAWN]: 'off',
} as const

export const STATUS_COLOR: Record<number, string> = Object.fromEntries(
  Object.entries(STATUS_ROLE).map(([code, role]) => [
    Number(code),
    `var(--status-${role})`,
  ]),
)

export const getActionLabel = ({
  statusCode,
  itemName = 'item',
}: {
  statusCode: number
  itemName?: string
}): string => {
  switch (statusCode) {
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REMOVED:
    case STATUS_CODE.WITHDRAWN:
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

export const itemToStatusCode = (
  item: SubgraphItem,
  timestamp: BigNumber,
  registry: SubgraphRegistry,
): number | undefined => {
  const { status } = item
  const ts = timestamp.toNumber()

  if (status === CONTRACT_STATUS.ABSENT) {
    // The only paths to Absent are withdrawItem() and rule(). Dispute removals carry a
    // resolution tx, so a latest-submission withdrawingTx can identify a completed
    // voluntary withdrawal. This intercepts that case only; every other Absent item
    // still falls through to the REJECTED/REMOVED logic unchanged.
    // Note: in list views these fields may be absent from the query, so detection simply
    // (and safely) falls through to REMOVED/REJECTED.
    const submissions = (item.submissions as { withdrawingTx?: string }[]) || []
    const withdrawingTx =
      submissions.length > 0 ? submissions[0].withdrawingTx : null
    if (withdrawingTx) return STATUS_CODE.WITHDRAWN

    // Differentiate between rejected (never made it past submission) and removed (was accepted then taken off)
    // If includedAt + submissionPeriod < timestamp, the item passed submission and was accepted at some point
    const submissionPeriod = Number(registry?.submissionPeriod || 0)
    const includedAt = Number(item.includedAt || 0)
    // Only classify as REMOVED if we have valid includedAt AND submissionPeriod
    // This ensures we don't misclassify when data is missing
    if (
      includedAt > 0 &&
      submissionPeriod > 0 &&
      includedAt + submissionPeriod < ts
    )
      return STATUS_CODE.REMOVED
    return STATUS_CODE.REJECTED
  }
  if (
    status === CONTRACT_STATUS.SUBMITTED ||
    status === CONTRACT_STATUS.REINCLUDED
  )
    if (
      Number(item.withdrawingTimestamp) > 0 &&
      Number(item.withdrawingTimestamp) + Number(registry.withdrawingPeriod) <
        ts
    )
      return STATUS_CODE.PENDING_WITHDRAWAL

  if (status === CONTRACT_STATUS.SUBMITTED) {
    const period = Number(registry.submissionPeriod)
    return period + Number(item.includedAt) < ts
      ? STATUS_CODE.ACCEPTED
      : STATUS_CODE.PENDING
  }

  if (status === CONTRACT_STATUS.REINCLUDED) {
    const period = Number(registry.reinclusionPeriod)

    return period + Number(item.includedAt) < ts
      ? STATUS_CODE.ACCEPTED
      : STATUS_CODE.PENDING
  }

  if (status === CONTRACT_STATUS.DISPUTED) {
    const challenge = item.challenges![0]
    const round = challenge.rounds[0]
    if (round.rulingTime === '0') return STATUS_CODE.DISPUTED

    if (Number(round.appealPeriodEnd) <= ts)
      return STATUS_CODE.WAITING_ARBITRATOR

    const appealHalfTime =
      (Number(round.appealPeriodEnd) + Number(round.appealPeriodStart)) / 2
    if (ts < appealHalfTime) return STATUS_CODE.CROWDFUNDING

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
