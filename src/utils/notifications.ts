import type { IconName } from '@fortawesome/fontawesome-svg-core'

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
  FINAL_RULING: 'FINAL_RULING',
  HAS_PAID_FEES: 'HAS_PAID_FEES',
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
  [NOTIFICATION_TYPES.FINAL_RULING]: 'Ruling enforced.',
  [NOTIFICATION_TYPES.HAS_PAID_FEES]: 'Side fully funded',
}

const NOTIFICATION_CONFIG: Record<string, { color: string; icon: IconName }> = {
  [NOTIFICATION_TYPES.SUBMISSION_PENDING]: {
    color: 'var(--status-neutral)',
    icon: 'hourglass-half',
  },
  [NOTIFICATION_TYPES.REMOVAL_PENDING]: {
    color: 'var(--status-neutral)',
    icon: 'hourglass-half',
  },
  [NOTIFICATION_TYPES.EVIDENCE_SUBMITTED]: {
    color: 'var(--status-registered)',
    icon: 'file-alt',
  },
  [NOTIFICATION_TYPES.SUBMISSION_ACCEPTED]: {
    color: 'var(--status-registered)',
    icon: 'check',
  },
  [NOTIFICATION_TYPES.REMOVAL_ACCEPTED]: {
    color: 'var(--status-registered)',
    icon: 'check',
  },
  [NOTIFICATION_TYPES.APPEALED]: {
    color: 'var(--status-contested)',
    icon: 'balance-scale',
  },
  [NOTIFICATION_TYPES.SUBMISSION_CHALLENGED]: {
    color: 'var(--status-contested)',
    icon: 'balance-scale',
  },
  [NOTIFICATION_TYPES.REMOVAL_CHALLENGED]: {
    color: 'var(--status-contested)',
    icon: 'balance-scale',
  },
  [NOTIFICATION_TYPES.APPEALABLE_RULING]: {
    color: 'var(--status-contested)',
    icon: 'gavel',
  },
  [NOTIFICATION_TYPES.HAS_PAID_FEES]: {
    color: 'var(--status-contested)',
    icon: 'exclamation-triangle',
  },
  [NOTIFICATION_TYPES.FINAL_RULING]: {
    color: 'var(--status-off)',
    icon: 'gavel',
  },
}

export const getNotificationColorFor = (notificationType: string): string => {
  const config = NOTIFICATION_CONFIG[notificationType]
  if (!config) throw new Error('Unhandled notification type')
  return config.color
}

export const getNotificationIconFor = (notificationType: string): IconName => {
  const config = NOTIFICATION_CONFIG[notificationType]
  if (!config) throw new Error('Unhandled notification type')
  return config.icon
}
