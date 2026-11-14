/*
 * What an entry or list page says when it cannot show what the link asks
 * for. A read that failed and a thing that is not there are told apart:
 * the first offers "Try again", the second says what to check. Reads use
 * the chain in the URL, so the wallet's network is never the cause.
 */
export const ENTRY_LINK_TIP =
  'Check the link: the chain and the list in it must be the ones the entry lives on.'

export const ENTRY_LOAD_FAILED =
  "The indexer that serves Curate's data did not answer. Try again in a moment."

export const ENTRY_MISSING_TIP =
  'Check the link. An entry sent a moment ago can take a minute or two to appear; this page keeps looking.'

/** A list (or its entries) the indexer did not serve. */
export const LIST_LOAD_FAILED = ENTRY_LOAD_FAILED

export const LIST_LINK_TIP =
  'Check the address, and that the chain in the URL is the one the list lives on.'

/** An entry sent a moment ago that the indexer has not picked up yet. */
export const ENTRY_INDEXING_TITLE = 'Your entry is on chain'
export const ENTRY_INDEXING_MESSAGE =
  'It shows here as soon as the indexer has it, usually within a minute. This page updates by itself.'

/** How long after a submission a missing entry is taken as still indexing. */
export const INDEXING_GRACE_MS = 15 * 60_000

/**
 * When a missing entry is looked for again, by how many answers have come
 * back so far; false once it is time to settle on "not found". A link to an
 * entry is tried for two minutes. An entry this reader just submitted is
 * looked for every 5 seconds for the first two minutes (it usually shows
 * within one), then every 30 until the grace above runs out: each look is a
 * request against a limit every visitor shares.
 */
export const missingEntryPollMs = (
  answers: number,
  recentlySubmitted: boolean,
): number | false => {
  if (!recentlySubmitted) return answers < 12 ? 10_000 : false
  if (answers < 24) return 5_000
  return answers < 50 ? 30_000 : false
}

/** The submission time a page was opened with (see submit-item), if recent. */
export const justSubmitted = (state: unknown): boolean => {
  const submittedAt = (state as { submittedAt?: unknown } | null)?.submittedAt
  return (
    typeof submittedAt === 'number' &&
    Date.now() - submittedAt < INDEXING_GRACE_MS
  )
}
