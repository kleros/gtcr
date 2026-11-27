import React from 'react'
import { SUBGRAPH_RULING } from 'utils/item-status'
import { WindowRing } from 'components/curate/item-standard-window-ring'
import { WindowPanel } from 'pages/standard-item-details/item-window'
import {
  appealFunding,
  capitalize,
  type StandardRequest,
  type RequestFacts,
} from 'pages/standard-item-details/request-facts'

// Who still has to fund lives with the request's other facts, so a module
// without React (party-notice.ts) reads it too; kept importable from here.
export {
  appealFunding,
  type AppealFunding,
} from 'pages/standard-item-details/request-facts'

/**
 * The hero's clock for Standard entries, with the appeal ring
 * pointed at the side that still has to fund.
 */
export const AppealWindowPanel = ({
  item,
  request,
  statusCode,
  facts,
  now,
}: {
  item: SubgraphItem
  request: StandardRequest
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
