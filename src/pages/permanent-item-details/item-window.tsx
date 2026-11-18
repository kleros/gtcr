import React from 'react'
import styled from 'styled-components'
import { useParams } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDisputeTimeline from 'hooks/use-dispute-timeline'
import { STATUS_CODE } from 'utils/permanent-item-status'
import { formatAbsolute, formatDate } from 'utils/time'
import { CurateIcon } from 'components/curate/icons'
import { Label } from 'components/curate/primitives'
import { WindowRing } from 'components/curate/item-standard-window-ring'
import {
  COURT_PERIOD,
  currentPeriod,
} from 'components/curate/dispute-timeline-model'
import { formatSince } from 'utils/format-since'
import {
  capitalize,
  otherSide,
  rulingLine,
  toNum,
  type StakeFacts,
} from './facts'

/*
 * The right side of the Stake item hero: the page's one clock, whichever
 * window is running. The same ring in every state — the submission (or
 * reinclusion) period, the withdrawal period, the appeal period and (since
 * the design review) the court period the case is in, read from the
 * arbitrator — then a calm block for a period with no deadline to show and
 * for an entry where nothing runs (accepted, ready to execute, off the
 * list). One clock, one slot, the same vocabulary as the Standard entry
 * page; the case's own state, its periods and its jury belong to the case
 * panel below the hero.
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

export const StakeWindowPanel = ({
  facts,
  statusCode,
  arbitrator,
  now,
}: {
  facts: StakeFacts
  statusCode: number
  /** The list's arbitrator: only a Kleros one has periods to read. */
  arbitrator?: string
  now: number
}) => {
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const chainId = useUrlChainId()
  // The court's own period, for the clock while jurors are at work. The
  // case panel reads the same query, so the two never disagree.
  const { data: dispute } = useDisputeTimeline({
    chainId,
    arbitrator,
    arbitrable: tcrAddress,
    disputeID: facts.disputeID,
    enabled: facts.inCourt,
  })
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
        title="Withdrawing period"
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
    const current = dispute ? currentPeriod(dispute) : undefined
    // The clock follows the court only while the entry waits for the
    // jurors: once the jurors have ruled, the court's own appeal period can
    // still be running, which is no longer what is happening here (the
    // loser did not fund in its half, so the ruling stands). A period with
    // a deadline is the clock; an appeal round's evidence period that can
    // move on now has none, and neither has execution.
    if (
      deciding &&
      dispute &&
      current?.end !== undefined &&
      dispute.period < COURT_PERIOD.EXECUTION
    )
      return (
        <WindowRing
          title={current.measure}
          start={current.start}
          end={current.end}
          now={now}
          tone="contested"
          verb={current.verb}
          passedLabel="Over"
          noun="period"
          ends={[
            { label: 'Started', at: current.start },
            {
              label: now > current.end ? 'Over' : current.closeLabel,
              at: current.end,
            },
          ]}
        />
      )

    // Past the ruling nothing changes any more: the loser did not fund in
    // its half (the ruling stands), or the appeal period is over (the
    // ruling is final and waits to be enforced).
    const state = deciding
      ? 'Jurors deciding'
      : now < appealEnd
        ? 'Ruling stands'
        : 'Ruling final'
    return (
      <Calm>
        <Label $tone="faint">In court</Label>
        <State>{(deciding ? current?.title : undefined) ?? state}</State>
        {deciding ? (
          current && <Line>{current.next}</Line>
        ) : (
          <Line>
            {rulingLine(round?.ruling)}
            {now < appealEnd ? (
              ` · the ${loserName} did not fund an appeal`
            ) : fundedSide ? (
              // rule() gives the ruling to the only side that paid.
              ` · the ${fundedSide} funded the appeal alone and wins`
            ) : (
              <>
                {' · '}
                <span title={formatAbsolute(appealEnd)}>
                  appeal closed {formatDate(appealEnd)}
                </span>
              </>
            )}
          </Line>
        )}
      </Calm>
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
      // A ruling that keeps an entry with a pending withdrawal completes the
      // withdrawal in the same transaction.
      line =
        caseRef &&
        challenge?.disputeOutcome === 'Accept' &&
        !!challenge.resolutionTx &&
        challenge.resolutionTx === facts.submission?.finishedTx ? (
          <>
            kept by jurors in {caseRef}, then withdrawn as the submitter had
            asked
          </>
        ) : (
          'withdrawn by the submitter, stake and deposit returned'
        )
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
