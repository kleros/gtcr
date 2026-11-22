import { describe, expect, it } from 'vitest'
import { daysSince, formatSince } from './format-since'

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const NOW = Date.parse('2026-11-22T12:00:00Z') / 1000

describe('formatSince', () => {
  it.each([
    [0, 'just now'],
    [59, 'just now'],
    [60, '1m ago'],
    [5 * HOUR + 12 * MINUTE, '5h 12m ago'],
    [DAY, '1d ago'],
    [2 * DAY - 1, '1d 23h ago'],
  ])('is exact under two days: %i seconds is "%s"', (seconds, text) => {
    expect(formatSince(NOW - seconds, NOW)).toBe(text)
  })

  it.each([
    [2 * DAY, '2 days ago'],
    [29 * DAY + 23 * HOUR, '29 days ago'],
    [30 * DAY, '1 month ago'],
    [59 * DAY, '1 month ago'],
    [60 * DAY, '2 months ago'],
    [270 * DAY, '9 months ago'],
    [359 * DAY, '11 months ago'],
    [365 * DAY, '1 year ago'],
    [729 * DAY, '1 year ago'],
    [730 * DAY, '2 years ago'],
    [3650 * DAY, '10 years ago'],
  ])('is coarse from two days: %i seconds is "%s"', (seconds, text) => {
    expect(formatSince(NOW - seconds, NOW)).toBe(text)
  })

  it('never reads "12 months" in the days before a full year', () => {
    expect(formatSince(NOW - 360 * DAY, NOW)).toBe('11 months ago')
    expect(formatSince(NOW - (365 * DAY - 1), NOW)).toBe('11 months ago')
  })

  it('reads a time ahead of now as "just now"', () => {
    expect(formatSince(NOW + HOUR, NOW)).toBe('just now')
  })

  it('rounds fractional seconds down', () => {
    expect(formatSince(0, 59.9)).toBe('just now')
    expect(formatSince(0, 60.1)).toBe('1m ago')
  })
})

describe('daysSince', () => {
  it.each([
    [0, 0],
    [DAY - 1, 0],
    [DAY, 1],
    [10 * DAY + 5, 10],
    [400 * DAY, 400],
  ])('counts %i seconds as %i whole days', (seconds, days) => {
    expect(daysSince(NOW - seconds, NOW)).toBe(days)
  })

  it('is 0 for a time ahead of now', () => {
    expect(daysSince(NOW + 3 * DAY, NOW)).toBe(0)
  })
})
