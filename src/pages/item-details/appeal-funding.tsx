import React from 'react'
import { STATUS_CODE, SUBGRAPH_RULING } from 'utils/item-status'
import { WindowRing } from 'components/curate/item-light-window-ring'
import { WindowPanel } from 'pages/light-item-details/item-window'
import {
  capitalize,
  type LightRequest,
  type RequestFacts,
} from 'pages/light-item-details/request-facts'

/*
 * Who still has to fund the appeal, read from the latest round. Once one
 * side is fully funded, the clock that matters belongs to the other side:
 * the winner (or, when jurors refused to rule, the side that has not paid)
 * has until the end of the appeal period to fund too, or loses. The ruling
 * and status alone cannot tell this; the round's hasPaid flags can.
 */

export interface AppealFunding {
  /** The side that is fully funded. */
  funded: string
  /** The side that still has to fund, or it loses. */
  pending: string
  /** Unix seconds: when the pending side's time runs out. */
  deadline: number
}

export const appealFunding = (
  request: LightRequest | undefined,
  facts: RequestFacts,
  statusCode: number,
): AppealFunding | undefined => {
  if (!facts.appealable) return undefined
  const round = request?.rounds?.[0]
  if (!round) return undefined
  const requesterPaid = !!round.hasPaidRequester
  const challengerPaid = !!round.hasPaidChallenger
  // Neither side yet (the usual case), or both (the appeal is being raised).
  if (requesterPaid === challengerPaid) return undefined
  const funded = requesterPaid ? facts.requesterName : 'challenger'
  const pending = requesterPaid ? 'challenger' : facts.requesterName
  if (facts.currentRuling === SUBGRAPH_RULING.NONE)
    return { funded, pending, deadline: facts.appealEnd }
  // A decisive ruling: only the loser funding inside its half changes whose
  // clock runs. (The winner funding first leaves the loser's deadline as is;
  // in the second half the loser has funded by definition.)
  if (statusCode === STATUS_CODE.CROWDFUNDING && funded === facts.loserName)
    return { funded, pending: facts.winnerName, deadline: facts.appealEnd }
  return undefined
}

/** The hero's clock, with the appeal ring pointed at the side that still has to fund. */
export const ClassicWindowPanel = ({
  item,
  request,
  statusCode,
  facts,
  now,
}: {
  item: SubgraphItem
  request: LightRequest
  statusCode: number
  facts: RequestFacts
  now: number
}) => {
  const funding = appealFunding(request, facts, statusCode)
  if (!funding)
    return (
      <WindowPanel
        item={item}
        request={request}
        statusCode={statusCode}
        facts={facts}
        now={now}
      />
    )

  const { appealStart, appealEnd, appealHalf, loserName, winnerName } = facts
  const decisive = facts.currentRuling !== SUBGRAPH_RULING.NONE
  return (
    <WindowRing
      title="Appeal period"
      start={appealStart}
      end={appealEnd}
      deadline={funding.deadline}
      now={now}
      tone="contested"
      verb={`left for the ${funding.pending} to fund`}
      ends={
        decisive
          ? [
              {
                label: `${capitalize(loserName)} funded by`,
                at: appealHalf,
                marker: true,
              },
              { label: `${capitalize(winnerName)} funds by`, at: appealEnd },
            ]
          : [
              { label: 'Opened', at: appealStart },
              {
                label: `${capitalize(funding.pending)} funds by`,
                at: appealEnd,
              },
            ]
      }
    />
  )
}
