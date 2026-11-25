import type { MedalKind } from 'components/curate/curator-medal'

/*
 * Badge levels, ten per badge. Round 12 set five ("put levels … like lvl 2
 * with 5 submissions for librarian, or lvl 2 with 2 challenges as sheriff …
 * all in proportion"); before launch the owner asked for more, as some
 * curators had reached level 5 ("we should put more levels here as some
 * users maxxed them out").
 *
 * Levels 1 to 5: the owner's two examples fix level 2 for Librarian and
 * Sheriff; the rest was set from the indexers' own counts (Standard lists on
 * Ethereum and Gnosis, and the court index's seats in Curate disputes, read
 * on 2026-11-19), so a level is about as hard to reach on every badge.
 *
 * Levels 6 to 10 ask for 2, 5, 10, 20 and 50 times level 5, so each badge
 * keeps the proportions its first five levels set and every level asks about
 * twice the one before. Of the addresses that did the thing once, the share
 * that reaches each level (read again on 2026-11-24, Standard and Stake
 * lists on Ethereum and Gnosis and the court index's seats):
 *
 *                level 2    3    4    5    6     7     8 to 10    of
 *   Librarian        46%  26%  18%   8%   5%  1.1%  0.5%  0  0    187
 *   Sheriff          69%  36%  15%   4%   3%     0     0  0  0     67
 *   Maintainer       73%  38%  19%   8%   3%     0     0  0  0     37
 *   Juror            45%  28%  16%   6%   2%  0.4%     0  0  0    236
 *
 * The busiest address on each badge stood at level 8 (Librarian, 6,009
 * submissions), 7 (Juror, 505 seats) or 6 (Sheriff, 150 challenges;
 * Maintainer, 364 removal requests), where five levels had left 35 badges
 * at the top.
 *
 * Librarian counts submissions, Sheriff challenges, Maintainer removal
 * requests, Juror seats in Curate disputes. The profile reads up to 30,000
 * Standard requests per chain (PROFILE_LIMIT, data.ts), so the Librarian's
 * top level can be counted on one chain, and up to 10,000 drawn seats
 * (JURY_SEAT_LIMIT, jury.ts).
 */
export const LEVELS: Record<MedalKind, readonly number[]> = {
  librarian: [1, 5, 25, 100, 500, 1_000, 2_500, 5_000, 10_000, 25_000],
  sheriff: [1, 2, 5, 20, 50, 100, 250, 500, 1_000, 2_500],
  maintainer: [1, 2, 10, 25, 100, 200, 500, 1_000, 2_000, 5_000],
  juror: [1, 5, 10, 25, 100, 200, 500, 1_000, 2_000, 5_000],
}

export const TOP_LEVEL = 10

export interface BadgeLevel {
  /** 0 (not earned) to TOP_LEVEL. */
  level: number
  count: number
  /** The count the next level asks for; undefined at the top level. */
  next?: number
  /**
   * How far the count is from this level's threshold toward the next one,
   * 0 to 1 (level 0 runs from zero); 1 at the top.
   */
  share: number
}

export const badgeLevel = (kind: MedalKind, count: number): BadgeLevel => {
  const ladder = LEVELS[kind]
  const level = ladder.filter((step) => count >= step).length
  const next = ladder[level]
  const floor = level > 0 ? ladder[level - 1] : 0
  return {
    level,
    count,
    next,
    share:
      next === undefined
        ? 1
        : Math.min(1, Math.max(0, (count - floor) / (next - floor))),
  }
}
