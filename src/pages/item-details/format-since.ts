import { formatDuration } from 'utils/time'

/*
 * One relative form for past dates in the item heroes (submitted, settled,
 * policy updated, last evidence): exact under two days ("5h 12m ago"), then
 * the same coarse units as the policy chip ("12 days ago", "9 months ago",
 * "2 years ago"). The absolute UTC time goes in the title next to it.
 */

const DAY = 86400

/** "just now", "5h 12m ago", "12 days ago", "9 months ago", "2 years ago". */
export const formatSince = (since: number, now: number): string => {
  const seconds = Math.max(0, Math.floor(now - since))
  if (seconds < 60) return 'just now'
  if (seconds < 2 * DAY) return `${formatDuration(seconds)} ago`
  const days = Math.floor(seconds / DAY)
  if (days < 30) return `${days} days ago`
  if (days < 365) {
    const months = Math.min(11, Math.floor(days / 30))
    return months === 1 ? '1 month ago' : `${months} months ago`
  }
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

/** Whole days since a unix time, for the recent-change rule. */
export const daysSince = (since: number, now: number): number =>
  Math.floor(Math.max(0, now - since) / DAY)

export default formatSince
