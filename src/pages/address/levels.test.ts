import { describe, expect, it } from 'vitest'
import type { MedalKind } from 'components/curate/curator-medal'
import { LEVELS, TOP_LEVEL, badgeLevel } from './levels'

/** DESIGN.md, Curator profile → Levels: the count each level asks for. */
const TABLE: [MedalKind, number[]][] = [
  ['librarian', [1, 5, 25, 100, 500]],
  ['sheriff', [1, 2, 5, 20, 50]],
  ['maintainer', [1, 2, 10, 25, 100]],
  ['juror', [1, 5, 10, 25, 100]],
]

const rows = TABLE.flatMap(([kind, thresholds]) =>
  thresholds.map((threshold, index) => ({ kind, level: index + 1, threshold })),
)

describe('badgeLevel', () => {
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
