import React from 'react'
import styled, { css } from 'styled-components'
import { Label, Small, Surface } from 'components/curate/primitives'
import useDisputeTimeline from 'hooks/use-dispute-timeline'
import useCourtName from 'hooks/use-court-name'
import { formatAbsolute, formatDuration, windowProgress } from 'utils/time'
import {
  expectedRuling,
  timelineSteps,
  type TimelineStep,
} from './dispute-timeline-model'

/*
 * Dispute timeline (rail card on Standard and Stake entry pages): where a
 * Kleros Court case stands and how long it should take. Each period of the
 * current round with its length; the current one with its deadline, the
 * time left and a progress line; later ones with dates estimated from that
 * deadline; then the ruling, expected when the appeal period ends if nobody
 * appeals. Read from the arbitrator itself (use-dispute-timeline.ts), so it
 * shows the live round. Renders nothing while loading, for an arbitrator
 * other than Kleros, or if the read fails: the court case stays one click
 * away in the hero and the status card.
 */

const Card = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const Steps = styled.ol`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Step = styled.li<{ $state: TimelineStep['state'] }>`
  position: relative;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 0 12px;
  padding-bottom: 14px;

  &:last-child {
    padding-bottom: 0;
  }

  /* The rail between dots: solid behind what is done, dashed ahead. */
  &:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 16px;
    bottom: 0;
    left: 6px;
    width: 0;
    border-left: 2px
      ${({ $state }) =>
        $state === 'done'
          ? 'solid var(--status-contested)'
          : 'dashed var(--color-border-strong)'};
    opacity: ${({ $state }) => ($state === 'done' ? 0.55 : 1)};
  }
`

const Dot = styled.span<{ $state: TimelineStep['state'] }>`
  position: relative;
  z-index: 1;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  border-radius: 50%;
  box-sizing: border-box;

  ${({ $state }) =>
    $state === 'done'
      ? css`
          background: var(--status-contested);
          opacity: 0.55;
        `
      : $state === 'now'
        ? css`
            background: var(--color-surface);
            border: 3px solid var(--status-contested);
            box-shadow: 0 0 0 4px var(--status-contested-soft);
          `
        : css`
            background: var(--color-surface);
            border: 2px solid var(--color-border-strong);
          `}
`

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const TitleRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
`

const Title = styled.span<{ $state: TimelineStep['state'] }>`
  color: ${({ $state }) =>
    $state === 'done' ? 'var(--color-muted)' : 'var(--color-text)'};
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: ${({ $state }) => ($state === 'now' ? 600 : 500)};
`

const When = styled.span`
  flex: none;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Detail = styled(Small)`
  display: block;
`

const Progress = styled.span`
  display: block;
  height: 4px;
  margin: 6px 0 2px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  box-shadow: inset 0 0 0 1px var(--glass-border);

  > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--status-contested);
  }
`

const Note = styled.p`
  margin: 0;
  padding-top: 14px;
  border-top: 1px solid var(--glass-border);
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const shortFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  hour12: false,
})
const dayFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** "20 Nov, 14:30 UTC" */
const shortDate = (seconds: number) =>
  `${shortFormatter.format(new Date(seconds * 1000))} UTC`
/** "~20 Nov": an estimate never claims the minute. */
const aroundDay = (seconds: number) =>
  `~${dayFormatter.format(new Date(seconds * 1000))}`

/*
 * How the court's length bounds the current period: commit and vote close
 * early once every juror has acted, a first-round evidence period also
 * waits for every juror to be drawn, and the appeal period is exact.
 */
const lengthWord = (step: TimelineStep): string =>
  step.estimated
    ? 'about '
    : step.key === 'commit' || step.key === 'vote'
      ? 'up to '
      : step.key === 'evidence'
        ? 'at least '
        : ''

const StepRow = ({ step, now }: { step: TimelineStep; now: number }) => {
  const length = step.duration ? formatDuration(step.duration) : undefined
  let when: React.ReactNode = null
  if (step.state === 'done') when = 'Done'
  else if (step.state === 'next')
    when =
      step.start !== undefined ? (
        <span title={`Estimated: ${formatAbsolute(step.start)}`}>
          {length
            ? `${length} · from ${aroundDay(step.start)}`
            : aroundDay(step.start)}
        </span>
      ) : (
        length
      )
  else if (step.end !== undefined)
    when = now < step.end ? `${formatDuration(step.end - now)} left` : 'Over'

  return (
    <Step
      $state={step.state}
      aria-current={step.state === 'now' ? 'step' : undefined}
    >
      <Dot $state={step.state} aria-hidden />
      <Body>
        <TitleRow>
          <Title $state={step.state}>{step.title}</Title>
          {when && <When>{when}</When>}
        </TitleRow>
        {step.state === 'now' && step.end !== undefined && (
          <>
            <Progress aria-hidden>
              <span
                style={{
                  width: `${Math.round(windowProgress(step.start ?? now, step.end, now) * 100)}%`,
                }}
              />
            </Progress>
            <Detail $muted title={formatAbsolute(step.end)}>
              {step.estimated
                ? 'Around '
                : step.key === 'evidence'
                  ? 'Can end from '
                  : 'Ends by '}
              {shortDate(step.end)}
              {length ? ` · lasts ${lengthWord(step)}${length}` : ''}
            </Detail>
          </>
        )}
        {step.state !== 'done' && <Detail $faint>{step.detail}</Detail>}
        {step.state === 'now' && (step.overdue ?? step.early) && (
          <Detail $faint>{step.overdue ?? step.early}</Detail>
        )}
      </Body>
    </Step>
  )
}

const DisputeTimeline = ({
  chainId,
  arbitrator,
  arbitrable,
  disputeID,
  now,
}: {
  chainId?: number | null
  arbitrator?: string | null
  /** The list's contract: a case raised by another contract is not shown. */
  arbitrable?: string | null
  /** The case number; the card shows only while the case is open. */
  disputeID?: string | null
  now: number
}) => {
  const { data: dispute } = useDisputeTimeline({
    chainId,
    arbitrator,
    arbitrable,
    disputeID,
  })
  // Hooks run before the early return; the name needs the court's number.
  const courtName = useCourtName(chainId, dispute?.court)
  if (!dispute) return null

  const steps = timelineSteps(dispute, now)
  const expected = expectedRuling(steps)

  return (
    <Card as="section" aria-label="Dispute timeline">
      <Head>
        <Label $tone="faint">Dispute timeline</Label>
        <Small $muted>
          Case {dispute.disputeID}
          {courtName ? ` · ${courtName}` : ''} · round {dispute.round} ·{' '}
          {dispute.jurors} juror
          {dispute.jurors === 1 ? '' : 's'}
        </Small>
      </Head>
      <Steps>
        {steps.map((step) => (
          <StepRow key={step.key} step={step} now={now} />
        ))}
      </Steps>
      {expected !== undefined && (
        <Note>
          Dates after the current period are estimates: each period moves on
          when the court updates it.
        </Note>
      )}
    </Card>
  )
}

export default DisputeTimeline
