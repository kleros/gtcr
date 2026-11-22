import { BigNumber } from 'ethers'
import { describe, expect, it } from 'vitest'
import {
  CONTRACT_STATUS,
  REQUEST_TYPE_LABEL,
  STATUS_CODE,
  SUBGRAPH_RULING,
  hasPendingRequest,
  itemToStatusCode,
} from './item-status'

type Code = keyof typeof STATUS_CODE

const DAY = 24 * 3600
const SUBMITTED_AT = 1700000000
const CHALLENGE_PERIOD = 3 * DAY
const WINDOW_END = SUBMITTED_AT + CHALLENGE_PERIOD
const PERIOD = BigNumber.from(CHALLENGE_PERIOD)

// An odd-length appeal period: its half falls where the contracts' integer
// division puts it, floor((start + end) / 2), not on a half second.
const APPEAL_START = 1800000000
const APPEAL_END = APPEAL_START + 101
const APPEAL_HALF = APPEAL_START + 50

const round = (over: Partial<SubgraphRound> = {}): SubgraphRound => ({
  appealPeriodStart: '0',
  appealPeriodEnd: '0',
  ruling: SUBGRAPH_RULING.NONE,
  hasPaidRequester: false,
  hasPaidChallenger: false,
  amountPaidRequester: BigNumber.from(0),
  amountPaidChallenger: BigNumber.from(0),
  ...over,
})

const request = (over: Partial<SubgraphRequest> = {}): SubgraphRequest => ({
  requester: '0x0000000000000000000000000000000000000001',
  challenger: '0x0000000000000000000000000000000000000002',
  submissionTime: String(SUBMITTED_AT),
  disputed: false,
  resolved: false,
  requestType: CONTRACT_STATUS.REGISTRATION_REQUESTED,
  rounds: [round()],
  ...over,
})

/** An entry whose latest request is `latest`; none when it is left out. */
const entry = (
  status: string,
  latest?: Partial<SubgraphRequest>,
): SubgraphItem => ({
  status,
  disputed: latest?.disputed ?? false,
  data: '0x',
  requests: latest ? [request(latest)] : [],
})

/** A challenged submission whose latest round is `latestRound`. */
const disputed = (latestRound: Partial<SubgraphRound> = {}): SubgraphItem =>
  entry(CONTRACT_STATUS.REGISTRATION_REQUESTED, {
    disputed: true,
    rounds: [round(latestRound)],
  })

/** An appeal under way: the jurors ruled, the appeal period is open. */
const appeal = (over: Partial<SubgraphRound> = {}): SubgraphItem =>
  disputed({
    appealPeriodStart: String(APPEAL_START),
    appealPeriodEnd: String(APPEAL_END),
    ...over,
  })

const statusAt = (item: SubgraphItem, now: number): number | undefined =>
  itemToStatusCode(item, BigNumber.from(now), PERIOD)

describe('itemToStatusCode', () => {
  describe('before its data has loaded', () => {
    it.each(Object.values(CONTRACT_STATUS))(
      'has no status for a %s entry with no request',
      (status) => {
        expect(statusAt(entry(status), WINDOW_END)).toBeUndefined()
        expect(
          statusAt({ ...entry(status), requests: undefined }, WINDOW_END),
        ).toBeUndefined()
      },
    )

    it('has no open-request status until the clock and the challenge period load', () => {
      const items = [
        entry(CONTRACT_STATUS.REGISTRATION_REQUESTED, {}),
        entry(CONTRACT_STATUS.REMOVAL_REQUESTED, {
          requestType: CONTRACT_STATUS.REMOVAL_REQUESTED,
        }),
        appeal({ ruling: SUBGRAPH_RULING.ACCEPT }),
      ]
      const now = BigNumber.from(SUBMITTED_AT)
      for (const item of items) {
        expect(itemToStatusCode(item, null, PERIOD)).toBeUndefined()
        expect(itemToStatusCode(item, undefined, PERIOD)).toBeUndefined()
        expect(itemToStatusCode(item, now, null)).toBeUndefined()
        expect(itemToStatusCode(item, now, undefined)).toBeUndefined()
      }
    })

    it('has no court status until the latest round loads', () => {
      for (const rounds of [[], undefined])
        expect(
          statusAt(
            entry(CONTRACT_STATUS.REGISTRATION_REQUESTED, {
              disputed: true,
              rounds,
            }),
            WINDOW_END,
          ),
        ).toBeUndefined()
    })
  })

  describe('a settled entry', () => {
    it.each<[string, string, Code]>([
      ['Registered', 'RegistrationRequested', 'REGISTERED'],
      // A removal request the challenger won.
      ['Registered', 'ClearingRequested', 'REGISTERED'],
      ['Absent', 'RegistrationRequested', 'REJECTED'],
      ['Absent', 'ClearingRequested', 'REMOVED'],
    ])('%s after a %s request is %s', (status, requestType, code) => {
      const item = entry(status, { requestType, resolved: true })
      expect(statusAt(item, WINDOW_END + DAY)).toBe(STATUS_CODE[code])
    })

    it('needs neither the clock nor the challenge period', () => {
      expect(
        itemToStatusCode(
          entry('Registered', { resolved: true }),
          undefined,
          null,
        ),
      ).toBe(STATUS_CODE.REGISTERED)
      expect(
        itemToStatusCode(
          entry('Absent', {
            requestType: CONTRACT_STATUS.REMOVAL_REQUESTED,
            resolved: true,
          }),
          null,
          undefined,
        ),
      ).toBe(STATUS_CODE.REMOVED)
    })
  })

  // LightGeneralizedTCR takes a challenge while now - submissionTime <=
  // challengePeriodDuration and executes once it is >: the window's last
  // second still belongs to the challengers.
  describe.each([
    {
      status: CONTRACT_STATUS.REGISTRATION_REQUESTED,
      open: 'SUBMITTED' as Code,
      ready: 'PENDING_SUBMISSION' as Code,
    },
    {
      status: CONTRACT_STATUS.REMOVAL_REQUESTED,
      open: 'REMOVAL_REQUESTED' as Code,
      ready: 'PENDING_REMOVAL' as Code,
    },
  ])('an unchallenged $status', ({ status, open, ready }) => {
    const item = entry(status, { requestType: status })

    it('is open to challenge from its submission to the last second of the window', () => {
      for (const now of [SUBMITTED_AT, WINDOW_END - 1, WINDOW_END])
        expect(statusAt(item, now)).toBe(STATUS_CODE[open])
    })

    it('is ready to execute from the second after the window', () => {
      for (const now of [WINDOW_END + 1, WINDOW_END + 365 * DAY])
        expect(statusAt(item, now)).toBe(STATUS_CODE[ready])
    })

    it('reads a challenge period of zero as loaded, not missing', () => {
      const zero = BigNumber.from(0)
      expect(itemToStatusCode(item, BigNumber.from(SUBMITTED_AT), zero)).toBe(
        STATUS_CODE[open],
      )
      expect(
        itemToStatusCode(item, BigNumber.from(SUBMITTED_AT + 1), zero),
      ).toBe(STATUS_CODE[ready])
    })
  })

  describe('a challenged request', () => {
    it('is in court until the jurors rule, whatever the challenge window', () => {
      for (const now of [SUBMITTED_AT, WINDOW_END + 1, WINDOW_END + 365 * DAY])
        expect(statusAt(disputed(), now)).toBe(STATUS_CODE.CHALLENGED)
    })

    it('is in court the same way for a removal', () => {
      const item = entry(CONTRACT_STATUS.REMOVAL_REQUESTED, {
        requestType: CONTRACT_STATUS.REMOVAL_REQUESTED,
        disputed: true,
      })
      expect(statusAt(item, WINDOW_END + 1)).toBe(STATUS_CODE.CHALLENGED)
    })

    // No ruling (the jurors refused): there is no loser, and either side
    // funds until the period ends.
    it.each<[string, number, Code]>([
      ['the start', APPEAL_START, 'CROWDFUNDING'],
      ['the half', APPEAL_HALF, 'CROWDFUNDING'],
      ['the last second', APPEAL_END - 1, 'CROWDFUNDING'],
      ['the end', APPEAL_END, 'WAITING_ARBITRATOR'],
      ['a day later', APPEAL_END + DAY, 'WAITING_ARBITRATOR'],
    ])('with no ruling, at %s of the appeal, is %s', (_when, now, code) => {
      expect(statusAt(appeal({ ruling: SUBGRAPH_RULING.NONE }), now)).toBe(
        STATUS_CODE[code],
      )
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
        loser: 'requester',
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

        it('lets the ruling stand after the half when the loser is not funded', () => {
          for (const paid of [{}, winnerPaid])
            for (const now of [APPEAL_HALF, APPEAL_END - 1])
              expect(statusAt(appeal({ ruling, ...paid }), now)).toBe(
                STATUS_CODE.WAITING_ENFORCEMENT,
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

    it('ends the loser’s half on the whole second the contracts compute', () => {
      // (start + end) / 2 is APPEAL_HALF + 0.5: that second is already past.
      const item = appeal({ ruling: SUBGRAPH_RULING.ACCEPT })
      expect(statusAt(item, APPEAL_HALF - 1)).toBe(STATUS_CODE.CROWDFUNDING)
      expect(statusAt(item, APPEAL_HALF)).toBe(STATUS_CODE.WAITING_ENFORCEMENT)
    })
  })
})

describe('hasPendingRequest', () => {
  it.each([
    ['RegistrationRequested', true],
    ['ClearingRequested', true],
    ['Registered', false],
    ['Absent', false],
    ['', false],
  ])('%j has an open request: %s', (status, open) => {
    expect(hasPendingRequest(status)).toBe(open)
  })
})

describe('REQUEST_TYPE_LABEL', () => {
  it('names exactly the statuses that carry an open request', () => {
    const statuses = Object.values(CONTRACT_STATUS)
    expect(statuses.filter((status) => REQUEST_TYPE_LABEL[status])).toEqual(
      statuses.filter(hasPendingRequest),
    )
  })
})
