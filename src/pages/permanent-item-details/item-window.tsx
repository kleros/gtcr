import React, { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { STATUS_CODE } from 'utils/permanent-item-status'
import { formatAbsolute, formatDate } from 'utils/time'
import { CurateIcon } from 'components/curate/icons'
import { Chip, Label } from 'components/curate/primitives'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { WindowRing } from 'components/curate/item-light-window-ring'
import { formatSince } from 'pages/item-details/format-since'
import {
  capitalize,
  otherSide,
  rulingLine,
  toNum,
  type StakeFacts,
  type StakeItem,
} from './facts'

/*
 * The right side of the Stake item hero: whatever clock is running. A ring
 * for the submission (or reinclusion) period, the withdrawal period or the
 * appeal period; while jurors decide, the evidence on this submission (how
 * much, from which side, and when it was filed); a calm date once nothing
 * runs (accepted, ready to execute, off the list). Every figure comes from
 * the item, its list and the clock.
 */

const Calm = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  height: 100%;
  min-height: 220px;

  @media (max-width: 1000px) {
    min-height: 0;
  }
`

const Big = styled.span`
  display: block;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(32px, 1.6vw + 18px, 44px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Line = styled.p`
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/* The court case in a calm line, as a link to it. */
const CaseLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
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
  margin: 10px 0 0;
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

const SIDE_COLOR = {
  submitter: 'var(--status-window)',
  challenger: 'var(--status-contested)',
  others: 'var(--color-faint)',
} as const

type Side = keyof typeof SIDE_COLOR

const SIDE_LABEL: Record<Side, string> = {
  submitter: 'Submitter',
  challenger: 'Challenger',
  others: 'Others',
}

/**
 * While jurors decide: the evidence on this submission, led by its count,
 * split by who filed it, and placed on a time axis from the submission to now.
 */
const CourtEvidence = ({
  item,
  facts,
  now,
}: {
  item: StakeItem
  facts: StakeFacts
  now: number
}) => {
  const start = facts.submissionStart
  const evidences = (item.evidences ?? []).filter(
    (evidence) => toNum(evidence.timestamp) >= start,
  )
  // Grow the split bar from nothing on the first frame.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const submitter = item.submitter?.toLowerCase()
  const challenger = facts.challenge?.challenger?.toLowerCase()
  const sideOf = (party?: string): Side => {
    const address = party?.toLowerCase()
    if (address && address === submitter) return 'submitter'
    if (address && address === challenger) return 'challenger'
    return 'others'
  }
  const counts: Record<Side, number> = {
    submitter: 0,
    challenger: 0,
    others: 0,
  }
  for (const evidence of evidences) counts[sideOf(evidence.party)] += 1
  const sides = (['submitter', 'challenger', 'others'] as Side[])
    .map((key) => ({ key, label: SIDE_LABEL[key], value: counts[key] }))
    .filter((side) => side.value > 0)

  const span = Math.max(1, now - start)
  const dated = evidences
    .map((evidence) => ({
      side: sideOf(evidence.party),
      at: toNum(evidence.timestamp),
    }))
    .filter((evidence) => evidence.at > 0)
    .sort((a, b) => a.at - b.at)
  const last = dated.length > 0 ? dated[dated.length - 1].at : undefined
  // Place each dot; one that would overlap a neighbour stacks above it.
  const LANES = 7
  const placed: { x: number; lane: number }[] = []
  for (const evidence of dated) {
    const x = Math.min(100, Math.max(0, ((evidence.at - start) / span) * 100))
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
            ? 'no evidence filed on this submission yet'
            : `${evidences.length === 1 ? 'piece' : 'pieces'} of evidence on this submission`}
          {last ? (
            <>
              <br />
              <span title={formatAbsolute(last)}>
                last filed {formatSince(last, now)}
              </span>
            </>
          ) : null}
        </LeadCaption>
      </Lead>
      {sides.length > 0 && (
        <div
          role="img"
          aria-label={`Evidence on this submission by who filed it: ${sides
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
          <Legend aria-hidden>
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
            start,
          )} to now: first ${formatAbsolute(dated[0].at)}, last ${formatAbsolute(
            dated[dated.length - 1].at,
          )}`}
        >
          <Label $tone="faint">Filed over time</Label>
          <Axis aria-hidden style={{ height: 12 + lanes * 9 }}>
            {dated.map((evidence, index) => (
              <i
                key={`${evidence.at}-${index}`}
                title={`${SIDE_LABEL[evidence.side]} · ${formatAbsolute(evidence.at)}`}
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
            <span title={formatAbsolute(start)}>{formatDate(start)}</span>
            <span>Now</span>
          </AxisEnds>
        </Strip>
      )}
    </>
  )
}

export const StakeWindowPanel = ({
  item,
  facts,
  statusCode,
  now,
}: {
  item: StakeItem
  facts: StakeFacts
  statusCode: number
  now: number
}) => {
  const {
    includedAt,
    acceptedAt,
    period,
    reincluded,
    withdrawingAt,
    withdrawReadyAt,
    appealStart,
    appealEnd,
    appealHalf,
    refusedToRule,
    fundedSide,
    loserName,
    winnerName,
    challenge,
    round,
  } = facts

  if (statusCode === STATUS_CODE.PENDING)
    return (
      <WindowRing
        title={reincluded ? 'Reinclusion period' : 'Submission period'}
        start={includedAt}
        end={acceptedAt}
        now={now}
        tone="window"
        verb="left until accepted"
        passedLabel="Accepted"
        ends={[
          { label: reincluded ? 'Reincluded' : 'Submitted', at: includedAt },
          {
            label: now > acceptedAt ? 'Accepted' : 'Accepted at',
            at: acceptedAt,
          },
        ]}
      />
    )

  if (statusCode === STATUS_CODE.ACCEPTED && facts.isWithdrawing)
    return (
      <WindowRing
        title="Withdrawal period"
        start={withdrawingAt}
        end={withdrawReadyAt}
        now={now}
        tone="window"
        verb="until it can be executed"
        passedLabel="Ready"
        ends={[
          { label: 'Started', at: withdrawingAt },
          { label: 'Executable from', at: withdrawReadyAt },
        ]}
      />
    )

  if (facts.appealable) {
    if (refusedToRule)
      return (
        <WindowRing
          title="Appeal period"
          start={appealStart}
          end={appealEnd}
          now={now}
          tone="contested"
          verb={
            fundedSide
              ? `left for the ${otherSide(fundedSide)} to fund`
              : 'left to fund an appeal'
          }
        />
      )
    // Once the loser is fully funded the winner's clock runs, even before
    // the half.
    const firstHalf =
      statusCode === STATUS_CODE.CROWDFUNDING && fundedSide !== loserName
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
    const deciding = statusCode === STATUS_CODE.DISPUTED
    const ruling = rulingLine(round?.ruling)
    return (
      <Court>
        <CourtTop>
          <Label $tone="muted">
            {deciding ? 'Jurors deciding' : 'Awaiting the final ruling'}
          </Label>
          {facts.disputeID &&
            (facts.courtHref ? (
              <CaseChip
                as="a"
                href={facts.courtHref}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open case ${facts.disputeID}${facts.courtHost ? ` on ${facts.courtHost}` : ''}`}
              >
                Case {facts.disputeID}
                <CurateIcon name="external" size={12} />
              </CaseChip>
            ) : (
              <CaseChip>Case {facts.disputeID}</CaseChip>
            ))}
        </CourtTop>
        <CourtEvidence item={item} facts={facts} now={now} />
        <Line>
          {deciding
            ? 'Jurors are deciding. Anyone can add evidence until the dispute is resolved.'
            : now < appealEnd
              ? refusedToRule
                ? `${ruling}. Either side can fund an appeal until ${formatAbsolute(appealEnd)}.`
                : `${ruling}. The ${loserName} did not fund the appeal; the ruling stands from ${formatAbsolute(appealEnd)}.`
              : fundedSide
                ? `${ruling}. The ${fundedSide} funded the appeal alone, so the ${fundedSide} wins when the ruling is enforced.`
                : `${ruling}. The appeal period ended ${formatAbsolute(appealEnd)}; the ruling waits to be enforced.`}
        </Line>
      </Court>
    )
  }

  // Nothing runs: accepted, ready to execute, or off the list.
  const caseRef =
    facts.hasDispute && facts.disputeID ? (
      facts.courtHref ? (
        <CaseLink
          href={facts.courtHref}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open case ${facts.disputeID}${facts.courtHost ? ` on ${facts.courtHost}` : ''}`}
        >
          case {facts.disputeID}
          <CurateIcon name="external" size={11} />
        </CaseLink>
      ) : (
        <>case {facts.disputeID}</>
      )
    ) : null
  let title: string
  let since = 0
  let line: React.ReactNode
  switch (statusCode) {
    case STATUS_CODE.PENDING_WITHDRAWAL:
      title = 'Executable since'
      since = withdrawReadyAt
      line = 'anyone can execute the withdrawal'
      break
    case STATUS_CODE.WITHDRAWN:
      title = 'Withdrawn on'
      since = facts.endedAt
      line = 'withdrawn by the submitter, stake and deposit returned'
      break
    case STATUS_CODE.REMOVED:
    case STATUS_CODE.REJECTED: {
      title = statusCode === STATUS_CODE.REMOVED ? 'Removed on' : 'Rejected on'
      since = toNum(challenge?.resolutionTime) || facts.endedAt
      const verb = statusCode === STATUS_CODE.REMOVED ? 'removed' : 'rejected'
      const outcome = challenge?.disputeOutcome
      line = caseRef ? (
        outcome === 'None' ? (
          <>jurors refused to rule in {caseRef}</>
        ) : outcome ? (
          <>
            {verb} by jurors in {caseRef}
          </>
        ) : (
          <>
            {verb} after {caseRef}
          </>
        )
      ) : (
        'off the list'
      )
      break
    }
    default: {
      // Accepted.
      title = period > 0 ? 'Accepted since' : 'Listed since'
      since = acceptedAt
      const kept =
        reincluded && challenge?.disputeOutcome === 'Accept' && facts.hasDispute
      line =
        kept && caseRef ? (
          <>kept by jurors in {caseRef}</>
        ) : reincluded ? (
          'reincluded after a ruling'
        ) : period > 0 ? (
          'accepted with no challenge'
        ) : (
          'this list accepts entries at once'
        )
    }
  }

  return (
    <Calm>
      <Label $tone="faint">{title}</Label>
      <Big title={since ? formatAbsolute(since) : undefined}>
        {since ? formatDate(since) : '—'}
      </Big>
      <Line>
        {since ? `${formatSince(since, now)} · ` : ''}
        {line}
      </Line>
    </Calm>
  )
}

export default StakeWindowPanel
