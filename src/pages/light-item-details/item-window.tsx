import React, { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import {
  CONTRACT_STATUS,
  STATUS_CODE,
  SUBGRAPH_RULING,
} from 'utils/item-status'
import { formatAbsolute, formatAgo, formatDate } from 'utils/time'
import { formatSince } from 'pages/item-details/format-since'
import { CurateIcon } from 'components/curate/icons'
import { Chip, Label } from 'components/curate/primitives'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { WindowRing } from 'components/curate/item-light-window-ring'
import { toSeconds } from 'components/curate/item-light-format'
import {
  capitalize,
  type LightRequest,
  type RequestFacts,
} from './request-facts'

/*
 * The right side of the item hero: whatever clock is running. A ring for
 * the challenge window or the appeal period; while jurors decide, the
 * evidence on the request (how much, from which side, and when it was
 * filed); a calm date once the entry is settled. Every figure comes from
 * the latest request and the clock.
 */

const Calm = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  height: 100%;
  min-height: 220px;
`

const Big = styled.span`
  display: block;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(36px, 2vw + 20px, 48px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
`

const Line = styled.p`
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Court = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 220px;
`

const CourtTop = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
`

const CaseChip = styled(Chip)`
  color: var(--color-text);
  text-decoration: none;
  font-variant-numeric: tabular-nums;
  transition:
    border-color var(--motion),
    color var(--motion);

  &[href]:hover {
    border-color: var(--color-border-strong);
    color: var(--color-primary);
  }
`

const Lead = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 12px;
`

const LeadCaption = styled.span`
  padding-bottom: 2px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const LeadFigure = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 56px;
  line-height: 0.9;
  font-weight: 500;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;
`

const Bar = styled.div`
  display: flex;
  gap: 3px;
  height: 10px;

  span {
    min-width: 6px;
    border-radius: var(--radius-pill);
    transition: flex-grow 900ms var(--ease-out);
  }

  @media (prefers-reduced-motion: reduce) {
    span {
      transition: none;
    }
  }
`

const Legend = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
  }

  i {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
  }

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

const dotIn = keyframes`
  from { opacity: 0; transform: translateX(-50%) scale(0.4); }
`

/* Evidence over time: one dot per piece, placed by when it was filed;
   pieces filed close together stack, so bursts read as columns. */
const Strip = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--glass-border);
`

const Axis = styled.div`
  position: relative;
  margin: 0 5px;

  &::before {
    content: '';
    position: absolute;
    inset: auto 0 4px;
    height: 2px;
    border-radius: var(--radius-pill);
    background: var(--color-raised);
    box-shadow: inset 0 0 0 1px var(--glass-border);
  }

  i {
    position: absolute;
    width: 10px;
    height: 10px;
    border: 2px solid var(--color-surface);
    border-radius: var(--radius-pill);
    transform: translateX(-50%);
    animation: ${dotIn} 420ms var(--ease-out) both;
    animation-delay: calc(300ms + var(--i, 0) * 40ms);
  }

  @media (prefers-reduced-motion: reduce) {
    i {
      animation: none;
    }
  }
`

const AxisEnds = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
`

interface EvidenceRecord {
  party?: string
  timestamp?: string | number
}

const SIDE_COLOR = {
  requester: 'var(--status-window)',
  challenger: 'var(--status-contested)',
  others: 'var(--color-faint)',
} as const

/**
 * While jurors decide: the evidence on this request, led by its count, split
 * by who filed it, and placed on a time axis from the request to now.
 */
const CourtEvidence = ({
  request,
  requesterName,
  submissionTime,
  now,
}: {
  request: LightRequest
  requesterName: string
  submissionTime: number
  now: number
}) => {
  const evidences = (request.evidenceGroup?.evidences ?? []) as EvidenceRecord[]
  // Grow the split bar from nothing on the first frame.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const requester = request.requester?.toLowerCase()
  const challenger = request.challenger?.toLowerCase()
  const sideOf = (party?: string): keyof typeof SIDE_COLOR => {
    const address = party?.toLowerCase()
    if (address && address === requester) return 'requester'
    if (address && address === challenger) return 'challenger'
    return 'others'
  }
  const counts = { requester: 0, challenger: 0, others: 0 }
  for (const evidence of evidences) counts[sideOf(evidence.party)] += 1
  const sides = [
    {
      key: 'requester' as const,
      label: capitalize(requesterName),
      value: counts.requester,
    },
    {
      key: 'challenger' as const,
      label: 'Challenger',
      value: counts.challenger,
    },
    { key: 'others' as const, label: 'Others', value: counts.others },
  ].filter((side) => side.value > 0)

  const span = Math.max(1, now - submissionTime)
  const dated = evidences
    .map((evidence) => ({
      side: sideOf(evidence.party),
      at: toSeconds(evidence.timestamp),
    }))
    .filter((evidence) => evidence.at > 0)
    .sort((a, b) => a.at - b.at)
  const last = dated.length > 0 ? dated[dated.length - 1].at : undefined
  // Place each dot; one that would overlap a neighbour stacks above it.
  const LANES = 7
  const placed: { x: number; lane: number }[] = []
  for (const evidence of dated) {
    const x = Math.min(
      100,
      Math.max(0, ((evidence.at - submissionTime) / span) * 100),
    )
    let lane = 0
    while (
      lane < LANES - 1 &&
      placed.some((dot) => dot.lane === lane && Math.abs(dot.x - x) < 4)
    )
      lane += 1
    placed.push({ x, lane })
  }
  const lanes = placed.reduce((most, dot) => Math.max(most, dot.lane + 1), 1)

  return (
    <>
      <Lead>
        <LeadFigure>
          <AnimatedNumber value={evidences.length} />
        </LeadFigure>
        <LeadCaption>
          {evidences.length === 0
            ? 'no evidence filed on this request yet'
            : `${evidences.length === 1 ? 'piece' : 'pieces'} of evidence on this request`}
          {last ? (
            <>
              <br />
              <span title={formatAbsolute(last)}>
                last filed {formatAgo(last, now)}
              </span>
            </>
          ) : null}
        </LeadCaption>
      </Lead>
      {sides.length > 0 && (
        <div
          role="img"
          aria-label={`Evidence on this request by who filed it: ${sides
            .map((side) => `${side.label} ${side.value}`)
            .join(', ')}`}
        >
          <Bar aria-hidden>
            {sides.map((side) => (
              <span
                key={side.key}
                style={{
                  flexGrow: shown ? side.value : 0.0001,
                  background: SIDE_COLOR[side.key],
                }}
              />
            ))}
          </Bar>
          <Legend aria-hidden style={{ marginTop: 10 }}>
            {sides.map((side) => (
              <li key={side.key}>
                <i style={{ background: SIDE_COLOR[side.key] }} />
                {side.label} <b>{side.value}</b>
              </li>
            ))}
          </Legend>
        </div>
      )}
      {dated.length > 0 && (
        <Strip
          role="img"
          aria-label={`Evidence filed over time, from ${formatDate(
            submissionTime,
          )} to now: first ${formatAbsolute(dated[0].at)}, last ${formatAbsolute(
            dated[dated.length - 1].at,
          )}`}
        >
          <Label $tone="faint">Filed over time</Label>
          <Axis aria-hidden style={{ height: 12 + lanes * 9 }}>
            {dated.map((evidence, index) => (
              <i
                key={`${evidence.at}-${index}`}
                title={`${
                  evidence.side === 'requester'
                    ? capitalize(requesterName)
                    : evidence.side === 'challenger'
                      ? 'Challenger'
                      : 'Others'
                } · ${formatAbsolute(evidence.at)}`}
                style={
                  {
                    left: `${placed[index].x}%`,
                    bottom: placed[index].lane * 9,
                    background: SIDE_COLOR[evidence.side],
                    '--i': index,
                  } as React.CSSProperties
                }
              />
            ))}
          </Axis>
          <AxisEnds aria-hidden>
            <span title={formatAbsolute(submissionTime)}>
              {formatDate(submissionTime)}
            </span>
            <span>Now</span>
          </AxisEnds>
        </Strip>
      )}
    </>
  )
}

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
  request: LightRequest
  statusCode: number
  facts: RequestFacts
  now: number
}) => {
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
    return (
      <Court>
        <CourtTop>
          <Label $tone="muted">
            {challenged
              ? 'Jurors deciding'
              : statusCode === STATUS_CODE.WAITING_ARBITRATOR
                ? 'Awaiting the final ruling'
                : 'Ruling final'}
          </Label>
          {facts.disputeID &&
            (facts.disputeHref ? (
              <CaseChip
                as="a"
                href={facts.disputeHref}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open case ${facts.disputeID} on ${facts.disputeHost}`}
              >
                Case {facts.disputeID}
                <CurateIcon name="external" size={12} />
              </CaseChip>
            ) : (
              <CaseChip>Case {facts.disputeID}</CaseChip>
            ))}
        </CourtTop>
        <CourtEvidence
          request={request}
          requesterName={requesterName}
          submissionTime={submissionTime}
          now={now}
        />
        {/* The hero states the fact; the action card asks for the action. */}
        {!challenged && (
          <Line>
            {rulingLine(currentRuling, requesterName)}
            {statusCode === STATUS_CODE.WAITING_ARBITRATOR ? (
              <>
                {' · '}
                <span title={formatAbsolute(appealEnd)}>
                  appeal closed {formatDate(appealEnd)}
                </span>
              </>
            ) : (
              ' · not appealed'
            )}
          </Line>
        )}
      </Court>
    )
  }

  // Settled: registered, rejected or removed.
  const requests = (item.requests ?? []) as LightRequest[]
  const registered = statusCode === STATUS_CODE.REGISTERED
  const deciding = registered
    ? (requests.find(
        (r) =>
          r.resolved &&
          r.requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED,
      ) ?? request)
    : request
  const since = toSeconds(deciding?.resolutionTime)
  const decidedInCourt =
    !!deciding?.disputed && Number(deciding.disputeID) !== 0
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
        {decidedInCourt
          ? `decided by jurors in case ${deciding.disputeID}`
          : registered
            ? 'accepted with no challenge'
            : 'executed with no challenge'}
      </Line>
    </Calm>
  )
}

export default WindowPanel
