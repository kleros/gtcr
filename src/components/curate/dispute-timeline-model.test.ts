import { describe, expect, it } from 'vitest'
import {
  COURT_PERIOD,
  type CourtDispute,
  choiceLabel,
  currentPeriod,
  expectedRuling,
  timelineSteps,
} from './dispute-timeline-model'

/** A first-round case in evidence: periods of 100, 200, 300 and 400 s. */
const courtDispute = (overrides: Partial<CourtDispute> = {}): CourtDispute => ({
  disputeID: '12',
  court: 0,
  period: COURT_PERIOD.EVIDENCE,
  periodStart: 1000,
  times: [100, 200, 300, 400],
  hiddenVotes: false,
  round: 1,
  roundSlots: [3],
  jurors: 3,
  drawn: 3,
  committed: 0,
  voted: 0,
  ruled: false,
  appealable: true,
  ...overrides,
})

describe('timelineSteps', () => {
  it('reads the current deadline and chains the later dates from it', () => {
    const steps = timelineSteps(courtDispute(), 1050)
    expect(steps).toEqual([
      {
        key: 'evidence',
        title: 'Evidence',
        state: 'now',
        duration: 100,
        start: 1000,
        end: 1100,
        estimated: false,
      },
      {
        key: 'vote',
        title: 'Vote',
        state: 'next',
        duration: 300,
        start: 1100,
        end: 1400,
        estimated: true,
      },
      {
        key: 'appeal',
        title: 'Appeal',
        state: 'next',
        duration: 400,
        start: 1400,
        end: 1800,
        estimated: true,
      },
      {
        key: 'ruling',
        title: 'Ruling',
        state: 'next',
        start: 1800,
        estimated: true,
      },
    ])
    expect(expectedRuling(steps)).toBe(1800)
  })

  it('chains from now once the current period has run past its length', () => {
    const steps = timelineSteps(courtDispute({ drawn: 1 }), 1200)
    expect(steps[0]).toMatchObject({
      state: 'now',
      end: 1100,
      overdue: '1 of 3 jurors drawn',
    })
    expect(steps.slice(1).map(({ start, end }) => [start, end])).toEqual([
      [1200, 1500],
      [1500, 1900],
      [1900, undefined],
    ])
  })

  it('says an overdue period with its jury drawn moves at the next update', () => {
    expect(timelineSteps(courtDispute(), 1101)[0].overdue).toBe(
      'Moves on at the next court update',
    )
    expect(timelineSteps(courtDispute(), 1100)[0].overdue).toBeUndefined()
  })

  it('adds a commit step to a court with hidden votes, and calls the vote a reveal', () => {
    const steps = timelineSteps(
      courtDispute({
        hiddenVotes: true,
        period: COURT_PERIOD.COMMIT,
        periodStart: 1100,
        committed: 2,
      }),
      1150,
    )
    expect(steps.map((step) => [step.key, step.title, step.state])).toEqual([
      ['evidence', 'Evidence', 'done'],
      ['commit', 'Commit', 'now'],
      ['vote', 'Reveal', 'next'],
      ['appeal', 'Appeal', 'next'],
      ['ruling', 'Ruling', 'next'],
    ])
    expect(steps[0]).toEqual({
      key: 'evidence',
      title: 'Evidence',
      state: 'done',
      duration: 100,
      estimated: false,
    })
    expect(steps[1]).toMatchObject({
      start: 1100,
      end: 1300,
      early: '2 of 3 committed',
    })
    expect(expectedRuling(steps)).toBe(1300 + 300 + 400)
  })

  it.each([
    // A juror who did not commit cannot reveal.
    [true, 2, 1, '1 of 2 committed votes revealed'],
    [true, 3, 2, '2 of 3 revealed'],
    [false, 0, 2, '2 of 3 voted'],
  ])(
    'a vote with hidden votes %s, %d committed, %d cast: %s',
    (hiddenVotes, committed, voted, early) => {
      const steps = timelineSteps(
        courtDispute({
          hiddenVotes,
          period: COURT_PERIOD.VOTE,
          committed,
          voted,
        }),
        1050,
      )
      expect(steps.find((step) => step.state === 'now')?.early).toBe(early)
    },
  )

  describe('an appeal round’s evidence', () => {
    const appealRound = (drawn: number) =>
      courtDispute({ round: 2, roundSlots: [3, 7], jurors: 7, drawn })

    it('estimates its end while jurors are still being drawn', () => {
      expect(timelineSteps(appealRound(5), 1050)[0]).toMatchObject({
        state: 'now',
        end: 1100,
        estimated: true,
        early: '5 of 7 jurors drawn',
      })
      expect(timelineSteps(appealRound(5), 1200)[0].overdue).toBe(
        '5 of 7 jurors drawn',
      )
    })

    it('has no deadline once every juror is drawn, and can move on now', () => {
      const steps = timelineSteps(appealRound(7), 1050)
      expect(steps[0]).toMatchObject({
        state: 'now',
        end: undefined,
        estimated: true,
        overdue: undefined,
        early: 'All 7 jurors drawn · can move on now',
      })
      expect(steps[1]).toMatchObject({ key: 'vote', start: 1050, end: 1350 })
    })
  })

  it('says an appeal that cannot be had, and only that', () => {
    const steps = timelineSteps(courtDispute({ appealable: false }), 1050)
    expect(steps.find((step) => step.key === 'appeal')?.detail).toBe(
      'Cannot be appealed',
    )
    expect(steps.filter((step) => step.detail)).toHaveLength(1)
    expect(
      timelineSteps(courtDispute(), 1050).some((step) => step.detail),
    ).toBe(false)
  })

  it('marks every period done and the ruling current once in execution', () => {
    const steps = timelineSteps(
      courtDispute({ period: COURT_PERIOD.EXECUTION, periodStart: 5000 }),
      6000,
    )
    expect(steps.map((step) => step.state)).toEqual([
      'done',
      'done',
      'done',
      'now',
    ])
    expect(steps[3]).toEqual({
      key: 'ruling',
      title: 'Ruling',
      state: 'now',
      start: 5000,
      estimated: false,
    })
    expect(expectedRuling(steps)).toBeUndefined()
  })
})

describe('expectedRuling', () => {
  it('is undefined without steps', () => {
    expect(expectedRuling([])).toBeUndefined()
  })
})

describe('currentPeriod', () => {
  it('reads a first round’s evidence: the earliest it can end', () => {
    expect(currentPeriod(courtDispute())).toEqual({
      key: 'evidence',
      start: 1000,
      end: 1100,
      estimated: false,
      title: 'Jurors are deciding',
      measure: 'Evidence period',
      verb: 'before jurors can vote',
      closeLabel: 'Can end from',
    })
  })

  it('estimates an appeal round’s evidence, and has no deadline once drawn', () => {
    const appealRound = { round: 2, jurors: 7 }
    expect(
      currentPeriod(courtDispute({ ...appealRound, drawn: 5 })),
    ).toMatchObject({
      end: 1100,
      estimated: true,
    })
    expect(
      currentPeriod(courtDispute({ ...appealRound, drawn: 7 })),
    ).toMatchObject({
      end: undefined,
      estimated: true,
    })
  })

  it.each([
    [
      COURT_PERIOD.COMMIT,
      true,
      {
        key: 'commit',
        end: 1200,
        title: 'Jurors are committing',
        measure: 'Commit period',
        verb: 'left for jurors to commit',
        closeLabel: 'Ends by',
      },
    ],
    [
      COURT_PERIOD.VOTE,
      true,
      {
        key: 'vote',
        end: 1300,
        title: 'Jurors are revealing',
        measure: 'Reveal period',
        verb: 'left for jurors to reveal',
        closeLabel: 'Ends by',
      },
    ],
    [
      COURT_PERIOD.VOTE,
      false,
      {
        key: 'vote',
        end: 1300,
        title: 'Jurors are voting',
        measure: 'Vote period',
        verb: 'left for jurors to vote',
        closeLabel: 'Ends by',
      },
    ],
    [
      COURT_PERIOD.APPEAL,
      false,
      {
        key: 'appeal',
        end: 1400,
        title: 'Open for appeal',
        measure: 'Appeal period',
        verb: 'left to appeal',
        closeLabel: 'Closes',
        next: undefined,
      },
    ],
  ])('period %d, hidden votes %s', (period, hiddenVotes, expected) => {
    expect(currentPeriod(courtDispute({ period, hiddenVotes }))).toEqual({
      start: 1000,
      estimated: false,
      ...expected,
    })
  })

  it('says an appeal period that cannot be appealed', () => {
    expect(
      currentPeriod(
        courtDispute({ period: COURT_PERIOD.APPEAL, appealable: false }),
      ).next,
    ).toBe('Cannot be appealed')
  })

  it.each([
    [
      false,
      'Ruling final',
      'The court executes the ruling, then the list applies it.',
    ],
    [
      true,
      'Ruling applied',
      'The court has given its ruling and the list applies it.',
    ],
  ])('in execution, ruled %s: %s', (ruled, title, next) => {
    expect(
      currentPeriod(courtDispute({ period: COURT_PERIOD.EXECUTION, ruled })),
    ).toEqual({
      key: 'ruling',
      start: 1000,
      end: undefined,
      estimated: false,
      title,
      measure: 'Ruling',
      verb: '',
      closeLabel: 'Ends',
      next,
    })
  })
})

describe('choiceLabel', () => {
  it.each([
    [0, 'submitter', 'Refused to rule'],
    [1, 'submitter', 'For the submitter'],
    [1, 'requester', 'For the requester'],
    [2, 'submitter', 'For the challenger'],
    [3, 'submitter', 'Choice 3'],
  ])('choice %d for a %s reads %j', (choice, requesterName, label) => {
    expect(choiceLabel(choice, requesterName)).toBe(label)
  })
})
