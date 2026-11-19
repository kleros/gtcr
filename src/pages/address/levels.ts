import type { MedalKind } from 'components/curate/curator-medal'

/*
 * Badge levels (round 12: "put levels … like lvl 2 with 5 submissions for
 * librarian, or lvl 2 with 2 challenges as sheriff … all in proportion").
 *
 * Every badge has five levels. The owner's two examples fix level 2 for
 * Librarian and Sheriff; the rest of each ladder was set from the indexers'
 * own counts (Standard lists on Ethereum and Gnosis, and the court index's
 * seats in Curate disputes, read on 2026-11-19), so a level is about as
 * hard to reach on every badge. Of the addresses that did the thing once,
 * about half or more reach level 2, a quarter to two fifths level 3, about
 * one in six level 4 and one in twelve to twenty level 5:
 *
 *                level 1   2    3    4    5     reached by (level 2 to 5)
 *   Librarian          1   5   25  100  500     47%  27%  18%   8%  of 181
 *   Sheriff            1   2    5   20   50     66%  37%  14%   5%  of 65
 *   Maintainer         1   2   10   25  100     73%  38%  19%   8%  of 37
 *   Juror              1   5   10   25  100     45%  28%  16%   6%  of 236
 *
 * Librarian counts submissions, Sheriff challenges, Maintainer removal
 * requests, Juror seats in Curate disputes.
 */
export const LEVELS: Record<MedalKind, readonly number[]> = {
  librarian: [1, 5, 25, 100, 500],
  sheriff: [1, 2, 5, 20, 50],
  maintainer: [1, 2, 10, 25, 100],
  juror: [1, 5, 10, 25, 100],
}

export const TOP_LEVEL = 5

export interface BadgeLevel {
  /** 0 (not earned) to TOP_LEVEL. */
  level: number
  count: number
  /** The count the next level asks for; undefined at the top level. */
  next?: number
  /** How far the count is toward the next level, 0 to 1; 1 at the top. */
  share: number
}

export const badgeLevel = (kind: MedalKind, count: number): BadgeLevel => {
  const ladder = LEVELS[kind]
  const level = ladder.filter((step) => count >= step).length
  const next = ladder[level]
  return {
    level,
    count,
    next,
    share: next === undefined ? 1 : Math.min(1, Math.max(0, count / next)),
  }
}
