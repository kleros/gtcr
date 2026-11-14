import React, { useRef } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Label, Surface } from 'components/curate/primitives'
import { useInView } from './hooks'

/*
 * The appeal-funding rule as a timeline, not a chart: each track is the appeal
 * period, from the ruling to its end, and the tinted part is when that side
 * may still be funded. A time cursor runs along the period once, and each
 * deadline lights as it passes. The side the ruling went against has the
 * first half; the side it favours has the whole period. Below, what each
 * funding outcome leads to. No amounts and no durations: both are set per
 * list and per court.
 */

/** One pass of the cursor over the period, then it fades away. */
const SWEEP_MS = 3600
const SWEEP_DELAY_MS = 400
/** Share of the sweep spent travelling; the rest is the fade at the end. */
const TRAVEL = 0.88

const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px 24px 22px;

  @media (max-width: 720px) {
    padding: 18px 16px;
  }
`

const Lanes = styled.div`
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 10px 20px;
  align-items: start;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    gap: 6px;
  }
`

const LaneName = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  b {
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
  }

  span {
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  @media (max-width: 720px) {
    margin-top: 10px;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 2px 8px;
  }
`

const Scale = styled.div`
  position: relative;
  display: flex;
  justify-content: space-between;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  span:nth-child(2) {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }
`

/** The track plus room under it for the deadline label. */
const Lane = styled.div`
  position: relative;
  height: 26px;
  margin-bottom: 26px;
`

const Open = styled.span<{ $until: number }>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: calc(${({ $until }) => $until * 100}% - 4px);
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--status-window) 60%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--status-window) 18%, transparent);
  color: var(--color-text);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
`

const Closed = styled.span<{ $from: number }>`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: calc(${({ $from }) => $from * 100}% + 4px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: repeating-linear-gradient(
    -45deg,
    var(--color-border-strong) 0 1px,
    transparent 1px 7px
  );

  span {
    padding: 0 8px;
    border-radius: var(--radius-pill);
    background: var(--color-raised);
    color: var(--color-muted);
    font-size: 12px;
    line-height: 18px;
  }
`

const deadlineHit = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-window) 0%, transparent); }
  30% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--status-window) 28%, transparent); }
  100% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--status-window) 0%, transparent); }
`

/** A deadline: a tick through the track and its label underneath. */
const Deadline = styled.span<{ $at: number; $on: boolean }>`
  position: absolute;
  top: -6px;
  bottom: -6px;
  left: ${({ $at }) => $at * 100}%;
  width: 2px;
  margin-left: ${({ $at }) => ($at >= 1 ? '-2px' : '-1px')};
  border-radius: 1px;
  background: var(--status-window);

  ${({ $on, $at }) =>
    $on &&
    css`
      animation: ${deadlineHit} 900ms var(--ease-out, ease-out)
        ${SWEEP_DELAY_MS + SWEEP_MS * TRAVEL * $at}ms both;
    `}

  b {
    position: absolute;
    top: calc(100% + 4px);
    ${({ $at }) =>
      $at >= 1 ? 'right: 0;' : 'left: 50%; transform: translateX(-50%);'}
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const pct = (share: number) => `${Math.round(share * 1000) / 10}%`

/** Linear travel (time passes evenly); dims once past `dimAfter`. */
const travel = (dimAfter?: number) => keyframes`
  0% { transform: translateX(0); opacity: 0; }
  4% { opacity: 1; }
  ${
    dimAfter !== undefined
      ? `${pct(dimAfter * TRAVEL)} { opacity: 1; }
         ${pct(dimAfter * TRAVEL + 0.04)} { opacity: 0.35; }`
      : ''
  }
  ${pct(TRAVEL)} { transform: translateX(100%); }
  ${pct(TRAVEL + 0.02)} { opacity: ${dimAfter !== undefined ? 0.35 : 1}; }
  100% { transform: translateX(100%); opacity: 0; }
`

const sweepPlain = travel()
const sweepDimmed = travel(0.5)

/**
 * The time cursor: a full-width layer that slides by its own width, so the
 * cursor at its left edge crosses the track with a transform only.
 */
const Sweep = styled.span<{ $on: boolean; $dimAfter?: number }>`
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;

  ${({ $on, $dimAfter }) =>
    $on &&
    css`
      animation: ${$dimAfter !== undefined ? sweepDimmed : sweepPlain}
        ${SWEEP_MS}ms linear ${SWEEP_DELAY_MS}ms both;
    `}

  i {
    position: absolute;
    top: -7px;
    bottom: -3px;
    left: 0;
    width: 1px;
    margin-left: -0.5px;
    background: var(--color-text);
  }

  i::before {
    content: '';
    position: absolute;
    top: -3px;
    left: -3px;
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--color-text);
    box-shadow: 0 0 10px color-mix(in srgb, var(--color-text) 60%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`

const Note = styled.p`
  margin: -6px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Outcomes = styled.ul`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  padding: 18px 0 0;
  border-top: 1px solid var(--glass-border);
  list-style: none;

  li {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 18px;
    border-left: 1px solid var(--glass-border);
  }

  li:first-child {
    padding-left: 0;
    border-left: 0;
  }

  b {
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 17px;
    line-height: 22px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  span {
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    gap: 14px;

    li {
      padding: 0;
      border-left: 0;
    }
  }
`

export const AppealWindow = () => {
  const ref = useRef<HTMLDivElement>(null)
  const on = useInView(ref, 0.5)

  return (
    <Panel
      ref={ref}
      as="figure"
      $padding="none"
      aria-label="Appeal period as a timeline: the side the ruling went against can be funded only in the first half; the side it favours, for the whole period. After a tie or a refusal to arbitrate, both sides have the whole period."
      style={{ margin: 0 }}
    >
      <Label $tone="faint">Appeal period · who can be funded, until when</Label>
      <Lanes>
        <span aria-hidden />
        <Scale aria-hidden>
          <span>Ruling given</span>
          <span>Halfway</span>
          <span>Period ends</span>
        </Scale>
        <LaneName>
          <b>Side the ruling went against</b>
          <span>First half only</span>
        </LaneName>
        <Lane aria-hidden>
          <Open $until={0.5}>Open</Open>
          <Closed $from={0.5}>
            <span>Closed</span>
          </Closed>
          <Deadline $at={0.5} $on={on}>
            <b>Deadline</b>
          </Deadline>
          <Sweep $on={on} $dimAfter={0.5}>
            <i />
          </Sweep>
        </Lane>
        <LaneName>
          <b>Side the ruling favours</b>
          <span>The whole period</span>
        </LaneName>
        <Lane aria-hidden>
          <Open $until={1}>Open</Open>
          <Deadline $at={1} $on={on}>
            <b>Deadline</b>
          </Deadline>
          <Sweep $on={on}>
            <i />
          </Sweep>
        </Lane>
      </Lanes>
      <Note>
        After a tie or a refusal to arbitrate there is no losing side: both
        sides have the whole period.
      </Note>
      <Outcomes>
        <li>
          <b>One side fully funded</b>
          <span>That side wins, whatever the jurors voted.</span>
        </li>
        <li>
          <b>Both sides fully funded</b>
          <span>A new round starts with twice as many jurors plus one.</span>
        </li>
        <li>
          <b>No appeal funded</b>
          <span>The ruling is final and the registry applies it.</span>
        </li>
      </Outcomes>
    </Panel>
  )
}

export default AppealWindow
