import { describe, expect, it } from 'vitest'
import { BigNumber } from 'ethers'
import { STATUS_CODE } from 'utils/item-status'
import { formatAbsolute } from 'utils/time'
import { requestFacts, type StandardRequest } from './request-facts'
import { partyAppealNotice } from './party-notice'

const REQUESTER = '0x1111111111111111111111111111111111111111'
const CHALLENGER = '0x2222222222222222222222222222222222222222'
const STRANGER = '0x3333333333333333333333333333333333333333'
const START = 1_800_000_000
const END = START + 7200
const HALF = START + 3600

const ITEM: SubgraphItem = {
  status: 'RegistrationRequested',
  disputed: true,
  data: '/ipfs/QmItem/item.json',
}

const request = (
  ruling: string,
  paid: { requester?: boolean; challenger?: boolean } = {},
): StandardRequest => ({
  requester: REQUESTER,
  challenger: CHALLENGER,
  submissionTime: String(START - 100_000),
  disputed: true,
  resolved: false,
  requestType: 'RegistrationRequested',
  disputeID: '7',
  arbitrator: '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002',
  rounds: [
    {
      appealPeriodStart: String(START),
      appealPeriodEnd: String(END),
      ruling,
      hasPaidRequester: !!paid.requester,
      hasPaidChallenger: !!paid.challenger,
      amountPaidRequester: BigNumber.from(0),
      amountPaidChallenger: BigNumber.from(0),
    },
  ],
})

const notice = (
  account: string | null,
  req: StandardRequest,
  statusCode: number = STATUS_CODE.CROWDFUNDING,
) =>
  partyAppealNotice({
    account,
    request: req,
    statusCode,
    facts: requestFacts({
      item: ITEM,
      request: req,
      statusCode,
      challengePeriodDuration: BigNumber.from(3600),
      chainId: 100,
    }),
  })

describe('partyAppealNotice', () => {
  it('says nothing to a visitor who is not a party, or not connected', () => {
    expect(notice(STRANGER, request('Reject'))).toBeUndefined()
    expect(notice(null, request('Reject'))).toBeUndefined()
  })

  it('says nothing outside the appeal period', () => {
    expect(
      notice(REQUESTER, request('Reject'), STATUS_CODE.CHALLENGED),
    ).toBeUndefined()
  })

  it('tells the losing side how long it has to appeal (its half)', () => {
    // Reject: the jurors sided with the challenger, the submitter lost.
    const loser = notice(
      REQUESTER.toUpperCase().replace('0X', '0x'),
      request('Reject'),
    )
    expect(loser?.tone).toBe('contested')
    expect(loser?.text).toContain('ruled against you')
    expect(loser?.text).toContain(formatAbsolute(HALF))
    expect(loser?.text).toContain('Contribute fees')
  })

  it('tells the winning side what happens if the loser appeals', () => {
    const winner = notice(CHALLENGER, request('Reject'))
    expect(winner?.tone).toBe('neutral')
    expect(winner?.text).toContain('ruled for you')
    expect(winner?.text).toContain(formatAbsolute(END))
  })

  it('asks the winner to fund once the loser has', () => {
    const winner = notice(
      CHALLENGER,
      request('Reject', { requester: true }),
      STATUS_CODE.CROWDFUNDING_WINNER,
    )
    expect(winner?.tone).toBe('contested')
    expect(winner?.text).toContain('or you lose the case')
    const loser = notice(
      REQUESTER,
      request('Reject', { requester: true }),
      STATUS_CODE.CROWDFUNDING_WINNER,
    )
    expect(loser?.text).toContain('Your appeal is funded')
  })

  it('goes quiet when a party has nothing left to do', () => {
    // An unfunded loser past its half: the ruling stands.
    expect(
      notice(REQUESTER, request('Reject'), STATUS_CODE.CROWDFUNDING_WINNER),
    ).toBeUndefined()
    // A winner that funded early.
    expect(
      notice(CHALLENGER, request('Reject', { challenger: true })),
    ).toBeUndefined()
    // Both sides funded: the appeal is being raised.
    expect(
      notice(
        REQUESTER,
        request('Reject', { requester: true, challenger: true }),
      ),
    ).toBeUndefined()
  })

  it('lets either side appeal a refusal to rule, until the end', () => {
    const open = notice(REQUESTER, request('None'))
    expect(open?.text).toContain('did not rule')
    expect(open?.text).toContain(formatAbsolute(END))
    const behind = notice(REQUESTER, request('None', { challenger: true }))
    expect(behind?.text).toContain('or you lose the case')
    const ahead = notice(CHALLENGER, request('None', { challenger: true }))
    expect(ahead?.text).toContain('you win the case')
  })
})
