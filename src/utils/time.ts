/**
 * Time formatting for deadlines (DESIGN.md: write deadlines both ways, relative
 * and absolute with timezone). All inputs are unix seconds.
 */

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "2d 4h", "1h 40m", "12m", "45s"; "0s" once passed. */
export const formatDuration = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  if (s === 0) return '0s'
  const days = Math.floor(s / DAY)
  const hours = Math.floor((s % DAY) / HOUR)
  const minutes = Math.floor((s % HOUR) / MINUTE)
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${s}s`
}

/** "3 days 12 hours" style for policy copy (challenge periods, court periods). */
export const formatDurationLong = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  const parts: string[] = []
  const days = Math.floor(s / DAY)
  const hours = Math.floor((s % DAY) / HOUR)
  const minutes = Math.floor((s % HOUR) / MINUTE)
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (!days && minutes) parts.push(`${minutes} min`)
  return parts.join(' ') || '0 min'
}

/** Seconds from `now` (default: the wall clock) to `deadline`; negative once passed. */
export const secondsUntil = (deadline: number, now?: number): number =>
  deadline - (now ?? Math.floor(Date.now() / 1000))

/** "2d 4h left" / "ended 3h ago". */
export const formatTimeLeft = (deadline: number, now?: number): string => {
  const delta = secondsUntil(deadline, now)
  return delta >= 0
    ? `${formatDuration(delta)} left`
    : `ended ${formatDuration(-delta)} ago`
}

/** "3h ago", "2d ago"; "just now" under a minute. */
export const formatAgo = (timestamp: number, now?: number): string => {
  const delta = (now ?? Math.floor(Date.now() / 1000)) - timestamp
  if (delta < MINUTE) return 'just now'
  return `${formatDuration(delta)} ago`
}

const absoluteFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  hour12: false,
})

/** "22 Oct 2026, 08:30 UTC" */
export const formatAbsolute = (timestamp: number): string =>
  `${absoluteFormatter.format(new Date(timestamp * 1000))} UTC`

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "22 Oct 2026" */
export const formatDate = (timestamp: number): string =>
  dateFormatter.format(new Date(timestamp * 1000))

/** Share of a window elapsed, clamped to [0, 1]. */
export const windowProgress = (
  start: number,
  end: number,
  now?: number,
): number => {
  const current = now ?? Math.floor(Date.now() / 1000)
  if (end <= start) return 1
  return Math.min(1, Math.max(0, (current - start) / (end - start)))
}
