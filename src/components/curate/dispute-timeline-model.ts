/*
 * The periods of a Kleros Court (KlerosLiquid) dispute, laid out in time.
 *
 * A dispute's round runs evidence → commit → vote → appeal, then execution.
 * Commit exists only in courts with hidden votes (there "vote" is the
 * reveal). The court sets a length for each period (timesPerPeriod); a
 * period moves on when someone calls passPeriod after it (Kleros' keepers do
 * within minutes), commit and vote earlier once every juror has acted, and
 * evidence later if jurors are still being drawn. An appeal funded by both
 * sides starts a new round at evidence with 2n + 1 jurors; that round's
 * evidence period has no minimum and moves on once its jurors are drawn
 * (KlerosLiquid.passPeriod), so its length is only an estimate.
 *
 * So the current period's deadline is read, not guessed (its start plus its
 * length: the latest it ends, or for a first round's evidence the earliest) and
 * every later date is an estimate chained from it: the shortest the dispute
 * can take, assuming nobody appeals.
 */

import { rulingTitle, type RulingTitles } from 'utils/ruling-titles'

export const COURT_PERIOD = {
  EVIDENCE: 0,
  COMMIT: 1,
  VOTE: 2,
  APPEAL: 3,
  EXECUTION: 4,
} as const

/** What the arbitrator says about one dispute (use-dispute-timeline.ts). */
export interface CourtDispute {
  disputeID: string
  court: number
  /** 0 evidence, 1 commit, 2 vote, 3 appeal, 4 execution. */
  period: number
  /** When the current period started (unix seconds). */
  periodStart: number
  /** The court's length of each period, in seconds (evidence to appeal). */
  times: [number, number, number, number]
  hiddenVotes: boolean
  /** 1 for the first round. */
  round: number
  /**
   * Vote slots in each round, oldest first (getDispute.votesLengths): what
   * the jury band's round tabs are built from. The last entry is `jurors`.
   */
  roundSlots: number[]
  /** Jurors in the current round. */
  jurors: number
  /** Jurors drawn so far in the current round. */
  drawn: number
  /** Votes committed in the current round (hidden votes only). */
  committed: number
  /** Votes cast (revealed) in the current round. */
  voted: number
  /** The arbitrator has given its final ruling. */
  ruled: boolean
  /**
   * The round can still be appealed: false once the General court has its
   * largest jury (jurorsForCourtJump), where appealCost is unpayable.
   */
  appealable: boolean
}

export type StepState = 'done' | 'now' | 'next'

export interface TimelineStep {
  key: 'evidence' | 'commit' | 'vote' | 'appeal' | 'ruling'
  title: string
  /**
   * A fact about the period the band cannot show otherwise, and only that:
   * an appeal period that cannot be appealed says so. No step explains what
   * it is for (round 3 of the design review deleted "3 jurors drawn. Both
   * sides add evidence." and round 5's re-audit the same kind of sentence on
   * every later step: "Jurors seal their votes.", "Either side can fund an
   * appeal…", "If nobody appeals, the ruling is final…"). Its name and its
   * dates say it; the jury's pill counts the seats drawn, and the current
   * period's figures are in `overdue` or `early`.
   */
  detail?: string
  state: StepState
  /** The court's length of the period (none for the ruling). */
  duration?: number
  /** When it started or is expected to start. */
  start?: number
  /** When it ends at the latest (current) or is expected to end (next). */
  end?: number
  /** `start`/`end` are chained from the current deadline, not read. */
  estimated: boolean
  /** The current period ran past its length: why it has not moved on. */
  overdue?: string
  /**
   * Where the current period stands, in figures ("2 of 3 committed"): what
   * lets commit and vote close before their deadline, and an appeal round's
   * evidence move on.
   */
  early?: string
}

/** The steps of the current round, then the ruling. */
export const timelineSteps = (
  dispute: CourtDispute,
  now: number,
): TimelineStep[] => {
  const { period, periodStart, times, hiddenVotes, round, jurors } = dispute
  const periods = hiddenVotes
    ? [
        COURT_PERIOD.EVIDENCE,
        COURT_PERIOD.COMMIT,
        COURT_PERIOD.VOTE,
        COURT_PERIOD.APPEAL,
      ]
    : [COURT_PERIOD.EVIDENCE, COURT_PERIOD.VOTE, COURT_PERIOD.APPEAL]

  // Where the next period is expected to start: the current deadline, or
  // now once that deadline has passed (the period is about to move on).
  let cursor = 0
  const steps: TimelineStep[] = periods.map((p) => {
    const base = describe(p, dispute)
    const duration = times[p]
    if (p < period)
      return { ...base, duration, state: 'done', estimated: false }
    if (p === period) {
      // An appeal round's evidence has no minimum: once its jurors are all
      // drawn it can move on now, so it has no deadline to show.
      const ready =
        p === COURT_PERIOD.EVIDENCE && round > 1 && dispute.drawn >= jurors
      const end = ready ? undefined : periodStart + duration
      cursor = end === undefined ? now : Math.max(end, now)
      return {
        ...base,
        duration,
        state: 'now',
        start: periodStart,
        end,
        estimated: p === COURT_PERIOD.EVIDENCE && round > 1,
        overdue:
          end !== undefined && now > end ? overdueReason(dispute) : undefined,
        early: earlyReason(dispute),
      }
    }
    const start = cursor
    cursor = start + duration
    return {
      ...base,
      duration,
      state: 'next',
      start,
      end: cursor,
      estimated: true,
    }
  })

  // The ruling has its name and its date, or "Final" once it is
  // (dispute-period-steps.tsx): what the list then does with it is the
  // page's to say, not the spine's.
  const final = period >= COURT_PERIOD.EXECUTION
  steps.push({
    key: 'ruling',
    title: 'Ruling',
    state: final ? 'now' : 'next',
    start: final ? periodStart : cursor,
    estimated: !final,
  })
  return steps
}

/* A period's name, and for an appeal that cannot be had, that fact alone. */
const describe = (
  period: number,
  { hiddenVotes, appealable }: CourtDispute,
): Pick<TimelineStep, 'key' | 'title' | 'detail'> => {
  switch (period) {
    case COURT_PERIOD.EVIDENCE:
      return { key: 'evidence', title: 'Evidence' }
    case COURT_PERIOD.COMMIT:
      return { key: 'commit', title: 'Commit' }
    case COURT_PERIOD.VOTE:
      return { key: 'vote', title: hiddenVotes ? 'Reveal' : 'Vote' }
    default:
      // The General court's largest jury: appealCost is unpayable.
      return appealable
        ? { key: 'appeal', title: 'Appeal' }
        : { key: 'appeal', title: 'Appeal', detail: 'Cannot be appealed' }
  }
}

/*
 * Why a period past its length has not moved on yet. The step's own time
 * already reads "Over", so a first round still drawing says how far the
 * draw has got, and any other says when it moves.
 */
const overdueReason = (dispute: CourtDispute): string =>
  dispute.period === COURT_PERIOD.EVIDENCE && dispute.drawn < dispute.jurors
    ? `${dispute.drawn} of ${dispute.jurors} jurors drawn`
    : 'Moves on at the next court update'

/*
 * Where the current period stands, in figures: what it needs before it can
 * move on early. Its deadline line already says "Ends by … · lasts up to",
 * so the figures need no sentence around them. A juror who did not commit
 * cannot reveal, so a reveal counts against the committed votes then.
 */
const earlyReason = (dispute: CourtDispute): string | undefined => {
  const { period, round, drawn, jurors, committed, voted, hiddenVotes } =
    dispute
  if (period === COURT_PERIOD.EVIDENCE && round > 1)
    return drawn >= jurors
      ? `All ${jurors} jurors drawn · can move on now`
      : `${drawn} of ${jurors} jurors drawn`
  if (period === COURT_PERIOD.COMMIT)
    return `${committed} of ${jurors} committed`
  if (period === COURT_PERIOD.VOTE)
    return hiddenVotes && committed < jurors
      ? `${voted} of ${committed} committed votes revealed`
      : `${voted} of ${jurors} ${hiddenVotes ? 'revealed' : 'voted'}`
  return undefined
}

/** When the ruling is expected if nobody appeals (undefined once final). */
export const expectedRuling = (steps: TimelineStep[]): number | undefined => {
  const ruling = steps[steps.length - 1]
  return ruling?.state === 'next' ? ruling.start : undefined
}

/** The period running now, as the item page's one clock reads it. */
export interface CurrentPeriod {
  key: TimelineStep['key']
  /** What the period is, in the page's words ("Jurors are voting"). */
  title: string
  /** The name the clock takes ("Vote period"). */
  measure: string
  /** Unix seconds: when this period started. */
  start: number
  /** The latest it ends; undefined when it has no deadline to show. */
  end?: number
  /** `end` is the court's length, which this period can beat. */
  estimated: boolean
  /** Under the countdown: "left for jurors to vote". */
  verb: string
  /**
   * What `end` is called on a clock. An evidence period's length is the
   * earliest it can end (it also waits for every juror to be drawn); commit
   * and vote can close early, so theirs is the latest.
   */
  closeLabel: string
  /**
   * One line for the page's quiet state, where there is a fact to add: the
   * ruling being applied, or an appeal that cannot be had. No period
   * explains itself: round 3 of the design review deleted "3 jurors drawn.
   * Both sides add evidence before they commit." and round 5's re-audit the
   * same kind of sentence on commit, vote and appeal ("Jurors seal their
   * votes…", "Either side can fund an appeal…"); the title and the clock
   * say it. A caller prints it only when it is there.
   */
  next?: string
}

/**
 * Where the case stands now and, when it has a deadline, until when. An
 * appeal round's evidence period that can already move on has no deadline:
 * the caller then says what it waits for instead of drawing a clock with no
 * finish.
 */
export const currentPeriod = (dispute: CourtDispute): CurrentPeriod => {
  const { period, periodStart, times, hiddenVotes, round, jurors, drawn } =
    dispute
  const length = (p: number) => times[p] ?? 0
  const base = (key: TimelineStep['key'], end?: number, estimated = false) => ({
    key,
    start: periodStart,
    end,
    estimated,
  })

  if (period >= COURT_PERIOD.EXECUTION)
    return {
      ...base('ruling'),
      title: dispute.ruled ? 'Ruling applied' : 'Ruling final',
      measure: 'Ruling',
      verb: '',
      closeLabel: 'Ends',
      next: dispute.ruled
        ? 'The court has given its ruling and the list applies it.'
        : 'The court executes the ruling, then the list applies it.',
    }

  if (period === COURT_PERIOD.EVIDENCE) {
    // An appeal round's evidence has no minimum: once its jurors are all
    // drawn it can move on now, so it has no deadline to show.
    const ready = round > 1 && drawn >= jurors
    return {
      ...base(
        'evidence',
        ready ? undefined : periodStart + length(COURT_PERIOD.EVIDENCE),
        round > 1,
      ),
      title: 'Jurors are deciding',
      measure: 'Evidence period',
      verb: 'before jurors can vote',
      closeLabel: 'Can end from',
    }
  }

  if (period === COURT_PERIOD.COMMIT)
    return {
      ...base('commit', periodStart + length(COURT_PERIOD.COMMIT)),
      title: 'Jurors are committing',
      measure: 'Commit period',
      verb: 'left for jurors to commit',
      closeLabel: 'Ends by',
    }

  if (period === COURT_PERIOD.VOTE)
    return {
      ...base('vote', periodStart + length(COURT_PERIOD.VOTE)),
      title: hiddenVotes ? 'Jurors are revealing' : 'Jurors are voting',
      measure: hiddenVotes ? 'Reveal period' : 'Vote period',
      verb: hiddenVotes
        ? 'left for jurors to reveal'
        : 'left for jurors to vote',
      closeLabel: 'Ends by',
    }

  return {
    ...base('appeal', periodStart + length(COURT_PERIOD.APPEAL)),
    title: 'Open for appeal',
    measure: 'Appeal period',
    verb: 'left to appeal',
    closeLabel: 'Closes',
    // The General court's largest jury: appealCost is unpayable.
    next: dispute.appealable ? undefined : 'Cannot be appealed',
  }
}

/**
 * A vote as the page names it. The arbitrator numbers the choices; what
 * each means comes from the request. With the dispute's MetaEvidence read,
 * a vote reads as the court shows it to the jurors ("No, Don't Add It");
 * until then, or for a file without titles, by the side it is for. Never
 * as a bare number.
 */
export const choiceLabel = (
  choice: number,
  requesterName: string,
  titles?: RulingTitles,
): string => {
  if (choice === 0) return 'Refused to rule'
  const title = rulingTitle(titles, choice)
  if (title) return title
  if (choice === 1) return `For the ${requesterName}`
  if (choice === 2) return 'For the challenger'
  return `Choice ${choice}`
}
