export const NOTIFICATION_TYPES = {
  SUBMISSION_PENDING: 'SUBMISSION_PENDING',
  REMOVAL_PENDING: 'REMOVAL_PENDING',
  SUBMISSION_ACCEPTED: 'SUBMISSION_ACCEPTED',
  REMOVAL_ACCEPTED: 'REMOVAL_ACCEPTED',
  SUBMISSION_CHALLENGED: 'SUBMISSION_CHALLENGED',
  REMOVAL_CHALLENGED: 'REMOVAL_CHALLENGED',
  EVIDENCE_SUBMITTED: 'EVIDENCE_SUBMITTED',
  APPEALED: 'APPEALED',
  APPEALABLE_RULING: 'APPEALABLE_RULING',
  FINAL_RULING: 'FINAL_RULING'
}

export const typeToMessage = {
  [NOTIFICATION_TYPES.SUBMISSION_PENDING]: 'Submission pending execution.',
  [NOTIFICATION_TYPES.REMOVAL_PENDING]: 'Removal pending execution.',
  [NOTIFICATION_TYPES.SUBMISSION_ACCEPTED]: 'Submission accepted.',
  [NOTIFICATION_TYPES.REMOVAL_ACCEPTED]: 'Removal accepted.',
  [NOTIFICATION_TYPES.SUBMISSION_CHALLENGED]: 'Submission challenged.',
  [NOTIFICATION_TYPES.REMOVAL_CHALLENGED]: 'Removal challenged.',
  [NOTIFICATION_TYPES.EVIDENCE_SUBMITTED]: 'Evidence submitted.',
  [NOTIFICATION_TYPES.APPEALED]: 'Ruling appealed',
  [NOTIFICATION_TYPES.APPEALABLE_RULING]: 'The Arbitrator gave a ruling',
  [NOTIFICATION_TYPES.FINAL_RULING]: 'Ruling enforced.'
}

export const getNotificationColorFor = notificationType => {
  switch (notificationType) {
    case NOTIFICATION_TYPES.SUBMISSION_PENDING:
    case NOTIFICATION_TYPES.REMOVAL_PENDING:
      return '#ccc'
    case NOTIFICATION_TYPES.EVIDENCE_SUBMITTED:
    case NOTIFICATION_TYPES.SUBMISSION_ACCEPTED:
    case NOTIFICATION_TYPES.REMOVAL_ACCEPTED:
      return '#208efa' // Antd Blue.
    case NOTIFICATION_TYPES.APPEALED:
    case NOTIFICATION_TYPES.SUBMISSION_CHALLENGED:
    case NOTIFICATION_TYPES.REMOVAL_CHALLENGED:
      return '#fa8d39' // Antd Orange.
    case NOTIFICATION_TYPES.APPEALABLE_RULING:
      return '#722ed1' // Antd Purple.
    case NOTIFICATION_TYPES.FINAL_RULING:
      return '#f95638' // Antd Volcano.
    default:
      throw new Error('Unhandled notification type')
  }
}

export const getNotificationIconFor = notificationType => {
  switch (notificationType) {
    case NOTIFICATION_TYPES.SUBMISSION_PENDING:
    case NOTIFICATION_TYPES.REMOVAL_PENDING:
      return 'hourglass-half'
    case NOTIFICATION_TYPES.EVIDENCE_SUBMITTED:
      return 'file-alt'
    case NOTIFICATION_TYPES.SUBMISSION_ACCEPTED:
    case NOTIFICATION_TYPES.REMOVAL_ACCEPTED:
      return 'check'
    case NOTIFICATION_TYPES.APPEALED:
    case NOTIFICATION_TYPES.SUBMISSION_CHALLENGED:
    case NOTIFICATION_TYPES.REMOVAL_CHALLENGED:
      return 'balance-scale'
    case NOTIFICATION_TYPES.APPEALABLE_RULING:
    case NOTIFICATION_TYPES.FINAL_RULING:
      return 'gavel'
    default:
      throw new Error('Unhandled notification type')
  }
}
