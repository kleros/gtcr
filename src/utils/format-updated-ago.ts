import { formatDate } from './time'

interface UpdatedAgo {
  text: string
  days: number
}

/**
 * Formats an ISO date into a relative "updated X ago" string plus the raw
 * day count so callers can decide whether to emphasize recent updates.
 */
export function formatUpdatedAgo(startDate: string): UpdatedAgo | null {
  const startMs = new Date(startDate).getTime()
  if (!Number.isFinite(startMs)) return null

  const diffMs = Date.now() - startMs
  if (diffMs < 0) return { text: 'updated just now', days: 0 }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (days < 1) return { text: 'updated today', days }
  if (days === 1) return { text: 'updated 1 day ago', days }
  if (days < 30) return { text: `updated ${days} days ago`, days }

  // Months under a year: 360 to 364 days are 12 thirty-day months but not
  // yet a year, so they stay "11 months" (never "0 years").
  if (days < 365) {
    const months = Math.min(11, Math.floor(days / 30))
    if (months === 1) return { text: 'updated 1 month ago', days }
    return { text: `updated ${months} months ago`, days }
  }

  const years = Math.floor(days / 365)
  if (years === 1) return { text: 'updated 1 year ago', days }
  return { text: `updated ${years} years ago`, days }
}

export const POLICY_RECENT_THRESHOLD_DAYS = 7

/**
 * Formats an ISO date as "22 Oct 2026" for the policy history modal and
 * past-policy banner: in UTC, as every other date in the app (utils/time),
 * so a change near midnight falls on the same day as the entry times.
 */
export function formatPolicyDate(iso: string): string {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDate(ms / 1000) : '—'
}
