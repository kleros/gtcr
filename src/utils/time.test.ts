import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatAbsolute,
  formatAgo,
  formatDate,
  formatDuration,
  formatDurationLong,
  formatTimeLeft,
  secondsUntil,
  windowProgress,
} from './time'

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Unix seconds of an ISO instant. */
const unix = (iso: string): number => Date.parse(iso) / 1000

// The machine running the tests may be in any timezone (CET here): every
// instant below is chosen so that a local-time rendering would differ.
const NOW = unix('2026-11-22T12:00:00Z')

describe('formatDuration', () => {
  it.each([
    [1, '1s'],
    [59, '59s'],
    [60, '1m'],
    [12 * MINUTE + 30, '12m'],
    [HOUR - 1, '59m'],
    [HOUR, '1h'],
    [HOUR + 40 * MINUTE, '1h 40m'],
    [DAY - 1, '23h 59m'],
    [DAY, '1d'],
    [2 * DAY + 4 * HOUR, '2d 4h'],
  ])('writes %i seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })

  it('keeps the two largest units and drops the rest', () => {
    expect(formatDuration(HOUR + 59)).toBe('1h')
    expect(formatDuration(DAY + 59 * MINUTE + 59)).toBe('1d')
    expect(formatDuration(3 * DAY + 5 * HOUR + 7 * MINUTE)).toBe('3d 5h')
  })

  it('reads "0s" at zero and once passed', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(-1)).toBe('0s')
    expect(formatDuration(-3 * DAY)).toBe('0s')
  })

  it('rounds fractions down, never up to the next unit', () => {
    expect(formatDuration(0.9)).toBe('0s')
    expect(formatDuration(59.99)).toBe('59s')
    expect(formatDuration(HOUR - 0.5)).toBe('59m')
  })

  it('counts long periods in days, with no larger unit', () => {
    expect(formatDuration(400 * DAY + 5 * HOUR)).toBe('400d 5h')
    expect(formatDuration(10 * 365 * DAY)).toBe('3650d')
  })
})

describe('formatDurationLong', () => {
  it.each([
    [MINUTE, '1 min'],
    [5 * MINUTE, '5 min'],
    [HOUR, '1 hour'],
    [2 * HOUR, '2 hours'],
    [HOUR + MINUTE, '1 hour 1 min'],
    [2 * HOUR + 30 * MINUTE, '2 hours 30 min'],
    [DAY, '1 day'],
    [2 * DAY, '2 days'],
    [DAY + HOUR, '1 day 1 hour'],
    [3 * DAY + 12 * HOUR, '3 days 12 hours'],
    [365 * DAY, '365 days'],
  ])('writes %i seconds as "%s"', (seconds, text) => {
    expect(formatDurationLong(seconds)).toBe(text)
  })

  it('drops the minutes once the period runs to days', () => {
    expect(formatDurationLong(DAY + 30 * MINUTE)).toBe('1 day')
    expect(formatDurationLong(DAY + HOUR + MINUTE)).toBe('1 day 1 hour')
  })

  it('drops the seconds of anything a minute or longer', () => {
    expect(formatDurationLong(90)).toBe('1 min')
    expect(formatDurationLong(HOUR + 30)).toBe('1 hour')
  })

  it('gives the seconds under a minute, so a short period never reads as zero', () => {
    expect(formatDurationLong(1)).toBe('1 sec')
    expect(formatDurationLong(45)).toBe('45 sec')
    expect(formatDurationLong(59.5)).toBe('59 sec')
  })

  it('reads "0 min" for nothing at all', () => {
    expect(formatDurationLong(0)).toBe('0 min')
    expect(formatDurationLong(0.5)).toBe('0 min')
    expect(formatDurationLong(-HOUR)).toBe('0 min')
  })
})

describe('with the wall clock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 750 ms into the second: "now" is the whole second, rounded down.
    vi.setSystemTime(NOW * 1000 + 750)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('secondsUntil counts from the current whole second', () => {
    expect(secondsUntil(NOW + 90)).toBe(90)
    expect(secondsUntil(NOW - 30)).toBe(-30)
  })

  it('formatTimeLeft and formatAgo read the clock when no time is given', () => {
    expect(formatTimeLeft(NOW + 2 * HOUR)).toBe('2h left')
    expect(formatTimeLeft(NOW - 2 * HOUR)).toBe('ended 2h ago')
    expect(formatAgo(NOW - 3 * DAY)).toBe('3d ago')
  })

  it('windowProgress reads the clock when no time is given', () => {
    expect(windowProgress(NOW - 30, NOW + 90)).toBe(0.25)
  })

  it('takes an explicit time of 0 as given, not as missing', () => {
    expect(secondsUntil(100, 0)).toBe(100)
    expect(formatTimeLeft(100, 0)).toBe('1m left')
    expect(formatAgo(0, 0)).toBe('just now')
    expect(windowProgress(0, 100, 0)).toBe(0)
  })
})

describe('secondsUntil', () => {
  it('is positive before the deadline and negative once passed', () => {
    expect(secondsUntil(1000, 400)).toBe(600)
    expect(secondsUntil(1000, 1000)).toBe(0)
    expect(secondsUntil(400, 1000)).toBe(-600)
  })
})

describe('formatTimeLeft', () => {
  it.each([
    [2 * DAY + 4 * HOUR, '2d 4h left'],
    [45, '45s left'],
    [0, '0s left'],
    [-1, 'ended 1s ago'],
    [-3 * HOUR, 'ended 3h ago'],
    [-(DAY + 5 * MINUTE), 'ended 1d ago'],
  ])('reads a deadline %i seconds away as "%s"', (delta, text) => {
    expect(formatTimeLeft(NOW + delta, NOW)).toBe(text)
  })
})

describe('formatAgo', () => {
  it.each([
    [0, 'just now'],
    [59, 'just now'],
    [60, '1m ago'],
    [3 * HOUR, '3h ago'],
    [5 * HOUR + 12 * MINUTE, '5h 12m ago'],
    [2 * DAY, '2d ago'],
  ])('reads %i seconds back as "%s"', (delta, text) => {
    expect(formatAgo(NOW - delta, NOW)).toBe(text)
  })

  it('reads a time ahead of the clock as "just now"', () => {
    expect(formatAgo(NOW + HOUR, NOW)).toBe('just now')
  })
})

describe('formatAbsolute', () => {
  it('writes the day, month, year and 24-hour time in UTC', () => {
    expect(formatAbsolute(unix('2026-10-22T08:30:00Z'))).toBe(
      '22 Oct 2026, 08:30 UTC',
    )
  })

  it('stays on the UTC day late in the evening', () => {
    expect(formatAbsolute(unix('2026-10-22T23:59:59Z'))).toBe(
      '22 Oct 2026, 23:59 UTC',
    )
    expect(formatAbsolute(unix('2026-12-31T23:30:00Z'))).toBe(
      '31 Dec 2026, 23:30 UTC',
    )
  })

  it('writes midnight as 00, never 24', () => {
    expect(formatAbsolute(unix('2027-01-01T00:05:00Z'))).toBe(
      '1 Jan 2027, 00:05 UTC',
    )
    expect(formatAbsolute(0)).toBe('1 Jan 1970, 00:00 UTC')
  })
})

describe('formatDate', () => {
  it('writes the UTC calendar day', () => {
    expect(formatDate(unix('2026-10-22T08:30:00Z'))).toBe('22 Oct 2026')
    // Local time east of UTC is already 1 Jan, west of it still 31 Dec.
    expect(formatDate(unix('2026-12-31T23:30:00Z'))).toBe('31 Dec 2026')
    expect(formatDate(unix('2027-01-01T00:30:00Z'))).toBe('1 Jan 2027')
  })

  it('takes fractional seconds', () => {
    expect(formatDate(unix('2026-10-22T08:30:00.250Z'))).toBe('22 Oct 2026')
  })
})

describe('windowProgress', () => {
  it.each([
    [100, 0],
    [125, 0.25],
    [150, 0.5],
    [200, 1],
  ])('is the share elapsed of a 100 to 200 window at %i', (now, share) => {
    expect(windowProgress(100, 200, now)).toBe(share)
  })

  it('stays at 0 before the window opens and at 1 once it is over', () => {
    expect(windowProgress(100, 200, 0)).toBe(0)
    expect(windowProgress(100, 200, 99)).toBe(0)
    expect(windowProgress(100, 200, 201)).toBe(1)
    expect(windowProgress(100, 200, 10 * DAY)).toBe(1)
  })

  it('reads a window with no length, or ending before it starts, as over', () => {
    expect(windowProgress(100, 100, 50)).toBe(1)
    expect(windowProgress(200, 100, 150)).toBe(1)
  })
})
