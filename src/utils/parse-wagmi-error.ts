type ErrorLike = {
  name?: unknown
  reason?: unknown
  data?: { errorName?: unknown }
  status?: unknown
  details?: unknown
  shortMessage?: unknown
  message?: unknown
  cause?: unknown
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

const RELOAD = 'Reload the page to see where it stands.'

/**
 * The sentences Light lists (LightGeneralizedTCR) revert with, said for
 * the person at the screen. A reason
 * that is not listed is shown as the contract wrote it.
 */
const REVERT_REASON_MESSAGES = new Map<string, string>([
  [
    'Item must be absent to be added.',
    `This entry is already on the list or has a request open. ${RELOAD}`,
  ],
  [
    'Item must be registered to be removed.',
    `This entry is no longer registered. ${RELOAD}`,
  ],
  [
    'You must fully fund the request.',
    'The amount sent does not cover the deposit: it may have changed. Reload the page and try again.',
  ],
  [
    'You must fully fund the challenge.',
    'The amount sent does not cover the challenge deposit: it may have changed. Reload the page and try again.',
  ],
  [
    'You must fully fund your side.',
    'The amount sent does not cover the deposit: it may have changed. Reload the page and try again.',
  ],
  [
    'The item must have a pending request.',
    `This request is already resolved. ${RELOAD}`,
  ],
  [
    'Challenges must occur during the challenge period.',
    `The challenge period is over. ${RELOAD}`,
  ],
  [
    'The request should not have already been disputed.',
    `Someone already challenged this request. ${RELOAD}`,
  ],
  [
    'Time to challenge the request must pass.',
    'The challenge period has not ended yet.',
  ],
  [
    'The request should not be disputed.',
    'This request is in dispute: the ruling settles it.',
  ],
  ['There must be a request.', `This request was already executed. ${RELOAD}`],
  [
    'The request must not be resolved.',
    `This request is already resolved. ${RELOAD}`,
  ],
  [
    'A dispute must have been raised to fund an appeal.',
    'There is no dispute to appeal.',
  ],
  ['Side already fully funded.', 'This side of the appeal is already funded.'],
  [
    'Contributions must be made within the appeal period.',
    'The appeal period is not open.',
  ],
  [
    'The loser must contribute during the first half of the appeal period.',
    'The losing side can only be funded in the first half of the appeal period, and that half is over.',
  ],
  [
    'Request must be resolved.',
    'Rewards can be withdrawn once the request is resolved.',
  ],
  ['The caller must be the governor.', "Only the list's governor can do this."],
])

/** The first value `read` finds on the error or on one of its causes. */
const findInChain = <T>(
  error: unknown,
  read: (current: ErrorLike) => T | undefined,
): T | undefined => {
  let current = error as ErrorLike | undefined
  for (let depth = 0; current && depth < 8; depth++) {
    const found = read(current)
    if (found !== undefined) return found
    current = current.cause as ErrorLike | undefined
  }
  return undefined
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

/** viem prints its details under the first line; the first line is the news. */
const firstLine = (value: unknown): string | undefined =>
  text(value)?.split('\n')[0].trim() || undefined

const NAMES = {
  chain: new Set(['ChainMismatchError', 'ConnectorChainMismatchError']),
  funds: new Set(['InsufficientFundsError']),
  network: new Set([
    'HttpRequestError',
    'TimeoutError',
    'WebSocketRequestError',
    'LimitExceededRpcError',
  ]),
}

/**
 * What went wrong, in one sentence a person can act on. viem's errors carry
 * a headline (shortMessage) and then lines of context ("Contract Call:",
 * "Request Arguments:", "Status: 429"): those lines are never the answer.
 * In order: a Stake list's custom error, the sentence a Light list
 * reverted with, the wallet and network failures people really meet,
 * then viem's headline.
 */
export const parseWagmiError = (error: unknown): string => {
  if (!error) return ''

  const errorName = findInChain(error, (current) =>
    text(current.data?.errorName),
  )
  const contractMessage = errorName && CONTRACT_ERROR_MESSAGES.get(errorName)
  if (contractMessage) return contractMessage

  const reason = findInChain(error, (current) => text(current.reason))
  if (reason) return REVERT_REASON_MESSAGES.get(reason) ?? reason
  // A custom error with no sentence of its own: its name still says more
  // than "reverted" ("Error" and "Panic" are Solidity's own, not a name).
  if (errorName && errorName !== 'Error' && errorName !== 'Panic')
    return `The contract refused this: ${errorName}.`

  const named = (names: Set<string>) =>
    findInChain(error, (current) =>
      typeof current.name === 'string' && names.has(current.name)
        ? true
        : undefined,
    ) === true
  const everything = [
    findInChain(error, (current) => text(current.details)),
    text((error as ErrorLike).message),
  ].join(' ')

  if (named(NAMES.chain))
    return "Your wallet is on another network. Switch it to this page's network and try again."
  if (named(NAMES.funds) || /insufficient funds/i.test(everything))
    return 'Your wallet does not hold enough for this amount plus the network fee.'
  if (
    named(NAMES.network) ||
    findInChain(error, (current) =>
      current.status === 429 ? true : undefined,
    ) === true
  )
    return 'The network did not answer. Try again in a moment.'

  const headline =
    findInChain(error, (current) => firstLine(current.shortMessage)) ??
    firstLine((error as ErrorLike).message)
  return headline ?? 'Unknown error'
}
