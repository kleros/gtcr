import React, { useEffect, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { CurateIcon } from 'components/curate/icons'

/*
 * A Stake Curate withdrawal as three nodes on one track: Withdraw (the
 * submitter's transaction), Withdrawing (the waiting period, still
 * challengeable) and Execute (anyone, gas only). The fill slides along the
 * track to where the withdrawal is: halfway once started, then across the
 * second segment by the share of the withdrawing period already elapsed,
 * to the end once it can be executed. Done nodes are filled, the current
 * one glows (and pulses while the period runs), the rest are hollow. While
 * a dispute holds the withdrawal, the fill stays put with no live head and
 * no pulse.
 */

/** The stages a Stake Curate withdrawal moves through. */
export type WithdrawalStage = 'listed' | 'withdrawing' | 'ready' | 'withdrawn'

export type StepState = 'done' | 'current' | 'upcoming'

const ORDER: WithdrawalStage[] = ['listed', 'withdrawing', 'ready', 'withdrawn']

const TITLES = ['Withdraw', 'Withdrawing', 'Execute'] as const

/** State of each of the three nodes at a stage. */
export const stepStates = (stage: WithdrawalStage): StepState[] => {
  const position = ORDER.indexOf(stage)
  return [0, 1, 2].map((step) =>
    stage === 'withdrawn' || position > step
      ? 'done'
      : position === step
        ? 'current'
        : 'upcoming',
  )
}

/** Where the fill ends, as a share of the whole track. */
export const fillShare = (stage: WithdrawalStage, elapsed = 0): number =>
  stage === 'listed'
    ? 0
    : stage === 'withdrawing'
      ? 0.5 + 0.5 * Math.min(1, Math.max(0, elapsed))
      : 1

const pop = keyframes`
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: none; }
`

const live = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-window) 55%, transparent); }
  70% { box-shadow: 0 0 0 10px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

const List = styled.ol`
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
`

/* The track runs between the first and last node centres. */
const Track = styled.span`
  position: absolute;
  top: 13px;
  left: calc(100% / 6);
  right: calc(100% / 6);
  height: 2px;
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  box-shadow: inset 0 0 0 1px var(--glass-border);
`

/* Grows by width (scaleX would squash the head); ease-out, never bouncy. */
const Fill = styled.span`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--status-window) 45%, transparent),
    var(--status-window)
  );
  box-shadow: 0 0 12px color-mix(in srgb, var(--status-window) 55%, transparent);
  transition: width 900ms var(--ease-out);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

/* The live head at the end of the fill while the period runs. */
const Head = styled.i`
  position: absolute;
  top: 50%;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--color-text);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--status-window) 45%, transparent),
    0 0 14px var(--status-window);
  transform: translateY(-50%);

  body[data-theme='light'] & {
    background: var(--color-surface);
  }
`

const Step = styled.li`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  text-align: center;
`

const Node = styled.span<{ $state: StepState; $live?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  line-height: 1;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  animation: ${pop} 420ms var(--ease-spring) both;
  animation-delay: calc(var(--i, 0) * 120ms);

  ${({ $state }) =>
    $state === 'done'
      ? css`
          background: var(--status-window);
          color: var(--color-on-primary);
          box-shadow: 0 0 14px
            color-mix(in srgb, var(--status-window) 45%, transparent);
        `
      : $state === 'current'
        ? css`
            border: 2px solid var(--status-window);
            background: var(--color-surface);
            color: var(--color-text);
            box-shadow:
              0 0 0 4px
                color-mix(in srgb, var(--status-window) 16%, transparent),
              0 0 18px color-mix(in srgb, var(--status-window) 45%, transparent);
          `
        : css`
            border: 1.5px solid var(--color-border-strong);
            background: var(--color-surface);
            color: var(--color-faint);
          `}

  ${({ $live }) =>
    $live &&
    css`
      animation:
        ${pop} 420ms var(--ease-spring) both,
        ${live} 2.4s ease-out 900ms infinite;
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const StepTitle = styled.span<{ $state: StepState }>`
  color: ${({ $state }) =>
    $state === 'upcoming' ? 'var(--color-muted)' : 'var(--color-text)'};
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
`

const StepNote = styled.span`
  margin-top: -6px;
  max-width: 100%;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`

export interface WithdrawalStepperProps {
  stage: WithdrawalStage
  /** Share of the withdrawing period elapsed (0..1), drawn on the second segment. */
  elapsed?: number
  /** A dispute holds the withdrawal: nothing runs, so nothing moves. */
  paused?: boolean
  /** One short line under each node: a date, a duration, who can act. */
  notes?: [React.ReactNode?, React.ReactNode?, React.ReactNode?]
  /** Read out in full: what the drawing shows right now. */
  label: string
}

export const WithdrawalStepper = ({
  stage,
  elapsed = 0,
  paused = false,
  notes = [],
  label,
}: WithdrawalStepperProps) => {
  const states = stepStates(stage)
  const target = fillShare(stage, elapsed)
  // Start empty, then slide to the target on the next frame.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const running = stage === 'withdrawing' && !paused

  return (
    <List role="img" aria-label={label}>
      <Track aria-hidden>
        <Fill style={{ width: `${(shown ? target : 0) * 100}%` }}>
          {running && shown && <Head />}
        </Fill>
      </Track>
      {TITLES.map((title, index) => (
        <Step key={title} aria-hidden>
          <Node
            $state={states[index]}
            $live={running && index === 1}
            style={{ ['--i' as string]: index }}
          >
            {states[index] === 'done' ? (
              <CurateIcon name="check" size={14} />
            ) : (
              index + 1
            )}
          </Node>
          <StepTitle $state={states[index]}>{title}</StepTitle>
          {notes[index] && <StepNote>{notes[index]}</StepNote>}
        </Step>
      ))}
    </List>
  )
}

export default WithdrawalStepper
