import { BigNumber } from 'ethers'
import { describe, expect, it } from 'vitest'
import {
  CONTRACT_STATUS,
  STATUS_CODE,
  itemToStatusCode,
} from './permanent-item-status'
import { SUBGRAPH_RULING } from './status-constants'

type Code = keyof typeof STATUS_CODE

const HOUR = 3600
const DAY = 24 * HOUR

// The Stake wizard's defaults: 84 h to be accepted, 12 h after a ruling
// keeps the entry, 84 h from starting a withdrawal to executing it.
const SUBMISSION_PERIOD = 84 * HOUR
const REINCLUSION_PERIOD = 12 * HOUR
const WITHDRAWING_PERIOD = 84 * HOUR
const REGISTRY: SubgraphRegistry = {
  submissionPeriod: String(SUBMISSION_PERIOD),
  reinclusionPeriod: String(REINCLUSION_PERIOD),
  withdrawingPeriod: String(WITHDRAWING_PERIOD),
}

const INCLUDED_AT = 1700000000
const SUBMISSION_END = INCLUDED_AT + SUBMISSION_PERIOD
const REINCLUSION_END = INCLUDED_AT + REINCLUSION_PERIOD

const APPEAL_START = 1800000000
const APPEAL_END = APPEAL_START + 101
// floor((start + end) / 2), as PermanentGTCR.fundAppeal computes it.
const APPEAL_HALF = APPEAL_START + 50

/** The challenge and submission fields the status reads. */
interface Challenge {
  createdAt?: string | null
  resolutionTx?: string | null
  disputeOutcome?: string | null
  rounds?: SubgraphRound[]
}

interface Submission {
  finishedTx?: string | null
  withdrawingTx?: string | null
}

const round = (over: Partial<SubgraphRound> = {}): SubgraphRound => ({
  appealPeriodStart: '0',
  appealPeriodEnd: '0',
  ruling: SUBGRAPH_RULING.NONE,
  rulingTime: '0',
  hasPaidRequester: false,
  hasPaidChallenger: false,
  amountPaidRequester: BigNumber.from(0),
  amountPaidChallenger: BigNumber.from(0),
  ...over,
})

const stakeEntry = (
  status: string,
  over: Omit<Partial<SubgraphItem>, 'challenges'> & {
    challenges?: Challenge[]
    submissions?: Submission[]
  } = {},
): SubgraphItem => {
  const { challenges, ...rest } = over
  return {
    status,
    disputed: false,
    data: '0x',
    includedAt: String(INCLUDED_AT),
    withdrawingTimestamp: '0',
    ...rest,
    challenges: challenges?.map((challenge) => ({
      rounds: [],
      ...challenge,
    })) as SubgraphChallenge[] | undefined,
  }
}

const statusAt = (
  item: SubgraphItem,
  now: number,
  registry: SubgraphRegistry = REGISTRY,
): number | undefined => itemToStatusCode(item, BigNumber.from(now), registry)

/** A disputed entry whose latest round is `latestRound`. */
const disputed = (latestRound: Partial<SubgraphRound> = {}): SubgraphItem =>
  stakeEntry(CONTRACT_STATUS.DISPUTED, {
    challenges: [
      {
        createdAt: String(INCLUDED_AT + DAY),
        rounds: [round(latestRound)],
      },
    ],
  })

/** An appeal under way: the jurors ruled, the appeal period is open. */
const appeal = (over: Partial<SubgraphRound> = {}): SubgraphItem =>
  disputed({
    rulingTime: String(APPEAL_START),
    appealPeriodStart: String(APPEAL_START),
    appealPeriodEnd: String(APPEAL_END),
    ...over,
  })

describe('itemToStatusCode', () => {
  describe('an entry on the list', () => {
    it.each<[number, Code]>([
      [INCLUDED_AT, 'PENDING'],
      [SUBMISSION_END - 1, 'PENDING'],
      [SUBMISSION_END, 'PENDING'],
      [SUBMISSION_END + 1, 'ACCEPTED'],
      [SUBMISSION_END + 365 * DAY, 'ACCEPTED'],
    ])('a submission at %i is %s', (now, code) => {
      expect(statusAt(stakeEntry(CONTRACT_STATUS.SUBMITTED), now)).toBe(
        STATUS_CODE[code],
      )
    })

    it('runs a reincluded entry on the reinclusion period instead', () => {
      const reincluded = stakeEntry(CONTRACT_STATUS.REINCLUDED)
      expect(statusAt(reincluded, REINCLUSION_END)).toBe(STATUS_CODE.PENDING)
      expect(statusAt(reincluded, REINCLUSION_END + 1)).toBe(
        STATUS_CODE.ACCEPTED,
      )
      // The same moment is still within a submission's period.
      expect(
        statusAt(stakeEntry(CONTRACT_STATUS.SUBMITTED), REINCLUSION_END + 1),
      ).toBe(STATUS_CODE.PENDING)
    })
  })

  // PermanentGTCR: withdrawItem works from withdrawingTimestamp +
  // withdrawingPeriod on, and challengeItem is refused from that second.
  describe('a withdrawal', () => {
    const STARTED = SUBMISSION_END + DAY
    const READY = STARTED + WITHDRAWING_PERIOD

    it.each([CONTRACT_STATUS.SUBMITTED, CONTRACT_STATUS.REINCLUDED])(
      'leaves a %s entry open to challenge until the withdrawing period ends',
      (status) => {
        const item = stakeEntry(status, {
          withdrawingTimestamp: String(STARTED),
        })
        for (const now of [STARTED, READY - 1])
          expect(statusAt(item, now)).toBe(STATUS_CODE.ACCEPTED)
      },
    )

    it.each([CONTRACT_STATUS.SUBMITTED, CONTRACT_STATUS.REINCLUDED])(
      'can be executed on a %s entry from the second the period ends',
      (status) => {
        const item = stakeEntry(status, {
          withdrawingTimestamp: String(STARTED),
        })
        for (const now of [READY, READY + 365 * DAY])
          expect(statusAt(item, now)).toBe(STATUS_CODE.PENDING_WITHDRAWAL)
      },
    )

    it('started during the submission period leaves the entry pending', () => {
      const item = stakeEntry(CONTRACT_STATUS.SUBMITTED, {
        withdrawingTimestamp: String(INCLUDED_AT + HOUR),
      })
      expect(statusAt(item, INCLUDED_AT + 2 * HOUR)).toBe(STATUS_CODE.PENDING)
    })

    it('is not executable while the entry is in court', () => {
      const item = { ...disputed(), withdrawingTimestamp: String(STARTED) }
      expect(statusAt(item, READY + DAY)).toBe(STATUS_CODE.DISPUTED)
    })

    it('never starts without a withdrawal time', () => {
      for (const withdrawingTimestamp of ['0', undefined])
        expect(
          statusAt(
            stakeEntry(CONTRACT_STATUS.SUBMITTED, { withdrawingTimestamp }),
            READY + 365 * DAY,
          ),
        ).toBe(STATUS_CODE.ACCEPTED)
    })
  })

  describe('a disputed entry', () => {
    it('is in court until the jurors rule', () => {
      for (const now of [INCLUDED_AT + DAY, APPEAL_END + DAY])
        expect(statusAt(disputed(), now)).toBe(STATUS_CODE.DISPUTED)
    })

    describe.each([
      {
        ruling: SUBGRAPH_RULING.ACCEPT,
        loser: 'challenger',
        loserPaid: { hasPaidChallenger: true },
        winnerPaid: { hasPaidRequester: true },
      },
      {
        ruling: SUBGRAPH_RULING.REJECT,
        loser: 'submitter',
        loserPaid: { hasPaidRequester: true },
        winnerPaid: { hasPaidChallenger: true },
      },
    ])(
      'ruled $ruling, the $loser lost',
      ({ ruling, loserPaid, winnerPaid }) => {
        it('takes both sides’ fees in the first half', () => {
          for (const paid of [{}, loserPaid, winnerPaid])
            for (const now of [APPEAL_START, APPEAL_HALF - 1])
              expect(statusAt(appeal({ ruling, ...paid }), now)).toBe(
                STATUS_CODE.CROWDFUNDING,
              )
        })

        it('funds the winner after the half once the loser is funded', () => {
          for (const now of [APPEAL_HALF, APPEAL_END - 1])
            expect(statusAt(appeal({ ruling, ...loserPaid }), now)).toBe(
              STATUS_CODE.CROWDFUNDING_WINNER,
            )
        })

        it('stops taking fees after the half when the loser is not funded', () => {
          for (const paid of [{}, winnerPaid])
            for (const now of [APPEAL_HALF, APPEAL_END - 1])
              expect(statusAt(appeal({ ruling, ...paid }), now)).toBe(
                STATUS_CODE.WAITING_ARBITRATOR,
              )
        })

        it('is final once the period ends, whoever paid', () => {
          for (const paid of [{}, loserPaid, winnerPaid])
            for (const now of [APPEAL_END, APPEAL_END + DAY])
              expect(statusAt(appeal({ ruling, ...paid }), now)).toBe(
                STATUS_CODE.WAITING_ARBITRATOR,
              )
        })
      },
    )

    it('ends the loser’s half on the whole second the contract computes', () => {
      const item = appeal({ ruling: SUBGRAPH_RULING.REJECT })
      expect(statusAt(item, APPEAL_HALF - 1)).toBe(STATUS_CODE.CROWDFUNDING)
      expect(statusAt(item, APPEAL_HALF)).toBe(STATUS_CODE.WAITING_ARBITRATOR)
    })

    it('with no ruling, takes fees in the first half and closes at the end', () => {
      const item = appeal({ ruling: SUBGRAPH_RULING.NONE })
      expect(statusAt(item, APPEAL_START)).toBe(STATUS_CODE.CROWDFUNDING)
      expect(statusAt(item, APPEAL_HALF - 1)).toBe(STATUS_CODE.CROWDFUNDING)
      expect(statusAt(item, APPEAL_END)).toBe(STATUS_CODE.WAITING_ARBITRATOR)
    })

    // Regression: with no ruling (the jurors refused) PermanentGTCR.fundAppeal has
    // no loser and no half cutoff: either side funds until appealPeriodEnd.
    // This util still splits the period at its half and treats the submitter
    // as the loser, so the second half reads WAITING_ARBITRATOR (or
    // CROWDFUNDING_WINNER once the submitter paid). utils/item-status.ts gets
    // this right for Standard lists. Both current callers patch it
    // (pages/permanent-item-details/facts.ts stakeStatusCode and
    // components/curate/entry-status.tsx noRulingAppeal); a new caller would
    // not.
    it('with no ruling, takes fees from either side until the end', () => {
      const item = appeal({ ruling: SUBGRAPH_RULING.NONE })
      expect(statusAt(item, APPEAL_HALF)).toBe(STATUS_CODE.CROWDFUNDING)
      expect(statusAt(item, APPEAL_END - 1)).toBe(STATUS_CODE.CROWDFUNDING)
    })
  })

  describe('an entry off the list', () => {
    const CHALLENGED_LATE = String(SUBMISSION_END + DAY)
    const CHALLENGED_EARLY = String(INCLUDED_AT + HOUR)
    const LATER = SUBMISSION_END + 30 * DAY

    it('was withdrawn when its submission ended in a tx that settled no challenge', () => {
      const item = stakeEntry(CONTRACT_STATUS.ABSENT, {
        submissions: [{ finishedTx: '0xwithdraw', withdrawingTx: '0xstart' }],
        challenges: [
          // An earlier challenge the submitter won.
          {
            createdAt: CHALLENGED_EARLY,
            resolutionTx: '0xruling',
            disputeOutcome: SUBGRAPH_RULING.ACCEPT,
          },
        ],
      })
      expect(statusAt(item, LATER)).toBe(STATUS_CODE.WITHDRAWN)
      expect(statusAt({ ...item, challenges: [] }, LATER)).toBe(
        STATUS_CODE.WITHDRAWN,
      )
    })

    it('was withdrawn when a ruling for the submitter finished a pending withdrawal', () => {
      // rule() reincludes the entry, then withdraws it in the same tx.
      const item = stakeEntry(CONTRACT_STATUS.ABSENT, {
        submissions: [{ finishedTx: '0xruling', withdrawingTx: '0xstart' }],
        challenges: [
          {
            createdAt: CHALLENGED_LATE,
            resolutionTx: '0xruling',
            disputeOutcome: SUBGRAPH_RULING.ACCEPT,
          },
        ],
      })
      expect(statusAt(item, LATER)).toBe(STATUS_CODE.WITHDRAWN)
    })

    it.each<[string, string, Code]>([
      ['after', CHALLENGED_LATE, 'REMOVED'],
      ['within', CHALLENGED_EARLY, 'REJECTED'],
    ])(
      'challenged %s its submission period and ruled against, despite a started withdrawal, is %s',
      (_when, createdAt, code) => {
        const item = stakeEntry(CONTRACT_STATUS.ABSENT, {
          submissions: [{ finishedTx: '0xruling', withdrawingTx: '0xstart' }],
          challenges: [
            {
              createdAt,
              resolutionTx: '0xruling',
              disputeOutcome: SUBGRAPH_RULING.REJECT,
            },
          ],
        })
        expect(statusAt(item, LATER)).toBe(STATUS_CODE[code])
      },
    )

    it('reads a refusal to rule as a removal, not a withdrawal', () => {
      // rule() takes the entry off the list, refunding both sides.
      const item = stakeEntry(CONTRACT_STATUS.ABSENT, {
        submissions: [{ finishedTx: '0xruling', withdrawingTx: null }],
        challenges: [
          {
            createdAt: CHALLENGED_LATE,
            resolutionTx: '0xruling',
            disputeOutcome: SUBGRAPH_RULING.NONE,
          },
        ],
      })
      expect(statusAt(item, LATER)).toBe(STATUS_CODE.REMOVED)
    })

    it('reads a started withdrawal as done when the query has no finish tx and no challenge was resolved', () => {
      const unresolved = stakeEntry(CONTRACT_STATUS.ABSENT, {
        submissions: [{ withdrawingTx: '0xstart' }],
        challenges: [{ createdAt: CHALLENGED_LATE, resolutionTx: null }],
      })
      expect(statusAt(unresolved, LATER)).toBe(STATUS_CODE.WITHDRAWN)
      // A resolved challenge on record: a ruling may have removed it.
      const resolved = stakeEntry(CONTRACT_STATUS.ABSENT, {
        submissions: [{ withdrawingTx: '0xstart' }],
        challenges: [{ createdAt: CHALLENGED_LATE, resolutionTx: '0xruling' }],
      })
      expect(statusAt(resolved, LATER)).toBe(STATUS_CODE.REMOVED)
    })

    it.each<[string, number, Code]>([
      ['an hour into', INCLUDED_AT + HOUR, 'REJECTED'],
      ['the last second of', SUBMISSION_END, 'REJECTED'],
      ['a second after', SUBMISSION_END + 1, 'REMOVED'],
    ])(
      'taken off by a challenge made %s its submission period is %s',
      (_when, createdAt, code) => {
        const item = stakeEntry(CONTRACT_STATUS.ABSENT, {
          submissions: [{ finishedTx: '0xruling' }],
          challenges: [
            {
              createdAt: String(createdAt),
              resolutionTx: '0xruling',
              disputeOutcome: SUBGRAPH_RULING.REJECT,
            },
          ],
        })
        // The ruling itself comes long after the period.
        expect(statusAt(item, LATER)).toBe(STATUS_CODE[code])
      },
    )

    it('compares with now when the challenge time is not on record', () => {
      const item = stakeEntry(CONTRACT_STATUS.ABSENT)
      expect(statusAt(item, SUBMISSION_END)).toBe(STATUS_CODE.REJECTED)
      expect(statusAt(item, SUBMISSION_END + 1)).toBe(STATUS_CODE.REMOVED)
    })

    it('is never called removed when the inclusion time or the period is missing', () => {
      const challenges = [{ createdAt: CHALLENGED_LATE }]
      for (const includedAt of ['0', undefined])
        expect(
          statusAt(
            stakeEntry(CONTRACT_STATUS.ABSENT, { includedAt, challenges }),
            LATER,
          ),
        ).toBe(STATUS_CODE.REJECTED)
      for (const submissionPeriod of [0, undefined])
        expect(
          statusAt(stakeEntry(CONTRACT_STATUS.ABSENT, { challenges }), LATER, {
            ...REGISTRY,
            submissionPeriod,
          }),
        ).toBe(STATUS_CODE.REJECTED)
    })

    // Regression: a ruling for the submitter reincludes the entry and the indexer
    // resets includedAt to the ruling's time; the entry is then accepted
    // after the reinclusion period (as the Reincluded branch above says). If
    // it is challenged after that and removed, the Absent branch still
    // measures includedAt against the SUBMISSION period, so with the
    // wizard's 84 h / 12 h a removal 24 h after reinclusion reads REJECTED
    // ("never made it past submission") instead of REMOVED. Only the label
    // differs: both are off the list.
    it('reads an entry the court kept, removed after its reinclusion period, as removed', () => {
      const reincludedAt = INCLUDED_AT
      const item = stakeEntry(CONTRACT_STATUS.ABSENT, {
        includedAt: String(reincludedAt),
        submissions: [{ finishedTx: '0xsecond', withdrawingTx: null }],
        challenges: [
          {
            createdAt: String(reincludedAt + 24 * HOUR),
            resolutionTx: '0xsecond',
            disputeOutcome: SUBGRAPH_RULING.REJECT,
          },
          {
            createdAt: String(reincludedAt - 5 * DAY),
            resolutionTx: '0xfirst',
            disputeOutcome: SUBGRAPH_RULING.ACCEPT,
          },
        ],
      })
      expect(statusAt(item, LATER)).toBe(STATUS_CODE.REMOVED)
    })
  })

  it('has no status for a status it does not know', () => {
    expect(
      statusAt(stakeEntry('RegistrationRequested'), APPEAL_END + DAY),
    ).toBeUndefined()
  })
})
