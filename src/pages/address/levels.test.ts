import { describe, expect, it, vi } from 'vitest'
import type { MedalKind } from 'components/curate/curator-medal'
import { PROFILE_LIMIT } from './data'
import { JURY_SEAT_LIMIT } from './jury'
import { LEVELS, TOP_LEVEL, badgeLevel } from './levels'

// The wagmi config reads window.location when it loads; nothing here signs.
vi.mock('config/wagmi', () => ({ wagmiConfig: {} }))

/** DESIGN.md, Curator profile → Levels: the count each level asks for. */
const TABLE: [MedalKind, number[]][] = [
  ['librarian', [1, 5, 25, 100, 500, 1_000, 2_500, 5_000, 10_000, 25_000]],
  ['sheriff', [1, 2, 5, 20, 50, 100, 250, 500, 1_000, 2_500]],
  ['maintainer', [1, 2, 10, 25, 100, 200, 500, 1_000, 2_000, 5_000]],
  ['juror', [1, 5, 10, 25, 100, 200, 500, 1_000, 2_000, 5_000]],
]

const rows = TABLE.flatMap(([kind, thresholds]) =>
  thresholds.map((threshold, index) => ({ kind, level: index + 1, threshold })),
)

describe('badgeLevel', () => {
  it('has ten levels', () => {
    expect(TOP_LEVEL).toBe(10)
    for (const [kind] of TABLE) expect(LEVELS[kind]).toHaveLength(TOP_LEVEL)
  })

  it.each(rows)(
    '$kind reaches level $level at $threshold',
    ({ kind, level, threshold }) => {
      expect(badgeLevel(kind, threshold).level).toBe(level)
      expect(badgeLevel(kind, threshold - 1).level).toBe(level - 1)
    },
  )

  it.each(TABLE)('%s has a ladder that only rises', (kind) => {
    const steps = LEVELS[kind]
    expect(steps).toHaveLength(TOP_LEVEL)
    for (let i = 1; i < steps.length; i += 1)
      expect(steps[i]).toBeGreaterThan(steps[i - 1])
  })

  it.each(TABLE)(
    '%s asks 2, 5, 10, 20 and 50 times level 5 for levels 6 to 10',
    (kind) => {
      const steps = LEVELS[kind]
      expect(steps.slice(5)).toEqual(
        [2, 5, 10, 20, 50].map((times) => steps[4] * times),
      )
    },
  )

  it.each(TABLE)(
    "%s's top level is within what the profile reads on one chain",
    (kind) => {
      const top = LEVELS[kind][TOP_LEVEL - 1]
      if (kind === 'juror') expect(top).toBeLessThanOrEqual(JURY_SEAT_LIMIT)
      else expect(top).toBeLessThan(PROFILE_LIMIT)
    },
  )

  it('starts at level 0 with the bar running from zero to level 1', () => {
    expect(badgeLevel('librarian', 0)).toEqual({
      level: 0,
      count: 0,
      next: 1,
      share: 0,
    })
  })

  it.each([
    // Librarian level 2 (5) toward level 3 (25): 15 is halfway.
    ['librarian', 15, 2, 25, 0.5],
    // Sheriff level 3 (5) toward level 4 (20): 8 is a fifth of the way.
    ['sheriff', 8, 3, 20, 0.2],
    // Exactly on a threshold: the bar of the new level is empty.
    ['maintainer', 10, 3, 25, 0],
    ['juror', 99, 4, 100, 74 / 75],
    // Past the old top (level 5): the busiest Librarian on 2026-11-24.
    ['librarian', 6_009, 8, 10_000, 1_009 / 5_000],
    ['sheriff', 150, 6, 250, 50 / 150],
    ['maintainer', 500, 7, 1_000, 0],
    ['juror', 505, 7, 1_000, 5 / 500],
  ] as const)(
    "runs %s's bar from its level's threshold to the next (%i)",
    (kind, count, level, next, share) => {
      const badge = badgeLevel(kind, count)
      expect(badge.level).toBe(level)
      expect(badge.next).toBe(next)
      expect(badge.share).toBeCloseTo(share, 10)
    },
  )

  it.each(TABLE)(
    '%s at the top level has no next level and a full bar',
    (kind) => {
      const top = LEVELS[kind][TOP_LEVEL - 1]
      for (const count of [top, top * 10]) {
        const badge = badgeLevel(kind, count)
        expect(badge.level).toBe(TOP_LEVEL)
        expect(badge.next).toBeUndefined()
        expect(badge.share).toBe(1)
        expect(badge.count).toBe(count)
      }
    },
  )

  it('never draws a bar below empty', () => {
    expect(badgeLevel('sheriff', -3)).toMatchObject({ level: 0, share: 0 })
  })
})
