import React from 'react'
import styled from 'styled-components'
import { useParams } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDisputeTimeline from 'hooks/use-dispute-timeline'
import {
  CONTRACT_STATUS,
  STATUS_CODE,
  SUBGRAPH_RULING,
} from 'utils/item-status'
import { formatAbsolute, formatDate } from 'utils/time'
import { formatSince } from 'utils/format-since'
import { Label } from 'components/curate/primitives'
import { WindowRing } from 'components/curate/item-standard-window-ring'
import {
  COURT_PERIOD,
  currentPeriod,
} from 'components/curate/dispute-timeline-model'
import { toSeconds } from 'components/curate/item-standard-format'
import {
  capitalize,
  fundedAlone,
  type StandardRequest,
  type RequestFacts,
} from './request-facts'

/*
 * The right side of the item hero: the page's one clock, whichever window
 * is running. The same ring in every state — the challenge window, the
 * appeal period, and (since the design review) the court period the case is
 * in, read from the arbitrator — then a calm block for a period with no
 * deadline to show and for a settled entry. One clock, one slot, one
 * vocabulary; the case's own state, its periods and its jury belong to the
 * case panel below the hero.
 */

/* Top-aligned at its own height, so its label lines up with the hero's
   eyebrow beside it. It used to be centred in a forced 220px, which left
   the date floating half-way down the column (round 5). */
const Calm = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10px;
`

/* A settled entry's date: a plain figure, a size above the body (round 9:
   at display size it was "too mammoth" for a date nobody acts on). */
const Big = styled.span`
  display: block;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 24px;
  line-height: 30px;
  font-weight: 500;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

/** A state, not a figure: the words the court uses for where it stands. */
const State = styled.span`
  display: block;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(24px, 1vw + 16px, 30px);
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.03em;
  text-wrap: balance;
`

const Line = styled.p`
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const rulingLine = (ruling: string | null, requesterName: string) =>
  ruling === SUBGRAPH_RULING.ACCEPT
    ? `Jurors ruled for the ${requesterName}`
    : ruling === SUBGRAPH_RULING.REJECT
      ? 'Jurors ruled for the challenger'
      : 'Jurors refused to rule'

// The same relative form as the hero beside it and the other item pages.
const sinceLine = formatSince

export const WindowPanel = ({
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
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const chainId = useUrlChainId()
  // The court's own period, for the clock while jurors are at work. The
  // case panel reads the same query, so the two never disagree.
  const { data: dispute } = useDisputeTimeline({
    chainId,
    arbitrator: request.arbitrator,
    arbitrable: tcrAddress,
    disputeID: facts.disputeID,
    enabled: facts.inCourt,
  })
  const {
    requesterName,
    loserName,
    winnerName,
    currentRuling,
    submissionTime,
    windowEnd,
    appealStart,
    appealEnd,
    appealHalf,
  } = facts

  if (facts.inWindow || facts.isPending)
    return (
      <WindowRing
        title="Challenge period"
        start={submissionTime}
        end={windowEnd}
        now={now}
        tone="window"
        verb="left to challenge"
        passedLabel="Closed"
        ends={[
          { label: 'Opened', at: submissionTime },
          { label: now > windowEnd ? 'Closed' : 'Closes', at: windowEnd },
        ]}
      />
    )

  if (facts.appealable) {
    if (currentRuling === SUBGRAPH_RULING.NONE)
      return (
        <WindowRing
          title="Appeal period"
          start={appealStart}
          end={appealEnd}
          now={now}
          tone="contested"
          verb="left to fund an appeal"
        />
      )
    const firstHalf = statusCode === STATUS_CODE.CROWDFUNDING
    return (
      <WindowRing
        title="Appeal period"
        start={appealStart}
        end={appealEnd}
        deadline={firstHalf ? appealHalf : appealEnd}
        now={now}
        tone="contested"
        verb={`left for the ${firstHalf ? loserName : winnerName} to fund`}
        ends={[
          {
            label: firstHalf
              ? `${capitalize(loserName)} funds by`
              : `${capitalize(loserName)} funded by`,
            at: appealHalf,
            marker: true,
          },
          { label: `${capitalize(winnerName)} funds by`, at: appealEnd },
        ]}
      />
    )
  }

  if (facts.inCourt) {
    const challenged = statusCode === STATUS_CODE.CHALLENGED
    const period = dispute ? currentPeriod(dispute) : undefined
    // The clock follows the court only while the entry waits for the
    // jurors: once this request has its ruling, the court's own appeal
    // period can still be running, which is no longer what is happening
    // here (the loser did not fund in its half, so the ruling stands). A
    // period with a deadline is the clock; an appeal round's evidence
    // period that can move on now has none, and neither has execution.
    if (
      challenged &&
      dispute &&
      period?.end !== undefined &&
      dispute.period < COURT_PERIOD.EXECUTION
    )
      return (
        <WindowRing
          title={period.measure}
          start={period.start}
          end={period.end}
          now={now}
          tone="contested"
          verb={period.verb}
          passedLabel="Over"
          noun="period"
          ends={[
            { label: 'Started', at: period.start },
            {
              label: now > period.end ? 'Over' : period.closeLabel,
              at: period.end,
            },
          ]}
        />
      )

    const aloneWinner =
      statusCode === STATUS_CODE.WAITING_ARBITRATOR
        ? fundedAlone(request, requesterName)
        : undefined
    // The period over: final. Earlier, the loser's half over with nothing
    // funded: the ruling stands.
    const state = challenged
      ? 'Jurors deciding'
      : statusCode === STATUS_CODE.WAITING_ARBITRATOR
        ? 'Ruling final'
        : 'Ruling stands'
    return (
      <Calm>
        <Label $tone="faint">In court</Label>
        <State>{(challenged ? period?.title : undefined) ?? state}</State>
        {challenged ? (
          // The evidence period has no line (round 3 deleted "N jurors
          // drawn. Both sides add evidence…"): its title says it all.
          period?.next && <Line>{period.next}</Line>
        ) : (
          <Line>
            {rulingLine(currentRuling, requesterName)}
            {statusCode === STATUS_CODE.WAITING_ARBITRATOR ? (
              aloneWinner ? (
                // rule() gives the ruling to the only side that paid.
                ` · the ${aloneWinner} funded the appeal alone and wins`
              ) : (
                <>
                  {' · '}
                  <span title={formatAbsolute(appealEnd)}>
                    appeal closed {formatDate(appealEnd)}
                  </span>
                </>
              )
            ) : (
              ' · not appealed'
            )}
          </Line>
        )}
      </Calm>
    )
  }

  // Settled: registered, rejected or removed.
  const requests = (item.requests ?? []) as StandardRequest[]
  const registered = statusCode === STATUS_CODE.REGISTERED
  const deciding = registered
    ? (requests.find(
        (r) =>
          r.resolved &&
          r.requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED,
      ) ?? request)
    : request
  const since = toSeconds(deciding?.resolutionTime)
  // Case 0 is a real case: the arbitrator numbers its first dispute 0.
  const decidedInCourt = !!deciding?.disputed
  const title = registered
    ? 'Registered since'
    : statusCode === STATUS_CODE.REMOVED
      ? 'Removed on'
      : 'Rejected on'

  return (
    <Calm>
      <Label $tone="faint">{title}</Label>
      <Big title={since ? formatAbsolute(since) : undefined}>
        {since ? formatDate(since) : '—'}
      </Big>
      <Line>
        {since ? `${sinceLine(since, now)} · ` : ''}
        {/* The case itself is named once, in the court record under the
            hero, which every decided case is in. */}
        {decidedInCourt
          ? 'decided by jurors'
          : registered
            ? 'accepted with no challenge'
            : 'executed with no challenge'}
      </Line>
    </Calm>
  )
}

export default WindowPanel
