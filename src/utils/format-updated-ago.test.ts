import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatPolicyDate, formatUpdatedAgo } from './format-updated-ago'

const HOUR = 60 * 60
const DAY = 24 * HOUR
const NOW_MS = Date.parse('2026-11-22T12:00:00Z')

/** The ISO time `seconds` before the pinned clock. */
const ago = (seconds: number): string =>
  new Date(NOW_MS - seconds * 1000).toISOString()

describe('formatUpdatedAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    [0, 'updated today', 0],
    [DAY - 1, 'updated today', 0],
    [DAY, 'updated 1 day ago', 1],
    [2 * DAY - 1, 'updated 1 day ago', 1],
    [2 * DAY, 'updated 2 days ago', 2],
    [29 * DAY, 'updated 29 days ago', 29],
    [30 * DAY, 'updated 1 month ago', 30],
    [59 * DAY, 'updated 1 month ago', 59],
    [60 * DAY, 'updated 2 months ago', 60],
    [359 * DAY, 'updated 11 months ago', 359],
    [365 * DAY, 'updated 1 year ago', 365],
    [729 * DAY, 'updated 1 year ago', 729],
    [730 * DAY, 'updated 2 years ago', 730],
  ])('reads %i seconds back as "%s" (%i days)', (seconds, text, days) => {
    expect(formatUpdatedAgo(ago(seconds))).toEqual({ text, days })
  })

  it('stays "11 months" from 360 to 364 days, never "12 months" or "0 years"', () => {
    for (const days of [360, 362, 364])
      expect(formatUpdatedAgo(ago(days * DAY))).toEqual({
        text: 'updated 11 months ago',
        days,
      })
  })

  it('reads a date ahead of the clock as just now', () => {
    expect(formatUpdatedAgo(ago(-HOUR))).toEqual({
      text: 'updated just now',
      days: 0,
    })
  })

  it('reads dates with an offset or without a time', () => {
    // 13:00 at UTC+2 is 11:00 UTC, an hour before the clock.
    expect(formatUpdatedAgo('2026-11-22T13:00:00+02:00')).toEqual({
      text: 'updated today',
      days: 0,
    })
    // A bare date is midnight UTC.
    expect(formatUpdatedAgo('2026-11-20')).toEqual({
      text: 'updated 2 days ago',
      days: 2,
    })
  })

  it.each(['', 'not a date', '2026-13-45T00:00:00Z'])(
    'gives nothing for an unreadable date (%j)',
    (input) => {
      expect(formatUpdatedAgo(input)).toBeNull()
    },
  )
})

describe('formatPolicyDate', () => {
  it('writes the UTC calendar day', () => {
    expect(formatPolicyDate('2026-10-22T08:30:00Z')).toBe('22 Oct 2026')
    expect(formatPolicyDate('2026-10-22T08:30:00.123Z')).toBe('22 Oct 2026')
  })

  it('puts a change near midnight on its UTC day', () => {
    expect(formatPolicyDate('2026-10-22T23:30:00Z')).toBe('22 Oct 2026')
    expect(formatPolicyDate('2026-10-23T00:15:00Z')).toBe('23 Oct 2026')
    // 23:30 at UTC-5 is 04:30 UTC the next day.
    expect(formatPolicyDate('2026-10-22T23:30:00-05:00')).toBe('23 Oct 2026')
  })

  it.each(['', 'soon', '2026-10-22T25:00:00Z'])(
    'writes a dash for an unreadable date (%j)',
    (input) => {
      expect(formatPolicyDate(input)).toBe('—')
    },
  )
})
