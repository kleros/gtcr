type ErrorWithMetaMessages = {
  metaMessages?: string[]
  shortMessage?: string
  message?: string
}

/**
 * Tries to extract the human readable error message, otherwise reverts to error.message.
 * Ported from kleros/scout.
 */
export const parseWagmiError = (error: unknown) => {
  if (!error) return ''

  const { metaMessages, shortMessage, message } =
    error as ErrorWithMetaMessages
  const metaMessage = metaMessages?.[0]

  return metaMessage ?? shortMessage ?? message ?? 'Unknown error'
}
