import { STATUS_CODE, SUBGRAPH_RULING } from 'utils/item-status'
import { formatAbsolute, formatDuration } from 'utils/time'
import type { StatusTone } from 'components/curate/primitives'
import {
  appealFunding,
  type RequestFacts,
  type StandardRequest,
} from 'pages/standard-item-details/request-facts'

/*
 * The entry page's word to a party during an appeal (the Scout review's
 * "needs attention", option D; Fortunato: right in the entry's context,
 * but "Your call" was vague). When the connected wallet is the requester
 * or the challenger and the appeal period is open, one sentence under the
 * status says to that party what the page's action card says to everyone
 * (item-status-card.tsx): the same states (appealFunding, the loser's half,
 * the winner's turn, a refusal to rule), the same clocks, the same words,
 * with the reader's side named, as the parties' story always is (DESIGN.md:
 * the court's words for what the court said, the side for the story).
 * Where there is something to do it names the button that does it. Nothing
 * shows to anyone else, nor once that party has nothing left to do.
 */

export interface PartyNotice {
  tone: StatusTone
  text: string
}

/** The Standard action button's label while an appeal is funded. */
const ACTION = 'Contribute fees'

export const partyAppealNotice = ({
  account,
  request,
  facts,
  statusCode,
  now,
}: {
  account: string | null | undefined
  request: StandardRequest | undefined
  facts: RequestFacts | undefined
  statusCode: number | undefined
  /** Unix seconds. */
  now: number
}): PartyNotice | undefined => {
  if (!account || !request || !facts?.appealable || statusCode === undefined)
    return undefined
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
  // Both sides funded: the appeal is being raised, nothing left to do.
  if (
    minePaid &&
    (isRequester ? round.hasPaidChallenger : round.hasPaidRequester)
  )
    return undefined

  const mine = isRequester ? facts.requesterName : 'challenger'
  const theirs = isRequester ? 'challenger' : facts.requesterName
  const lost = mine === facts.loserName
  const funding = appealFunding(request, facts, statusCode)
  const refused = facts.currentRuling === SUBGRAPH_RULING.NONE

  // The clock that runs: the other side's once one is funded, the end of
  // the period on a refusal or the winner's turn, else the loser's half.
  let deadline = facts.appealEnd
  if (funding) deadline = funding.deadline
  else if (!refused && statusCode === STATUS_CODE.CROWDFUNDING)
    deadline = facts.appealHalf
  // Run out on the device's clock while the status, read from the chain's,
  // has not caught up yet: nothing to ask of anyone ("0s to fund").
  if (deadline <= now) return undefined
  const left = formatDuration(deadline - now)

  // One side is fully funded and the other's clock runs.
  if (funding)
    return funding.funded === mine
      ? {
          tone: 'neutral',
          text: `You, the ${mine}, are fully funded. The ${theirs} has ${left} to fund too, or loses.`,
        }
      : {
          tone: 'contested',
          text: `The ${theirs} is fully funded. You, the ${mine}, have ${left} to fund too with ${ACTION}, or you lose.`,
        }

  if (refused)
    return {
      tone: 'contested',
      text: `Jurors refused to rule. You, the ${mine}, can fund an appeal with ${ACTION} until ${formatAbsolute(facts.appealEnd)}: once one side is fully funded, the other must fund too, or loses.`,
    }

  // The loser's half.
  if (statusCode === STATUS_CODE.CROWDFUNDING) {
    if (lost)
      return {
        tone: 'contested',
        text: `You, the ${mine}, have ${left} to fund an appeal with ${ACTION}, or the ruling stands.`,
      }
    return minePaid
      ? {
          tone: 'neutral',
          text: `You, the ${mine}, are fully funded. The ${theirs} has ${left} to fund an appeal, or the ruling stands.`,
        }
      : {
          tone: 'neutral',
          text: `The ruling is for you, the ${mine}. If the ${theirs} funds an appeal in the next ${left}, you will have until ${formatAbsolute(facts.appealEnd)} to fund too.`,
        }
  }
  // The winner's turn: the loser funded in its half.
  return lost
    ? {
        tone: 'neutral',
        text: `You, the ${mine}, funded the appeal. The ${theirs} has ${left} to fund too, or loses.`,
      }
    : {
        tone: 'contested',
        text: `The ${theirs} funded the appeal. You, the ${mine}, have ${left} to fund too with ${ACTION}, or you lose.`,
      }
}
