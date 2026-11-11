type ErrorWithMetaMessages = {
  metaMessages?: string[]
  shortMessage?: string
  message?: string
}

/**
 * The custom errors a Stake Curate list (PermanentGTCR) reverts with, in
 * plain words. viem decodes them by name from the list's ABI; left alone,
 * the message would only read "Error: BelowArbitrationDeposit()".
 */
const CONTRACT_ERROR_MESSAGES = new Map<string, string>([
  ['AlreadyInitialized', 'This list is already set up.'],
  ['AppealAlreadyFunded', 'This side of the appeal is already fully funded.'],
  [
    'AppealLoserNotWithinPeriod',
    'The losing side can only be funded in the first half of the appeal period, and that half is over.',
  ],
  ['AppealNotRtA', 'Pick the side you want to fund.'],
  ['AppealNotWithinPeriod', 'The appeal period is not open.'],
  ['ArbitratorOnly', 'Only the arbitrator can do this.'],
  [
    'BelowArbitrationDeposit',
    'The amount sent does not cover the arbitration cost. Reload the page and try again.',
  ],
  ['BelowDeposit', "The stake is below the list's minimum."],
  ['GovernorOnly', "Only the list's governor can do this."],
  [
    'ItemWithdrawingAlready',
    'A withdrawal was already started for this entry.',
  ],
  ['ItemWithdrawingNotYet', 'The withdrawing period has not ended yet.'],
  [
    'ItemWrongStatus',
    "The entry's status no longer allows this. Reload the page to see where it stands.",
  ],
  [
    'RewardsPendingDispute',
    'Rewards can be withdrawn once the dispute is resolved.',
  ],
  ['RulingInvalidOption', 'That ruling is not one of the options.'],
  ['SubmitterOnly', 'Only the account that submitted this entry can do this.'],
  [
    'TransferFailed',
    'The token transfer failed. Check your balance and the amount you approved.',
  ],
])

/** The name of a custom error decoded anywhere in the error's cause chain. */
const decodedErrorName = (error: unknown): string | undefined => {
  let current = error as
    | { data?: { errorName?: unknown }; cause?: unknown }
    | undefined
  for (let depth = 0; current && depth < 8; depth++) {
    const name = current.data?.errorName
    if (typeof name === 'string') return name
    current = current.cause as typeof current
  }
  return undefined
}

/**
 * Tries to extract the human readable error message, otherwise reverts to error.message.
 * Ported from kleros/scout.
 */
export const parseWagmiError = (error: unknown) => {
  if (!error) return ''

  const errorName = decodedErrorName(error)
  const contractMessage = errorName && CONTRACT_ERROR_MESSAGES.get(errorName)
  if (contractMessage) return contractMessage

  const { metaMessages, shortMessage, message } = error as ErrorWithMetaMessages
  const metaMessage = metaMessages?.[0]

  return metaMessage ?? shortMessage ?? message ?? 'Unknown error'
}
