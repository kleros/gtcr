import { describe, expect, it } from 'vitest'
import { BigNumber } from 'ethers'
import { STATUS_CODE } from 'utils/permanent-item-status'
import {
  type StakeChallenge,
  type StakeItem,
  type StakeRegistry,
  capitalize,
  otherSide,
  rulingLine,
  rulingSentence,
  rulingShort,
  stakeCaseState,
  stakeCourtLink,
  stakeFacts,
  stakeStatusCode,
  toNum,
} from './facts'

const KLEROS_GNOSIS = '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002'
const OTHER_ARBITRATOR = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const registry = (overrides: Partial<StakeRegistry> = {}): StakeRegistry => ({
  id: '0x1111111111111111111111111111111111111111',
  token: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
  arbitrator: { id: KLEROS_GNOSIS },
  submissionPeriod: '1000',
  reinclusionPeriod: '500',
  withdrawingPeriod: '2000',
  arbitrationParamsCooldown: '3000',
  ...overrides,
})

const round = (overrides: Partial<SubgraphRound> = {}): SubgraphRound => ({
  appealPeriodStart: '0',
  appealPeriodEnd: '0',
  ruling: 'None',
  rulingTime: '0',
  hasPaidRequester: false,
  hasPaidChallenger: false,
  amountPaidRequester: BigNumber.from(0),
  amountPaidChallenger: BigNumber.from(0),
  ...overrides,
})

const challenge = (
  overrides: Partial<StakeChallenge> = {},
): StakeChallenge => ({
  disputeID: '0',
  challenger: '0x2222222222222222222222222222222222222222',
  createdAt: '15000',
  arbitrationSetting: { arbitratorExtraData: '0x' },
  rounds: [round()],
  ...overrides,
})

const stakeItem = (overrides: Partial<StakeItem> = {}): StakeItem => ({
  itemID: '0xabc',
  status: 'Submitted',
  disputed: false,
  data: '/ipfs/QmItem/item.json',
  submitter: '0x3333333333333333333333333333333333333333',
  stake: '1000000000000000000',
  includedAt: '10000',
  withdrawingTimestamp: '0',
  challenges: [],
  ...overrides,
})

/** A disputed entry whose challenge's first round is `ruled`. */
const disputedItem = (ruled: Partial<SubgraphRound>) =>
  stakeItem({
    status: 'Disputed',
    challenges: [challenge({ rounds: [round(ruled)] })],
  })

const factsFor = (item: StakeItem, statusCode: number, chainId = 100) =>
  stakeFacts({ item, registry: registry(), statusCode, chainId })

describe('toNum', () => {
  it.each([
    ['12', 12],
    [12, 12],
    ['0', 0],
    [undefined, 0],
    [null, 0],
    ['soon', 0],
    [Infinity, 0],
  ])('%j is %d', (value, n) => {
    expect(toNum(value)).toBe(n)
  })
})

describe('rulings in words', () => {
  it.each([
    ['None', 'Jurors refused to rule', 'Refused to rule'],
    ['Accept', 'Jurors ruled for the submitter', 'For the submitter'],
    ['Reject', 'Jurors ruled for the challenger', 'For the challenger'],
    [null, 'No ruling yet', undefined],
    [undefined, 'No ruling yet', undefined],
    ['Unknown', 'No ruling yet', undefined],
  ])('%s: %j, %j', (ruling, line, short) => {
    expect(rulingLine(ruling)).toBe(line)
    expect(rulingSentence(ruling)).toBe(`${line}.`)
    expect(rulingShort(ruling)).toBe(short)
  })
})

describe('stakeStatusCode', () => {
  // The appeal period runs from 1000 to 2000; its half is at 1500.
  const appeal = {
    appealPeriodStart: '1000',
    appealPeriodEnd: '2000',
    rulingTime: '900',
  }
  const at = (ts: number) => BigNumber.from(ts)

  it.each([
    [
      'refused to rule, past the half, nobody funded',
      { ...appeal, ruling: 'None' },
      1600,
      STATUS_CODE.CROWDFUNDING,
    ],
    [
      'refused to rule, past the half, the submitter funded',
      { ...appeal, ruling: 'None', hasPaidRequester: true },
      1600,
      STATUS_CODE.CROWDFUNDING,
    ],
    // The contracts take contributions while now < appealPeriodEnd.
    [
      'refused to rule, at the end of the period',
      { ...appeal, ruling: 'None' },
      2000,
      STATUS_CODE.WAITING_ARBITRATOR,
    ],
    [
      'a ruling for the challenger whose loser did not fund in time',
      { ...appeal, ruling: 'Reject' },
      1600,
      STATUS_CODE.WAITING_ARBITRATOR,
    ],
    [
      'a ruling for the submitter whose loser funded',
      { ...appeal, ruling: 'Accept', hasPaidChallenger: true },
      1600,
      STATUS_CODE.CROWDFUNDING_WINNER,
    ],
    [
      'a ruling in its first half',
      { ...appeal, ruling: 'Reject' },
      1200,
      STATUS_CODE.CROWDFUNDING,
    ],
    [
      'no ruling yet',
      { ruling: 'None', rulingTime: '0' },
      1600,
      STATUS_CODE.DISPUTED,
    ],
  ])('%s', (_, ruled, now, code) => {
    expect(stakeStatusCode(disputedItem(ruled), at(now), registry())).toBe(code)
  })

  it('passes other statuses through', () => {
    // Included at 10000 with a 1000 s submission period.
    expect(stakeStatusCode(stakeItem(), at(10_500), registry())).toBe(
      STATUS_CODE.PENDING,
    )
    expect(stakeStatusCode(stakeItem(), at(11_001), registry())).toBe(
      STATUS_CODE.ACCEPTED,
    )
  })
})

describe('stakeCourtLink', () => {
  it('opens a Kleros case on the court, on the list’s chain', () => {
    expect(stakeCourtLink(100, KLEROS_GNOSIS.toLowerCase(), '0')).toEqual({
      href: 'https://court.kleros.io/cases/0?requiredChainId=100',
      host: 'court.kleros.io',
    })
  })

  it.each([
    [100, 'https://gnosis.blockscout.com', 'gnosis.blockscout.com'],
    [1, 'https://etherscan.io', 'etherscan.io'],
    [11155111, 'https://sepolia.etherscan.io', 'sepolia.etherscan.io'],
  ])(
    'opens another arbitrator on chain %d’s explorer',
    (chainId, explorer, host) => {
      expect(stakeCourtLink(chainId, OTHER_ARBITRATOR, '3')).toEqual({
        href: `${explorer}/address/${OTHER_ARBITRATOR}`,
        host,
      })
    },
  )

  it('does not take another chain’s court for this one', () => {
    expect(stakeCourtLink(1, KLEROS_GNOSIS, '3')?.host).toBe('etherscan.io')
  })

  it('links nothing without a case or an arbitrator', () => {
    expect(stakeCourtLink(100, KLEROS_GNOSIS, undefined)).toBeUndefined()
    expect(stakeCourtLink(100, KLEROS_GNOSIS, '')).toBeUndefined()
    expect(stakeCourtLink(100, undefined, '3')).toBeUndefined()
  })
})

describe('stakeFacts', () => {
  it('describes an entry in its submission period', () => {
    expect(factsFor(stakeItem(), STATUS_CODE.PENDING)).toMatchObject({
      offList: false,
      includedAt: 10_000,
      reincluded: false,
      period: 1000,
      acceptedAt: 11_000,
      withdrawingAt: 0,
      isWithdrawing: false,
      isWithdrawable: true,
      withdrawalStage: 'listed',
      hasDispute: false,
      appealable: false,
      underDispute: false,
      inCourt: false,
      challengedAt: 0,
      submissionStart: 10_000,
      endedAt: 0,
      courtHref: undefined,
    })
  })

  it('times a reincluded entry by the reinclusion period', () => {
    const facts = factsFor(
      stakeItem({ status: 'Reincluded' }),
      STATUS_CODE.PENDING,
    )
    expect(facts.reincluded).toBe(true)
    expect(facts.period).toBe(500)
    expect(facts.acceptedAt).toBe(10_500)
  })

  it.each([
    [STATUS_CODE.ACCEPTED, '12000', 'withdrawing', true, false],
    [STATUS_CODE.PENDING_WITHDRAWAL, '12000', 'ready', true, false],
    [STATUS_CODE.WITHDRAWN, '12000', 'withdrawn', false, false],
    [STATUS_CODE.ACCEPTED, '0', 'listed', false, true],
    [STATUS_CODE.REMOVED, '0', 'listed', false, false],
  ])(
    'status %d, withdrawing since %s: %s',
    (statusCode, withdrawingTimestamp, stage, withdrawing, withdrawable) => {
      const facts = factsFor(stakeItem({ withdrawingTimestamp }), statusCode)
      expect(facts.withdrawalStage).toBe(stage)
      expect(facts.isWithdrawing).toBe(withdrawing)
      expect(facts.isWithdrawable).toBe(withdrawable)
    },
  )

  it('dates when a withdrawal can be executed', () => {
    const facts = factsFor(
      stakeItem({ withdrawingTimestamp: '12000' }),
      STATUS_CODE.ACCEPTED,
    )
    expect(facts.withdrawingAt).toBe(12_000)
    expect(facts.withdrawingPeriod).toBe(2000)
    expect(facts.withdrawReadyAt).toBe(14_000)
  })

  it.each([
    [STATUS_CODE.REJECTED, true],
    [STATUS_CODE.REMOVED, true],
    [STATUS_CODE.WITHDRAWN, true],
    [STATUS_CODE.ACCEPTED, false],
    [STATUS_CODE.DISPUTED, false],
  ])('status %d is off the list: %s', (statusCode, offList) => {
    expect(factsFor(stakeItem(), statusCode).offList).toBe(offList)
  })

  it('dates when an entry left the list', () => {
    const withdrawn = stakeItem({
      submissions: [{ createdAt: '9000', finishedAt: '16000' }],
    })
    expect(factsFor(withdrawn, STATUS_CODE.WITHDRAWN).endedAt).toBe(16_000)
    const removed = stakeItem({
      challenges: [challenge({ resolutionTime: '17000' })],
    })
    expect(factsFor(removed, STATUS_CODE.REMOVED).endedAt).toBe(17_000)
  })

  it('counts the latest submission from its own start', () => {
    const item = stakeItem({ submissions: [{ createdAt: '9000' }] })
    expect(factsFor(item, STATUS_CODE.ACCEPTED).submissionStart).toBe(9000)
  })

  it('has a case for a challenge, even case 0', () => {
    const facts = factsFor(disputedItem({}), STATUS_CODE.DISPUTED)
    expect(facts).toMatchObject({
      hasDispute: true,
      disputeID: '0',
      challengedAt: 15_000,
      underDispute: true,
      inCourt: true,
      appealable: false,
      courtHref: 'https://court.kleros.io/cases/0?requiredChainId=100',
      courtHost: 'court.kleros.io',
    })
  })

  it.each([
    ['Accept', 'submitter', 'challenger'],
    ['Reject', 'challenger', 'submitter'],
  ])('a %s ruling: the %s wins, the %s loses', (ruling, winner, loser) => {
    const facts = factsFor(
      disputedItem({ ruling, rulingTime: '900' }),
      STATUS_CODE.CROWDFUNDING,
    )
    expect(facts.winnerName).toBe(winner)
    expect(facts.loserName).toBe(loser)
    expect(facts.refusedToRule).toBe(false)
  })

  it('opens a refusal to rule to either side while it can be appealed', () => {
    const refused = { ruling: 'None', rulingTime: '900' }
    expect(
      factsFor(disputedItem(refused), STATUS_CODE.CROWDFUNDING),
    ).toMatchObject({
      refusedToRule: true,
      refusedOpen: true,
      appealable: true,
    })
    expect(
      factsFor(disputedItem(refused), STATUS_CODE.WAITING_ARBITRATOR),
    ).toMatchObject({ refusedToRule: true, refusedOpen: false, inCourt: true })
    // No ruling yet is not a refusal.
    expect(
      factsFor(disputedItem({ ruling: 'None' }), STATUS_CODE.DISPUTED)
        .refusedToRule,
    ).toBe(false)
  })

  it.each([
    [{ hasPaidRequester: true }, 'submitter'],
    [{ hasPaidChallenger: true }, 'challenger'],
    [{ hasPaidRequester: true, hasPaidChallenger: true }, undefined],
    [{}, undefined],
  ])('%j: the side funded alone is %s', (paid, side) => {
    expect(
      factsFor(disputedItem(paid), STATUS_CODE.CROWDFUNDING).fundedSide,
    ).toBe(side)
  })

  it('reads the appeal period', () => {
    const facts = factsFor(
      disputedItem({ appealPeriodStart: '1000', appealPeriodEnd: '2000' }),
      STATUS_CODE.CROWDFUNDING,
    )
    expect([facts.appealStart, facts.appealHalf, facts.appealEnd]).toEqual([
      1000, 1500, 2000,
    ])
  })

  // Regression: the loser's deadline was (start + end) / 2 without the
  // contract's integer division. PermanentGTCR.fundAppeal refuses the loser from
  // (appealPeriodStart + appealPeriodEnd) / 2 (Solidity, so floored), and
  // permanent-item-status.ts and the Standard request-facts.ts floor it;
  // here an odd period puts the loser's "funds by" deadline and countdown
  // (item-window.tsx, item-status-card.tsx) half a second after the
  // contract's cutoff, where the status code has already moved on.
  it('puts the loser’s half where the contract’s integer division does', () => {
    const facts = factsFor(
      disputedItem({ appealPeriodStart: '1000', appealPeriodEnd: '2001' }),
      STATUS_CODE.CROWDFUNDING,
    )
    expect(facts.appealHalf).toBe(1500)
  })
})

describe('stakeCaseState', () => {
  // 15 Jan 2027, 08:00 UTC.
  const END = 1_800_000_000
  const appeal = {
    appealPeriodStart: String(END - 3600),
    appealPeriodEnd: String(END),
    rulingTime: String(END - 3700),
  }
  const stateFor = (
    ruled: Partial<SubgraphRound>,
    statusCode: number,
    now: number,
  ) =>
    stakeCaseState(factsFor(disputedItem(ruled), statusCode), statusCode, now)

  it('waits on the jurors while they decide', () => {
    expect(stateFor({}, STATUS_CODE.DISPUTED, END)).toEqual({
      heading: 'Jurors are deciding',
      awaitingCourt: true,
    })
  })

  it.each([
    ['Accept', 'For the submitter', 1],
    ['Reject', 'For the challenger', 2],
    ['None', 'Refused to rule', undefined],
  ])('is open for appeal on a %s ruling', (ruling, text, rulingChoice) => {
    const state = stateFor(
      { ...appeal, ruling },
      STATUS_CODE.CROWDFUNDING,
      END - 3000,
    )
    expect(state).toEqual({
      heading: 'Open for appeal',
      awaitingCourt: true,
      ruling: text,
      rulingChoice,
      rulingLabel: 'Current ruling',
    })
    expect(state.rulingChoice).toBe(rulingChoice)
  })

  it('says the ruling stands, and from when it can be enforced, once the loser’s half passed', () => {
    expect(
      stateFor(
        { ...appeal, ruling: 'Reject' },
        STATUS_CODE.WAITING_ARBITRATOR,
        END - 600,
      ),
    ).toEqual({
      heading: 'Ruling stands',
      awaitingCourt: false,
      summary:
        'The submitter did not fund the appeal, so the ruling stands; it can be enforced from 15 Jan 2027, 08:00 UTC.',
      ruling: 'For the challenger',
      rulingChoice: 2,
      rulingLabel: 'Ruling',
    })
  })

  it('says who wins when one side alone funded the appeal', () => {
    expect(
      stateFor(
        { ...appeal, ruling: 'Accept', hasPaidChallenger: true },
        STATUS_CODE.WAITING_ARBITRATOR,
        END,
      ),
    ).toEqual({
      heading: 'Ruling final',
      awaitingCourt: false,
      summary:
        'The challenger funded the appeal alone, so the challenger wins when the ruling is enforced.',
      ruling: 'For the submitter',
      rulingChoice: 1,
      rulingLabel: 'Ruling',
    })
  })

  it('adds nothing to a final ruling nobody appealed', () => {
    const state = stateFor(
      { ...appeal, ruling: 'Accept' },
      STATUS_CODE.WAITING_ARBITRATOR,
      END + 60,
    )
    expect(state.heading).toBe('Ruling final')
    expect(state.summary).toBeUndefined()
  })
})

describe('otherSide and capitalize', () => {
  it('names the other party', () => {
    expect(otherSide('submitter')).toBe('challenger')
    expect(otherSide('challenger')).toBe('submitter')
  })

  it.each([
    ['submitter', 'Submitter'],
    ['', ''],
  ])('%j as %j', (text, capitalized) => {
    expect(capitalize(text)).toBe(capitalized)
  })
})
