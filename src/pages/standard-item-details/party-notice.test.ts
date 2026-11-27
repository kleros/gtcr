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
/** 20 minutes into the loser's half, 40 minutes before it ends. */
const NOW = START + 1200

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
  now: number = NOW,
) =>
  partyAppealNotice({
    account,
    request: req,
    statusCode,
    now,
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

  it("gives the losing side the action card's words, its side named", () => {
    // Reject: the jurors sided with the challenger, the submitter lost.
    const loser = notice(
      REQUESTER.toUpperCase().replace('0X', '0x'),
      request('Reject'),
    )
    expect(loser).toEqual({
      tone: 'contested',
      text: 'You, the submitter, have 40m to fund an appeal with Contribute fees, or the ruling stands.',
    })
  })

  it('tells the winning side what happens if the loser appeals', () => {
    expect(notice(CHALLENGER, request('Reject'))).toEqual({
      tone: 'neutral',
      text: `The ruling is for you, the challenger. If the submitter funds an appeal in the next 40m, you will have until ${formatAbsolute(END)} to fund too.`,
    })
  })

  it("tells a winner that funded early it waits on the loser's half", () => {
    expect(notice(CHALLENGER, request('Reject', { challenger: true }))).toEqual(
      {
        tone: 'neutral',
        text: 'You, the challenger, are fully funded. The submitter has 40m to fund an appeal, or the ruling stands.',
      },
    )
  })

  it('moves the clock to the winner once the loser is funded', () => {
    // Inside the loser's half: appealFunding, as the action card reads it.
    const early = request('Reject', { requester: true })
    expect(notice(CHALLENGER, early)).toEqual({
      tone: 'contested',
      text: 'The submitter is fully funded. You, the challenger, have 1h 40m to fund too with Contribute fees, or you lose.',
    })
    expect(notice(REQUESTER, early)?.text).toBe(
      'You, the submitter, are fully funded. The challenger has 1h 40m to fund too, or loses.',
    )
    // The winner's turn (second half).
    const late = HALF + 600
    expect(
      notice(CHALLENGER, early, STATUS_CODE.CROWDFUNDING_WINNER, late),
    ).toEqual({
      tone: 'contested',
      text: 'The submitter funded the appeal. You, the challenger, have 50m to fund too with Contribute fees, or you lose.',
    })
    expect(
      notice(REQUESTER, early, STATUS_CODE.CROWDFUNDING_WINNER, late)?.text,
    ).toBe(
      'You, the submitter, funded the appeal. The challenger has 50m to fund too, or loses.',
    )
  })

  it('says nothing once its clock has run out, before the status follows', () => {
    // Past the loser's half on the device's clock, the status not yet read.
    expect(
      notice(REQUESTER, request('Reject'), STATUS_CODE.CROWDFUNDING, HALF),
    ).toBeUndefined()
    expect(
      notice(
        CHALLENGER,
        request('Reject', { requester: true }),
        STATUS_CODE.CROWDFUNDING_WINNER,
        END + 5,
      ),
    ).toBeUndefined()
  })

  it('goes quiet once both sides are funded', () => {
    expect(
      notice(
        REQUESTER,
        request('Reject', { requester: true, challenger: true }),
      ),
    ).toBeUndefined()
  })

  it('names a removal request’s side as the requester', () => {
    const removal = {
      ...request('Accept'),
      requestType: 'ClearingRequested',
    }
    // Accept: the requester won; the challenger lost.
    expect(notice(CHALLENGER, removal)?.text).toContain(
      'You, the challenger, have 40m to fund an appeal',
    )
    expect(notice(REQUESTER, removal)?.text).toBe(
      `The ruling is for you, the requester. If the challenger funds an appeal in the next 40m, you will have until ${formatAbsolute(END)} to fund too.`,
    )
  })

  it('lets either side appeal a refusal to rule, until the end', () => {
    expect(notice(REQUESTER, request('None'))).toEqual({
      tone: 'contested',
      text: `Jurors refused to rule. You, the submitter, can fund an appeal with Contribute fees until ${formatAbsolute(END)}: once one side is fully funded, the other must fund too, or loses.`,
    })
    const behind = notice(REQUESTER, request('None', { challenger: true }))
    expect(behind?.text).toBe(
      'The challenger is fully funded. You, the submitter, have 1h 40m to fund too with Contribute fees, or you lose.',
    )
    const ahead = notice(CHALLENGER, request('None', { challenger: true }))
    expect(ahead?.tone).toBe('neutral')
    expect(ahead?.text).toContain('You, the challenger, are fully funded.')
  })
})
