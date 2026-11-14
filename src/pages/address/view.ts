import type { EntryStatusView } from 'components/curate/entry-status'
import { ZERO_ADDRESS } from 'pages/dashboard/data'
import type { RegistryKind } from 'pages/dashboard/types'
import {
  SUPPORTED_CHAIN_IDS,
  type AddressStats,
  type ProfileActivity,
} from './data'

/*
 * Pure helpers for the curator profile: which actions a filter shows, the
 * status each action is rendered with, the window the data covers and the
 * chains the address is active on. Everything derives from the data layer.
 */

export const PAGE_SIZE = 20

export type ActivityFilter =
  | 'all'
  | 'submission'
  | 'removal'
  | 'challenge'
  | 'disputed'

export const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All actions' },
  { value: 'submission', label: 'Submissions' },
  { value: 'removal', label: 'Removals' },
  { value: 'challenge', label: 'Challenges' },
  { value: 'disputed', label: 'Disputed' },
]

export const parseFilter = (value: string | null): ActivityFilter =>
  FILTERS.some((filter) => filter.value === value)
    ? (value as ActivityFilter)
    : 'all'

/**
 * The listed actions a filter shows. Every tab counts the same population,
 * the listed actions: "Disputed" is those whose request went to court.
 */
export const filterActivities = (
  activities: ProfileActivity[],
  filter: ActivityFilter,
): ProfileActivity[] => {
  if (filter === 'all') return activities
  if (filter === 'disputed')
    return activities.filter((activity) => activity.disputed)
  return activities.filter((activity) => activity.kind === filter)
}

export const filterCount = (
  activities: ProfileActivity[],
  filter: ActivityFilter,
): number => filterActivities(activities, filter).length

/**
 * What the request behind an action is up to, from the state the data layer
 * carries: nothing when it says nothing, "pending" while the request is
 * unresolved, "in court" while its dispute is open, then the ruling seen
 * from this address's side (Accept favors the requester, Reject the
 * challenger, None is no ruling).
 */
const activityDetail = (activity: ProfileActivity): string | undefined => {
  if (activity.disputed) {
    if (activity.resolved === false) return 'in court'
    if (activity.resolved !== true) return undefined
    const outcome = activity.disputeOutcome
    if (outcome === 'None') return 'no ruling'
    if (outcome !== 'Accept' && outcome !== 'Reject') return 'dispute resolved'
    const requesterWon = outcome === 'Accept'
    const won = activity.kind === 'challenge' ? !requesterWon : requesterWon
    return won ? 'dispute won' : 'dispute lost'
  }
  if (activity.resolved === false) return 'pending'
  return undefined
}

/**
 * Dot and label for an action. Actions are events, not entry states, so the
 * dot stays grey; it turns amber only while the request's dispute is still
 * open. The label is the data layer's own wording ("Submitted entry",
 * "Challenged dispute #12").
 */
export const activityStatus = (activity: ProfileActivity): EntryStatusView => ({
  tone:
    activity.disputed && activity.resolved === false ? 'contested' : 'neutral',
  label: activity.status,
  detail: activityDetail(activity),
})

/** The counterparty of an action, if the data names one. */
export const otherParty = (
  activity: ProfileActivity,
  address: string,
): string | undefined =>
  [activity.actor, activity.secondaryActor].find(
    (party) => party && party !== address && party !== ZERO_ADDRESS,
  )

export const registryHref = (activity: ProfileActivity): string =>
  `/tcr/${activity.chainId}/${activity.registryAddress}`

/** Oldest and newest timestamps among the listed actions. */
export const coverage = (
  activities: ProfileActivity[],
): { oldest: number; newest: number } | undefined => {
  let oldest = Number.POSITIVE_INFINITY
  let newest = 0
  for (const activity of activities) {
    if (activity.timestamp <= 0) continue
    oldest = Math.min(oldest, activity.timestamp)
    newest = Math.max(newest, activity.timestamp)
  }
  return newest > 0 ? { oldest, newest } : undefined
}

export interface ChainActivity {
  chainId: number
  stats: AddressStats
}

/** Chains where the address acted or governs a list, busiest first. */
export const activeChains = (
  breakdown: Record<number, AddressStats> | undefined,
): ChainActivity[] =>
  Object.entries(breakdown ?? {})
    .map(([chainId, stats]) => ({ chainId: Number(chainId), stats }))
    .filter(({ stats }) => stats.activity > 0 || stats.governedLists > 0)
    .sort((a, b) => b.stats.activity - a.stats.activity)

export const kindLabel = (kind: RegistryKind): string => {
  if (kind === 'light') return 'Light'
  if (kind === 'permanent') return 'Stake'
  return 'Classic'
}

const integer = new Intl.NumberFormat('en-US')
export const formatInt = (value: number): string =>
  integer.format(Math.round(value))

/* ---------- Scope ---------- */

/** Every figure, the chart and the lists describe one scope: all chains or one. */
export type Scope = 'all' | number

export const parseScope = (value: string | null): Scope => {
  const chainId = Number(value)
  return value && (SUPPORTED_CHAIN_IDS as number[]).includes(chainId)
    ? chainId
    : 'all'
}

export const inScope = (scope: Scope, chainId: number): boolean =>
  scope === 'all' || scope === chainId

/* ---------- Activity over time ---------- */

const HOUR = 3_600
const DAY = 86_400

export type BucketUnit = 'hour' | 'day' | 'week' | 'month'

export interface ActivityBuckets {
  unit: BucketUnit
  /** Unix seconds each bucket starts at (UTC), oldest first. */
  starts: number[]
  /** One full label per bucket, for the tooltip ("Week of 6 Oct 2026"). */
  labels: string[]
  /** One short label per bucket, for the axis ("6 Oct", "Oct 2026", "14:00"). */
  axisLabels: string[]
  /** Submissions and removal requests made by the address. */
  requests: number[]
  /** Challenges the address raised. */
  challenges: number[]
  /**
   * Set when the first bucket is only partly covered by the listed actions
   * (the list was cut inside it and no full bucket could replace it): the
   * time its listed actions start from, unix seconds.
   */
  partialFrom?: number
}

const dayStart = (t: number) => Math.floor(t / DAY) * DAY
const weekStart = (t: number) => {
  const day = dayStart(t)
  // Weeks start on Monday (UTC).
  return day - ((new Date(day * 1000).getUTCDay() + 6) % 7) * DAY
}
const monthStart = (t: number) => {
  const date = new Date(t * 1000)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000
}
const nextStart = (start: number, unit: BucketUnit) => {
  if (unit === 'hour') return start + HOUR
  if (unit === 'day') return start + DAY
  if (unit === 'week') return start + 7 * DAY
  const date = new Date(start * 1000)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000
}
const bucketOf = (t: number, unit: BucketUnit) =>
  unit === 'hour'
    ? Math.floor(t / HOUR) * HOUR
    : unit === 'day'
      ? dayStart(t)
      : unit === 'week'
        ? weekStart(t)
        : monthStart(t)

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const monthLabel = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const hourLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

const fullDayLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const clockLabel = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

/** Full label of a bucket: "8 Oct 2026", "Week of 6 Oct 2026", "Oct 2026". */
export const bucketLabel = (start: number, unit: BucketUnit): string => {
  const date = new Date(start * 1000)
  if (unit === 'hour') return `${hourLabel.format(date)} UTC`
  if (unit === 'month') return monthLabel.format(date)
  if (unit === 'week') return `Week of ${fullDayLabel.format(date)}`
  return fullDayLabel.format(date)
}

/** Short label of a bucket for the axis: "8 Oct", "Oct 2026", "14:00". */
export const bucketAxisLabel = (start: number, unit: BucketUnit): string => {
  const date = new Date(start * 1000)
  if (unit === 'hour') return clockLabel.format(date)
  if (unit === 'month') return monthLabel.format(date)
  return dayLabel.format(date)
}

/**
 * The listed actions counted per bucket, up to now. The bucket grows with the
 * span the actions cover (day up to three months, then week, then month) so
 * the chart stays readable. When the list is complete, the window starts at
 * least two weeks back: days before the first action are true zeros. When it
 * is only the most recent slice, the list was cut inside the bucket holding
 * its oldest action, so the window starts at the next bucket: nothing missing
 * is drawn, neither as a zero nor as a short count. Only when that would
 * leave fewer than two buckets is the cut bucket kept, marked as partial.
 */
export const activityBuckets = (
  activities: ProfileActivity[],
  now: number,
  complete: boolean,
): ActivityBuckets | undefined => {
  const stamped = activities.filter(
    (activity) => activity.timestamp > 0 && activity.timestamp <= now,
  )
  if (stamped.length === 0) return undefined
  const oldest = Math.min(...stamped.map((activity) => activity.timestamp))
  let from = dayStart(oldest)
  if (complete) from = Math.min(from, dayStart(now) - 13 * DAY)
  const spanDays = (dayStart(now) - from) / DAY + 1
  const unit: BucketUnit =
    !complete && spanDays <= 3
      ? 'hour'
      : spanDays <= 92
        ? 'day'
        : spanDays <= 7 * 104
          ? 'week'
          : 'month'

  const starts: number[] = []
  const last = bucketOf(now, unit)
  for (
    let start = bucketOf(unit === 'hour' ? oldest : from, unit);
    start <= last;
    start = nextStart(start, unit)
  )
    starts.push(start)
  let partialFrom: number | undefined
  if (!complete)
    if (starts.length > 2) starts.shift()
    else partialFrom = oldest

  if (starts.length < 2) return undefined

  const position = new Map(starts.map((start, index) => [start, index]))
  const requests = starts.map(() => 0)
  const challenges = starts.map(() => 0)
  for (const activity of stamped) {
    const index = position.get(bucketOf(activity.timestamp, unit))
    if (index === undefined) continue
    if (activity.kind === 'challenge') challenges[index] += 1
    else requests[index] += 1
  }

  const labels = starts.map((start) => bucketLabel(start, unit))
  if (partialFrom !== undefined) {
    const at = new Date(partialFrom * 1000)
    labels[0] = `${labels[0]} · listed from ${
      unit === 'hour' || unit === 'day'
        ? clockLabel.format(at)
        : hourLabel.format(at)
    } UTC`
  }

  return {
    unit,
    starts,
    labels,
    axisLabels: starts.map((start) => bucketAxisLabel(start, unit)),
    requests,
    challenges,
    partialFrom,
  }
}

/* ---------- Where the address curates ---------- */

export interface RegistryShare {
  key: string
  chainId: number
  title: string
  href: string
  logo?: string
  /** The list is Kleros Verified. */
  verified?: boolean
  count: number
}

/** The lists the listed actions touch, busiest first. */
export const registryShares = (
  activities: ProfileActivity[],
): RegistryShare[] => {
  const shares = new Map<string, RegistryShare>()
  for (const activity of activities) {
    const key = `${activity.chainId}:${activity.registryAddress}`
    const share = shares.get(key)
    if (share) share.count += 1
    else
      shares.set(key, {
        key,
        chainId: activity.chainId,
        title: activity.registryTitle,
        href: registryHref(activity),
        logo: activity.registryLogo,
        verified: activity.registryVerified,
        count: 1,
      })
  }
  return [...shares.values()].sort((a, b) => b.count - a.count)
}

/* ---------- Challenge record ---------- */

export interface ChallengeRecord {
  /** Ruled for the challenger. */
  won: number
  /** Ruled for the requester. */
  lost: number
  /** Resolved without a ruling. */
  noRuling: number
  /** Dispute still open (voting or appeal). */
  inCourt: number
  /** won + lost + noRuling. */
  decided: number
  /** Every challenge: decided + inCourt. */
  total: number
}

/** Where the address's challenges stand, from the scope's figures. */
export const challengeRecord = (stats: AddressStats): ChallengeRecord => {
  const won = stats.successfulChallenges
  const lost = stats.challengesLost
  const noRuling = stats.challengesNoRuling
  const inCourt = stats.challengesInCourt
  const decided = won + lost + noRuling
  return { won, lost, noRuling, inCourt, decided, total: decided + inCourt }
}
