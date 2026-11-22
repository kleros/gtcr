import { describe, expect, it } from 'vitest'
import { BigNumber } from 'ethers'
import { STATUS_CODE } from 'utils/item-status'
import {
  type StandardRequest,
  capitalize,
  caseState,
  courtLink,
  fundedAlone,
  requestFacts,
  rulingShort,
  statusChangeNotice,
} from './request-facts'

const KLEROS_GNOSIS = '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002'
const KLEROS_ETHEREUM = '0x988b3a538b618c7a603e1c11ab82cd16dbe28069'
const OTHER_ARBITRATOR = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const HOUR = BigNumber.from(3600)

const round = (overrides: Partial<SubgraphRound> = {}): SubgraphRound => ({
  appealPeriodStart: '0',
  appealPeriodEnd: '0',
  ruling: 'None',
  hasPaidRequester: false,
  hasPaidChallenger: false,
  amountPaidRequester: BigNumber.from(0),
  amountPaidChallenger: BigNumber.from(0),
  ...overrides,
})

const standardRequest = (
  overrides: Partial<StandardRequest> = {},
): StandardRequest => ({
  requester: '0x1111111111111111111111111111111111111111',
  challenger: '0x0000000000000000000000000000000000000000',
  submissionTime: '1000',
  disputed: false,
  resolved: false,
  requestType: 'RegistrationRequested',
  rounds: [round()],
  disputeID: '0',
  arbitrator: KLEROS_GNOSIS,
  ...overrides,
})

const ITEM: SubgraphItem = {
  status: 'RegistrationRequested',
  disputed: false,
  data: '/ipfs/QmItem/item.json',
}

const factsFor = (
  request: StandardRequest,
  statusCode: number = STATUS_CODE.SUBMITTED,
  item: SubgraphItem = ITEM,
) =>
  requestFacts({
    item,
    request,
    statusCode,
    challengePeriodDuration: HOUR,
    chainId: 100,
  })

describe('courtLink', () => {
  it.each([
    [
      100,
      KLEROS_GNOSIS,
      '12',
      'https://court.kleros.io/cases/12?requiredChainId=100',
    ],
    // The address is matched whatever its case.
    [
      100,
      KLEROS_GNOSIS.toLowerCase(),
      7,
      'https://court.kleros.io/cases/7?requiredChainId=100',
    ],
    [
      1,
      KLEROS_ETHEREUM,
      '1',
      'https://court.kleros.io/cases/1?requiredChainId=1',
    ],
    // The arbitrator numbers its first case 0, and it is as real as any.
    [
      1,
      KLEROS_ETHEREUM,
      0,
      'https://court.kleros.io/cases/0?requiredChainId=1',
    ],
  ])(
    'links chain %d, arbitrator %s, case %s',
    (chainId, arbitrator, id, href) => {
      expect(courtLink(chainId, arbitrator, id)).toEqual({
        href,
        host: 'court.kleros.io',
      })
    },
  )

  it.each([
    ['another arbitrator', 100, OTHER_ARBITRATOR],
    ['the Gnosis court on Ethereum', 1, KLEROS_GNOSIS],
    ['a chain with no court', 5, KLEROS_GNOSIS],
    ['no chain', null, KLEROS_GNOSIS],
    ['an unknown chain', undefined, KLEROS_GNOSIS],
    ['no arbitrator', 100, undefined],
  ])('has no court page for %s', (_, chainId, arbitrator) => {
    expect(courtLink(chainId, arbitrator, '12')).toBeUndefined()
  })
})

describe('rulingShort', () => {
  it.each([
    ['Accept', 'submitter', 'For the submitter'],
    ['Accept', 'requester', 'For the requester'],
    ['Reject', 'submitter', 'For the challenger'],
    ['None', 'submitter', 'Refused to rule'],
    [null, 'submitter', undefined],
    [undefined, 'submitter', undefined],
    ['Unknown', 'submitter', undefined],
  ])('%s for a %s reads %s', (ruling, requesterName, text) => {
    expect(rulingShort(ruling, requesterName)).toBe(text)
  })
})

describe('requestFacts', () => {
  it('describes a submission in its challenge window', () => {
    expect(factsFor(standardRequest())).toEqual({
      isRegistration: true,
      requesterName: 'submitter',
      submissionTime: 1000,
      windowEnd: 4600,
      appealStart: 0,
      appealEnd: 0,
      appealHalf: 0,
      currentRuling: 'None',
      loserName: 'submitter',
      winnerName: 'challenger',
      inWindow: true,
      isPending: false,
      appealable: false,
      inCourt: false,
      hasDispute: false,
      disputeID: undefined,
      disputeHref: undefined,
      disputeHost: undefined,
    })
  })

  it('names the side of a removal its requester', () => {
    const facts = factsFor(
      standardRequest({ requestType: 'ClearingRequested' }),
      STATUS_CODE.REMOVAL_REQUESTED,
    )
    expect(facts.isRegistration).toBe(false)
    expect(facts.requesterName).toBe('requester')
  })

  it('reads the kind from the entry when the request does not say', () => {
    const request = standardRequest({ requestType: undefined })
    expect(factsFor(request).isRegistration).toBe(true)
    expect(
      factsFor(request, STATUS_CODE.REMOVAL_REQUESTED, {
        ...ITEM,
        status: 'ClearingRequested',
      }).requesterName,
    ).toBe('requester')
  })

  it('links a disputed request’s case, including case 0', () => {
    const facts = factsFor(
      standardRequest({ disputed: true, disputeID: '0' }),
      STATUS_CODE.CHALLENGED,
    )
    expect(facts).toMatchObject({
      hasDispute: true,
      disputeID: '0',
      disputeHref: 'https://court.kleros.io/cases/0?requiredChainId=100',
      disputeHost: 'court.kleros.io',
    })
  })

  it('has a case but no court page under another arbitrator', () => {
    const facts = factsFor(
      standardRequest({
        disputed: true,
        disputeID: '4',
        arbitrator: OTHER_ARBITRATOR,
      }),
      STATUS_CODE.CHALLENGED,
    )
    expect(facts).toMatchObject({
      hasDispute: true,
      disputeID: '4',
      disputeHref: undefined,
    })
  })

  it('has no case until the request is disputed, whatever its number', () => {
    const facts = factsFor(standardRequest({ disputeID: '12' }))
    expect(facts.hasDispute).toBe(false)
    expect(facts.disputeID).toBeUndefined()
    expect(facts.disputeHref).toBeUndefined()
  })

  it('puts the loser’s half where the contract’s integer division does', () => {
    const facts = factsFor(
      standardRequest({
        disputed: true,
        rounds: [round({ appealPeriodStart: '2000', appealPeriodEnd: '2601' })],
      }),
      STATUS_CODE.CROWDFUNDING,
    )
    expect(facts.appealStart).toBe(2000)
    expect(facts.appealEnd).toBe(2601)
    expect(facts.appealHalf).toBe(2300)
  })

  it.each([
    ['Accept', 'submitter', 'challenger'],
    ['Reject', 'challenger', 'submitter'],
    // A refusal fails the request, as a challenger's win does.
    ['None', 'challenger', 'submitter'],
  ])('a %s ruling: the %s wins, the %s loses', (ruling, winner, loser) => {
    const facts = factsFor(
      standardRequest({ disputed: true, rounds: [round({ ruling })] }),
      STATUS_CODE.CROWDFUNDING,
    )
    expect(facts.winnerName).toBe(winner)
    expect(facts.loserName).toBe(loser)
  })

  it('reads a request with no rounds', () => {
    const facts = factsFor(standardRequest({ rounds: [] }))
    expect(facts.currentRuling).toBeNull()
    expect(facts.appealHalf).toBe(0)
  })

  it.each([
    ['REGISTERED', STATUS_CODE.REGISTERED, [false, false, false, false]],
    ['SUBMITTED', STATUS_CODE.SUBMITTED, [true, false, false, false]],
    [
      'REMOVAL_REQUESTED',
      STATUS_CODE.REMOVAL_REQUESTED,
      [true, false, false, false],
    ],
    [
      'PENDING_SUBMISSION',
      STATUS_CODE.PENDING_SUBMISSION,
      [false, true, false, false],
    ],
    [
      'PENDING_REMOVAL',
      STATUS_CODE.PENDING_REMOVAL,
      [false, true, false, false],
    ],
    ['CHALLENGED', STATUS_CODE.CHALLENGED, [false, false, false, true]],
    ['CROWDFUNDING', STATUS_CODE.CROWDFUNDING, [false, false, true, false]],
    [
      'CROWDFUNDING_WINNER',
      STATUS_CODE.CROWDFUNDING_WINNER,
      [false, false, true, false],
    ],
    [
      'WAITING_ARBITRATOR',
      STATUS_CODE.WAITING_ARBITRATOR,
      [false, false, false, true],
    ],
    [
      'WAITING_ENFORCEMENT',
      STATUS_CODE.WAITING_ENFORCEMENT,
      [false, false, false, true],
    ],
    ['REJECTED', STATUS_CODE.REJECTED, [false, false, false, false]],
  ])('%s: in window, pending, appealable, in court', (_, statusCode, flags) => {
    const { inWindow, isPending, appealable, inCourt } = factsFor(
      standardRequest(),
      statusCode,
    )
    expect([inWindow, isPending, appealable, inCourt]).toEqual(flags)
  })
})

describe('caseState', () => {
  const disputed = (overrides: Partial<StandardRequest> = {}) =>
    standardRequest({ disputed: true, ...overrides })
  const stateOf = (request: StandardRequest, statusCode: number) =>
    caseState(request, factsFor(request, statusCode), statusCode)

  it('waits on the jurors while they decide, with no ruling yet', () => {
    expect(stateOf(disputed(), STATUS_CODE.CHALLENGED)).toEqual({
      heading: 'Jurors are deciding',
      awaitingCourt: true,
    })
  })

  it.each([
    [STATUS_CODE.CROWDFUNDING, 'Reject', 'For the challenger'],
    [STATUS_CODE.CROWDFUNDING, 'None', 'Refused to rule'],
    [STATUS_CODE.CROWDFUNDING_WINNER, 'Accept', 'For the submitter'],
  ])(
    'status %d with a %s ruling is open for appeal',
    (statusCode, ruling, text) => {
      expect(
        stateOf(disputed({ rounds: [round({ ruling })] }), statusCode),
      ).toEqual({
        heading: 'Open for appeal',
        awaitingCourt: true,
        ruling: text,
        rulingLabel: 'Current ruling',
      })
    },
  )

  it('says the ruling stands when the loser did not fund', () => {
    const request = disputed({ rounds: [round({ ruling: 'Reject' })] })
    expect(stateOf(request, STATUS_CODE.WAITING_ENFORCEMENT)).toEqual({
      heading: 'Ruling stands',
      awaitingCourt: false,
      summary: 'The losing side did not fund its appeal, so the ruling stands.',
      ruling: 'For the challenger',
      rulingLabel: 'Ruling',
    })
  })

  it('says who wins when one side alone funded the appeal', () => {
    // The jurors ruled for the challenger; the submitter alone paid, so
    // rule() gives the submitter the case.
    const request = disputed({
      rounds: [round({ ruling: 'Reject', hasPaidRequester: true })],
    })
    expect(stateOf(request, STATUS_CODE.WAITING_ARBITRATOR)).toEqual({
      heading: 'Ruling final',
      awaitingCourt: false,
      summary:
        'The submitter funded the appeal alone, so the submitter wins when the ruling is enforced.',
      ruling: 'For the challenger',
      rulingLabel: 'Ruling',
    })
  })

  it.each([
    ['both sides funded', { hasPaidRequester: true, hasPaidChallenger: true }],
    ['neither side funded', {}],
  ])('adds no summary to a final ruling when %s', (_, paid) => {
    const request = disputed({ rounds: [round({ ruling: 'Accept', ...paid })] })
    const state = stateOf(request, STATUS_CODE.WAITING_ARBITRATOR)
    expect(state.heading).toBe('Ruling final')
    expect(state.summary).toBeUndefined()
    expect(state.ruling).toBe('For the submitter')
  })

  it('reads a resolved request’s own outcome over the jurors’ ruling', () => {
    const request = disputed({
      resolved: true,
      disputeOutcome: 'Accept',
      rounds: [round({ ruling: 'Reject', hasPaidRequester: true })],
    })
    const state = stateOf(request, STATUS_CODE.WAITING_ARBITRATOR)
    expect(state.ruling).toBe('For the submitter')
    // The outcome is recorded: no sentence about who will win.
    expect(state.summary).toBeUndefined()
  })

  it('falls back on the jurors’ ruling when the outcome is not recorded', () => {
    const request = disputed({
      resolved: true,
      disputeOutcome: null,
      rounds: [round({ ruling: 'Reject' })],
    })
    expect(stateOf(request, STATUS_CODE.WAITING_ENFORCEMENT).ruling).toBe(
      'For the challenger',
    )
  })

  it('names a removal’s side its requester', () => {
    const request = disputed({
      requestType: 'ClearingRequested',
      rounds: [
        round({
          ruling: 'Accept',
          hasPaidChallenger: false,
          hasPaidRequester: true,
        }),
      ],
    })
    expect(stateOf(request, STATUS_CODE.WAITING_ARBITRATOR)).toMatchObject({
      summary:
        'The requester funded the appeal alone, so the requester wins when the ruling is enforced.',
      ruling: 'For the requester',
    })
  })
})

describe('capitalize', () => {
  it.each([
    ['submitter', 'Submitter'],
    ['challenger', 'Challenger'],
    ['', ''],
  ])('%j as %j', (text, capitalized) => {
    expect(capitalize(text)).toBe(capitalized)
  })
})

describe('statusChangeNotice', () => {
  const S = STATUS_CODE
  it.each([
    [S.SUBMITTED, S.PENDING_SUBMISSION, 'The challenge period has ended.'],
    [S.REMOVAL_REQUESTED, S.PENDING_REMOVAL, 'The challenge period has ended.'],
    [S.CROWDFUNDING, S.WAITING_ARBITRATOR, 'The appeal period has ended.'],
    [
      S.CROWDFUNDING_WINNER,
      S.WAITING_ARBITRATOR,
      'The appeal period has ended.',
    ],
    [
      S.CROWDFUNDING,
      S.WAITING_ENFORCEMENT,
      "The losing side's half of the appeal period has ended.",
    ],
    [S.SUBMITTED, S.CHALLENGED, "This entry's status changed."],
    [S.REGISTERED, S.REMOVAL_REQUESTED, "This entry's status changed."],
    [S.REJECTED, S.SUBMITTED, "This entry's status changed."],
    [S.REMOVED, S.SUBMITTED, "This entry's status changed."],
    [S.CROWDFUNDING, S.CHALLENGED, "This entry's status changed."],
  ])('%d → %d: %s', (from, to, notice) => {
    expect(statusChangeNotice(from, to)).toBe(notice)
  })

  it.each([
    S.CHALLENGED,
    S.WAITING_ARBITRATOR,
    S.WAITING_ENFORCEMENT,
    S.PENDING_SUBMISSION,
    S.PENDING_REMOVAL,
  ])('closes quietly from status %d, which shows no dialog', (from) => {
    expect(statusChangeNotice(from, S.REGISTERED)).toBeUndefined()
  })
})

describe('fundedAlone', () => {
  it.each([
    [{ hasPaidRequester: true }, 'submitter'],
    [{ hasPaidChallenger: true }, 'challenger'],
    [{ hasPaidRequester: true, hasPaidChallenger: true }, undefined],
    [{}, undefined],
  ])('%j: %s', (paid, side) => {
    expect(
      fundedAlone(standardRequest({ rounds: [round(paid)] }), 'submitter'),
    ).toBe(side)
  })

  it('is undefined without a request or a round', () => {
    expect(fundedAlone(undefined, 'submitter')).toBeUndefined()
    expect(
      fundedAlone(standardRequest({ rounds: [] }), 'submitter'),
    ).toBeUndefined()
  })
})
