/*
 * The Light wizard's starting values that the launch page also shows
 * ("Back in 3d 12h", "Base deposit 0.05"). One source, so the page that
 * describes a new list and the wizard that deploys it cannot drift apart.
 */
export const LIGHT_WIZARD_DEFAULTS = {
  submissionBaseDeposit: 0.05,
  removalBaseDeposit: 0.05,
  /** Hours. */
  challengePeriodDuration: 84,
} as const
