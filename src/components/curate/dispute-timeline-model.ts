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
  detail: string
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
  /** The current period can close before its deadline. */
  early?: string
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`

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

  const final = period >= COURT_PERIOD.EXECUTION
  steps.push({
    key: 'ruling',
    title: 'Ruling',
    detail: final
      ? dispute.ruled
        ? 'Final. The list applies it.'
        : 'Final once the court executes it; then the list applies it.'
      : dispute.appealable
        ? 'If nobody appeals, the ruling is final and the list applies it.'
        : 'Final when the appeal period ends; then the list applies it.',
    state: final ? 'now' : 'next',
    start: final ? periodStart : cursor,
    estimated: !final,
  })
  return steps
}

const describe = (
  period: number,
  { hiddenVotes, round, jurors, drawn, appealable }: CourtDispute,
): Pick<TimelineStep, 'key' | 'title' | 'detail'> => {
  switch (period) {
    case COURT_PERIOD.EVIDENCE:
      return {
        key: 'evidence',
        title: 'Evidence',
        detail:
          drawn >= jurors
            ? `${plural(jurors, 'juror')} drawn. Both sides add evidence.`
            : `Drawing ${plural(jurors, 'juror')} (${drawn} so far). Both sides add evidence.`,
      }
    case COURT_PERIOD.COMMIT:
      return {
        key: 'commit',
        title: 'Commit',
        detail: 'Jurors seal their votes.',
      }
    case COURT_PERIOD.VOTE:
      return hiddenVotes
        ? { key: 'vote', title: 'Reveal', detail: 'Jurors reveal their votes.' }
        : { key: 'vote', title: 'Vote', detail: 'Jurors vote.' }
    default:
      return {
        key: 'appeal',
        title: 'Appeal',
        detail: appealable
          ? `Either side can fund an appeal. If both do, round ${round + 1} starts with ${plural(2 * jurors + 1, 'juror')}.`
          : 'This is the court’s largest jury: the ruling cannot be appealed.',
      }
  }
}

/** Why a period past its length has not moved on yet. */
const overdueReason = (dispute: CourtDispute): string =>
  dispute.period === COURT_PERIOD.EVIDENCE && dispute.drawn < dispute.jurors
    ? `Waiting for jurors to be drawn (${dispute.drawn} of ${dispute.jurors}).`
    : 'Over: it moves on at the next court update.'

/** Why the current period may close before its deadline. */
const earlyReason = (dispute: CourtDispute): string | undefined => {
  const { period, round, drawn, jurors, committed, voted, hiddenVotes } =
    dispute
  if (period === COURT_PERIOD.EVIDENCE && round > 1)
    return drawn >= jurors
      ? 'An appeal round with all its jurors drawn: it can move on now.'
      : `An appeal round: it can move on once all jurors are drawn (${drawn} of ${jurors}).`
  if (period === COURT_PERIOD.COMMIT)
    return committed >= jurors
      ? 'Every juror has committed: it can close early.'
      : `${committed} of ${jurors} committed. It can close early once all have.`
  if (period === COURT_PERIOD.VOTE) {
    if (voted >= jurors) return 'Every juror has voted: it can close early.'
    // A juror who did not commit cannot reveal: the period runs its course.
    if (hiddenVotes && committed < jurors)
      return `${voted} of ${committed} committed votes revealed. It runs to its deadline: not every juror committed.`
    return `${voted} of ${jurors} ${hiddenVotes ? 'revealed' : 'voted'}. It can close early once all have.`
  }
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
  /** One sentence: what happens next. */
  next: string
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
      title: 'Evidence',
      measure: 'Evidence period',
      verb: 'before jurors can vote',
      closeLabel: 'Can end from',
      next:
        drawn >= jurors
          ? `${jurors} juror${jurors === 1 ? '' : 's'} drawn. Both sides add evidence before they ${hiddenVotes ? 'commit' : 'vote'}.`
          : `Jurors are being drawn (${drawn} of ${jurors}). Both sides add evidence.`,
    }
  }

  if (period === COURT_PERIOD.COMMIT)
    return {
      ...base('commit', periodStart + length(COURT_PERIOD.COMMIT)),
      title: 'Jurors are committing',
      measure: 'Commit period',
      verb: 'left for jurors to commit',
      closeLabel: 'Ends by',
      next: 'Jurors seal their votes, then reveal them.',
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
      next: 'Once the votes are in, the ruling opens for appeal.',
    }

  return {
    ...base('appeal', periodStart + length(COURT_PERIOD.APPEAL)),
    title: 'Open for appeal',
    measure: 'Appeal period',
    verb: 'left to appeal',
    closeLabel: 'Closes',
    next: dispute.appealable
      ? `Either side can fund an appeal. If both do, round ${round + 1} starts with ${2 * jurors + 1} jurors.`
      : 'This is the court’s largest jury: the ruling cannot be appealed.',
  }
}

/**
 * A vote as the page names it. The arbitrator numbers the choices; what
 * each means comes from the request, so a Curate vote reads by the side it
 * is for and never as a bare number.
 */
export const choiceLabel = (choice: number, requesterName: string): string =>
  choice === 0
    ? 'Refused to rule'
    : choice === 1
      ? `For the ${requesterName}`
      : choice === 2
        ? 'For the challenger'
        : `Choice ${choice}`
