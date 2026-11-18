import React from 'react'
import styled, { css } from 'styled-components'
import { Label, Small } from 'components/curate/primitives'
import { formatAbsolute, formatDuration, windowProgress } from 'utils/time'
import {
  expectedRuling,
  timelineSteps,
  type CourtDispute,
  type TimelineStep,
} from './dispute-timeline-model'

/*
 * The periods of the current round, laid out in time: a band, not a panel
 * (DESIGN.md: no panel inside a panel — space and a hairline separate it
 * from its neighbours). Each period with its length, the current one with
 * its deadline, the time left and a progress line, later ones with dates
 * estimated from that deadline, then the ruling. Horizontal on a wide
 * screen, so the spine reads as a timeline; stacked on a phone.
 *
 * The wording is the honest one: commit and vote close early once every
 * juror has acted, a first round's evidence period lasts *at least* its
 * length, and an estimate never claims the minute.
 */

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
`

/* Stacked: one period per row, the rail running down between the dots. */
const stackedSpine = css`
  grid-auto-flow: row;
  grid-auto-columns: auto;
  gap: 0;
`

const stackedStep = (state: TimelineStep['state']) => css`
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 0 12px;
  padding-bottom: 14px;

  &:last-child {
    padding-bottom: 0;
  }

  &:not(:last-child)::before {
    top: 16px;
    right: auto;
    bottom: 0;
    left: 6px;
    width: 0;
    height: auto;
    border-top: 0;
    border-left: 2px
      ${state === 'done'
        ? 'solid var(--status-contested)'
        : 'dashed var(--color-border-strong)'};
  }

  > span:first-child {
    margin-top: 3px;
  }
`

const Spine = styled.ol<{ $stacked: boolean }>`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 0 18px;
  margin: 0;
  padding: 0;
  list-style: none;

  ${({ $stacked }) => $stacked && stackedSpine}

  @media (max-width: 760px) {
    ${stackedSpine}
  }
`

const Step = styled.li<{ $state: TimelineStep['state']; $stacked: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;

  /* The rail between dots: solid behind what is done, dashed ahead. */
  &:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 6px;
    left: 22px;
    right: -18px;
    height: 0;
    border-top: 2px
      ${({ $state }) =>
        $state === 'done'
          ? 'solid var(--status-contested)'
          : 'dashed var(--color-border-strong)'};
    opacity: ${({ $state }) => ($state === 'done' ? 0.55 : 1)};
  }

  ${({ $stacked, $state }) => $stacked && stackedStep($state)}

  @media (max-width: 760px) {
    ${({ $state }) => stackedStep($state)}
  }
`

const Dot = styled.span<{ $state: TimelineStep['state'] }>`
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
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
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
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

const StepRow = ({
  step,
  now,
  stacked,
}: {
  step: TimelineStep
  now: number
  stacked: boolean
}) => {
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
      $stacked={stacked}
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

const Band = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

/** The current round's periods, in order, with the live one marked. */
export const DisputePeriodSteps = ({
  dispute,
  now,
  /** A narrow column (the rail card) stacks whatever the window's width. */
  stacked = false,
}: {
  dispute: CourtDispute
  now: number
  stacked?: boolean
}) => {
  const steps = timelineSteps(dispute, now)
  const expected = expectedRuling(steps)

  return (
    <Band aria-label={`Round ${dispute.round} periods`}>
      <Head>
        <Label $tone="faint">
          Round {dispute.round} · {dispute.jurors} juror
          {dispute.jurors === 1 ? '' : 's'}
        </Label>
        {expected !== undefined && (
          <Note>
            Dates after the current period are estimates: each period moves on
            when the court updates it.
          </Note>
        )}
      </Head>
      <Spine $stacked={stacked}>
        {steps.map((step) => (
          <StepRow key={step.key} step={step} now={now} stacked={stacked} />
        ))}
      </Spine>
    </Band>
  )
}

export default DisputePeriodSteps
