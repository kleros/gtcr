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

  const months = Math.floor(days / 30)
  if (months === 1) return { text: 'updated 1 month ago', days }
  if (months < 12) return { text: `updated ${months} months ago`, days }

  const years = Math.floor(days / 365)
  if (years === 1) return { text: 'updated 1 year ago', days }
  return { text: `updated ${years} years ago`, days }
}

export const POLICY_RECENT_THRESHOLD_DAYS = 7

/**
 * Formats an ISO date as a short "Mmm D, YYYY" string for the policy
 * history modal and past-policy banner.
 */
export function formatPolicyDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
