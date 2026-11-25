/*
 * Which of a Stake list's arbitration settings applies to an entry, the way
 * PermanentGTCR.challengeItem picks it: walking the settings from the newest
 * down, the first one that took effect either at least the cooldown before
 * the reference time or no later than the entry's inclusion. The reference
 * time is the start of the entry's withdrawal if one was started, else the
 * moment of the challenge. So a new court or juror count reaches entries
 * included before it only once the cooldown has passed, and a challenge
 * raised in between pays the older setting's arbitration cost and is judged
 * under its policy.
 */

export interface TimedSetting {
  timestamp?: string | number | null
}

const seconds = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** The setting a challenge raised at `at` uses; undefined without settings. */
export const challengeSetting = <T extends TimedSetting>(
  settings: readonly T[] | null | undefined,
  {
    includedAt,
    withdrawingAt,
    cooldown,
    at,
  }: {
    /** When the entry was last submitted or reincluded. */
    includedAt: number
    /** When its submitter started a withdrawal; 0 if none was started. */
    withdrawingAt: number
    /** The list's arbitrationParamsCooldown, in seconds. */
    cooldown: number
    at: number
  },
): T | undefined => {
  if (!settings?.length) return undefined
  // Newest first. The sort is stable: equal times keep the subgraph's order.
  const newestFirst = [...settings].sort(
    (a, b) => seconds(b.timestamp) - seconds(a.timestamp),
  )
  const epoch = withdrawingAt > 0 ? withdrawingAt : at
  const oldest = newestFirst.length - 1
  for (let index = 0; index < oldest; index++) {
    const since = seconds(newestFirst[index].timestamp)
    if (epoch - cooldown >= since || includedAt >= since)
      return newestFirst[index]
  }
  // The contract stores the first setting with timestamp 0 (the subgraph
  // keeps its block time), so it always qualifies.
  return newestFirst[oldest]
}

/**
 * The setting an entry answers to: for a running dispute, the one its
 * challenge used; for a listed entry, the one a challenge raised `now` would
 * use. Undefined off the list, where a new submission takes the newest.
 */
export const entrySetting = <T extends TimedSetting>(
  settings: readonly T[] | null | undefined,
  {
    status,
    includedAt,
    withdrawingAt,
    challengedAt,
    cooldown,
    now,
  }: {
    /** The contract status, as the subgraph names it. */
    status: string
    includedAt: number
    withdrawingAt: number
    /** When the latest challenge was raised; 0 if there is none. */
    challengedAt: number
    cooldown: number
    now: number
  },
): T | undefined => {
  if (status === 'Absent') return undefined
  if (status === 'Disputed' && challengedAt > 0)
    return challengeSetting(settings, {
      includedAt,
      // A withdrawal started after the challenge did not exist when the
      // contract picked the setting.
      withdrawingAt:
        withdrawingAt > 0 && withdrawingAt <= challengedAt ? withdrawingAt : 0,
      cooldown,
      at: challengedAt,
    })
  return challengeSetting(settings, {
    includedAt,
    withdrawingAt,
    cooldown,
    at: now,
  })
}
