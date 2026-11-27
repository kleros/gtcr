import { STATUS_CODE, SUBGRAPH_RULING } from 'utils/item-status'
import { formatAbsolute } from 'utils/time'
import type { StatusTone } from 'components/curate/primitives'
import type {
  RequestFacts,
  StandardRequest,
} from 'pages/standard-item-details/request-facts'

/*
 * The entry page's word to a party during an appeal (the Scout review's
 * "needs attention", option D): when the connected wallet is the requester
 * or the challenger and the appeal period is open, one sentence under the
 * status says, in the second person, what is theirs to do and by when. It
 * names the hero's own button ("Contribute fees") rather than adding a
 * second one. Nothing shows to anyone else, or once there is nothing left
 * for that party to do.
 */

export interface PartyNotice {
  tone: StatusTone
  text: string
}

const ACTION = 'Contribute fees'

export const partyAppealNotice = ({
  account,
  request,
  facts,
  statusCode,
}: {
  account: string | null | undefined
  request: StandardRequest | undefined
  facts: RequestFacts | undefined
  statusCode: number | undefined
}): PartyNotice | undefined => {
  if (!account || !request || !facts?.appealable) return undefined
  const me = account.toLowerCase()
  const isRequester = request.requester?.toLowerCase() === me
  const isChallenger = request.challenger?.toLowerCase() === me
  // Not a party, or both at once (nothing sensible to say to either side).
  if (isRequester === isChallenger) return undefined
  const round = request.rounds?.[0]
  if (!round) return undefined

  const minePaid = !!(isRequester
    ? round.hasPaidRequester
    : round.hasPaidChallenger)
  const theirsPaid = !!(isRequester
    ? round.hasPaidChallenger
    : round.hasPaidRequester)
  // Both sides funded: the appeal is being raised, nothing left to do.
  if (minePaid && theirsPaid) return undefined

  const end = formatAbsolute(facts.appealEnd)
  const half = formatAbsolute(facts.appealHalf)
  const youWin = `If the other side does not fund its side by ${end}, you win the case.`

  // The jurors refused to rule: either side may appeal until the end.
  if (facts.currentRuling === SUBGRAPH_RULING.NONE) {
    if (minePaid)
      return {
        tone: 'neutral',
        text: `Your side's appeal is funded. ${youWin}`,
      }
    if (theirsPaid)
      return {
        tone: 'contested',
        text: `The other side funded its appeal. Fund yours with ${ACTION} by ${end}, or you lose the case.`,
      }
    return {
      tone: 'contested',
      text: `The jurors did not rule. To appeal, fund your side with ${ACTION} by ${end}. If only the other side funds, it wins.`,
    }
  }

  const requesterWon = facts.currentRuling === SUBGRAPH_RULING.ACCEPT
  const iWon = requesterWon === isRequester
  if (!iWon) {
    if (minePaid)
      return { tone: 'neutral', text: `Your appeal is funded. ${youWin}` }
    // Past its half, an unfunded loser has nothing left to do.
    if (statusCode !== STATUS_CODE.CROWDFUNDING) return undefined
    return {
      tone: 'contested',
      text: `The jurors ruled against you. To appeal, fund your side with ${ACTION} by ${half}. After that, the ruling stands.`,
    }
  }
  if (theirsPaid)
    return {
      tone: 'contested',
      text: `The other side funded an appeal. Fund your side with ${ACTION} by ${end}, or you lose the case.`,
    }
  // A winner that funded early has done its part.
  if (minePaid || statusCode !== STATUS_CODE.CROWDFUNDING) return undefined
  return {
    tone: 'neutral',
    text: `The jurors ruled for you. If the other side funds an appeal by ${half}, you will have until ${end} to fund yours.`,
  }
}
