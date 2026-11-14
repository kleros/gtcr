import React from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Button, Label, Surface } from './primitives'
import { reveal } from './motion/reveal'
import { CountUpText } from './registry-shared-count'

/*
 * "What happens next": before any deposit, the receipt (each line, then the
 * exact total counting up), the possible outcomes as a vertical timeline, and
 * one confirm button that repeats the amount. A disabled button names its
 * blocker.
 *
 * The timeline is drawn as a tree, so sequence and alternatives never look
 * alike: steps that follow one another sit on the glowing spine; outcomes
 * that exclude each other are indented siblings that tap off the spine below
 * the step they fork from (├ … └), and the spine ends at the last of them.
 */

const panel = css`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Shell = styled(Surface)`
  ${panel}
`

const Bare = styled.div`
  ${panel}
  min-width: 0;
`

const Receipt = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 10px 16px;
  margin: 0;

  dt {
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    text-align: right;
    overflow-wrap: anywhere;
  }

  > * {
    ${reveal}
  }
`

const TotalRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 0 2px;
  border-top: 1px solid var(--glass-border);
`

const Total = styled.output`
  display: block;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(26px, 1.4vw + 16px, 34px);
  line-height: 1.05;
  font-weight: 500;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`

const drawDown = keyframes`
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
`

const drawAcross = keyframes`
  from { transform: scaleX(0); opacity: 0; }
  to { transform: scaleX(1); opacity: 1; }
`

/** main: on the spine. outcome / branch: alternatives tapping off it. */
type StepRole = 'main' | 'outcome' | 'branch'

/** How a step's spine segment reaches the next step, if there is one. */
type SpineLink = 'sequence' | 'fork'

/*
 * `branch` marks an alternative to the step right above it, so the step
 * before a run of branches is itself one of the outcomes (the expected one)
 * and all of them fork from the step before it. A run of branches right
 * after the first step hangs off that first step.
 */
const stepRoles = (steps: OutcomeStep[]): StepRole[] =>
  steps.map((step, index) =>
    step.branch
      ? 'branch'
      : index > 0 && steps[index + 1]?.branch
        ? 'outcome'
        : 'main',
  )

const Timeline = styled.ol`
  --gap: 16px;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  margin: 0;
  padding: 0;
  list-style: none;
`

/* Node centre: 10px from the step's top, 6px from the spine's left edge. */
const Step = styled.li<{ $role: StepRole; $link?: SpineLink }>`
  position: relative;
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding-left: ${({ $role }) => ($role === 'main' ? 0 : '26px')};
  ${reveal}

  /* The spine, one segment per step, down to the next step's node height:
     glowing while the steps follow one another, a plain hairline where it
     only carries the alternatives. */
  ${({ $link }) =>
    $link &&
    css`
      &::before {
        content: '';
        position: absolute;
        top: 10px;
        bottom: calc(-1 * var(--gap) - 10px);
        left: 5px;
        width: 2px;
        border-radius: var(--radius-pill);
        background: ${$link === 'sequence'
          ? 'var(--color-primary)'
          : 'var(--color-border-strong)'};
        box-shadow: ${$link === 'sequence'
          ? '0 0 10px color-mix(in srgb, var(--color-primary) 55%, transparent)'
          : 'none'};
        transform-origin: top;
        animation: ${drawDown} 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        animation-delay: calc(var(--i, 0) * 70ms + 160ms);
      }
    `}

  /* An alternative taps off the spine with an elbow into its node. */
  ${({ $role }) =>
    $role !== 'main' &&
    css`
      &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 5px;
        width: 21px;
        height: 9px;
        border-left: 2px solid
          ${$role === 'branch'
            ? 'color-mix(in srgb, var(--status-contested) 70%, transparent)'
            : 'color-mix(in srgb, var(--color-primary) 70%, transparent)'};
        border-bottom: 2px solid
          ${$role === 'branch'
            ? 'color-mix(in srgb, var(--status-contested) 70%, transparent)'
            : 'color-mix(in srgb, var(--color-primary) 70%, transparent)'};
        border-bottom-left-radius: 9px;
        transform-origin: left center;
        animation: ${drawAcross} 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
        animation-delay: calc(var(--i, 0) * 70ms + 220ms);
      }
    `}

  @media (prefers-reduced-motion: reduce) {
    &::before,
    &::after {
      animation: none;
    }
  }
`

const SrOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

const Node = styled.span<{ $branch?: boolean }>`
  position: relative;
  z-index: 1;
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  border: 2px solid
    ${({ $branch }) =>
      $branch ? 'var(--status-contested)' : 'var(--color-primary)'};
  box-shadow:
    0 0 0 3px
      color-mix(
        in srgb,
        ${({ $branch }) =>
            $branch ? 'var(--status-contested)' : 'var(--color-primary)'}
          18%,
        transparent
      ),
    0 0 12px
      ${({ $branch }) =>
        $branch ? 'var(--status-contested)' : 'var(--color-primary)'};
`

const StepTitle = styled.div`
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
`

const StepBody = styled.div`
  margin-top: 2px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Policy = styled.div`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Blocker = styled.p`
  margin: -8px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-align: center;
`

/* Full on-primary ink: any fade drops the amount under AA on the blue
   fill. The lighter weight is what sets it apart from the label. */
const Amount = styled.span`
  font-weight: 400;
  font-variant-numeric: tabular-nums;
`

export interface ReceiptLine {
  label: string
  value: React.ReactNode
}

export interface OutcomeStep {
  title: string
  body: React.ReactNode
  /**
   * An alternative to the step right above it ("Someone challenges" after
   * "Nobody challenges"). Consecutive branches are further alternatives. The
   * step above the run and every branch in it are drawn as siblings forking
   * from the step before them, never as a sequence.
   */
  branch?: boolean
}

export const WhatHappensNext = ({
  title = 'What happens next',
  receipt,
  total,
  steps,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  confirmBlocker,
  loading,
  policy,
  featured = false,
  bare = false,
}: {
  title?: string
  receipt: ReceiptLine[]
  /** The exact total that will be sent, repeated on the button. */
  total: React.ReactNode
  steps: OutcomeStep[]
  confirmLabel: string
  onConfirm: () => void
  confirmDisabled?: boolean
  /** Why the button is disabled ("Connect wallet to submit"). */
  confirmBlocker?: string
  loading?: boolean
  policy?: React.ReactNode
  /** Carry the page's one iridescent rim (the submit page's receipt). */
  featured?: boolean
  /** Without its own panel, for use inside a dialog or another panel. */
  bare?: boolean
}) => {
  const roles = stepRoles(steps)
  const body = (
    <>
      <Label>{title}</Label>
      <Receipt>
        {receipt.map((line, index) => (
          <React.Fragment key={line.label}>
            <dt style={{ ['--i' as string]: index }}>{line.label}</dt>
            <dd style={{ ['--i' as string]: index }}>{line.value}</dd>
          </React.Fragment>
        ))}
      </Receipt>
      <TotalRow>
        <Label $tone="faint">You send now</Label>
        <Total aria-live="polite">
          <CountUpText value={total} />
        </Total>
      </TotalRow>
      <Timeline aria-label="Possible outcomes">
        {steps.map((step, index) => {
          const role = roles[index]
          const next = roles[index + 1]
          return (
            <Step
              key={step.title}
              $role={role}
              $link={next ? (next === 'main' ? 'sequence' : 'fork') : undefined}
              style={{ ['--i' as string]: index + 2 }}
            >
              <Node $branch={role === 'branch'} aria-hidden />
              <div>
                <StepTitle>
                  {role !== 'main' && (
                    <SrOnly>
                      {role === 'outcome' ? 'One outcome: ' : 'Or: '}
                    </SrOnly>
                  )}
                  {step.title}
                </StepTitle>
                <StepBody>{step.body}</StepBody>
              </div>
            </Step>
          )
        })}
      </Timeline>
      {policy && <Policy>{policy}</Policy>}
      <Button
        type="button"
        $variant="primary"
        $block
        disabled={confirmDisabled || loading}
        aria-disabled={confirmDisabled || loading}
        title={confirmDisabled ? confirmBlocker : undefined}
        onClick={onConfirm}
      >
        {loading ? (
          'Waiting for your wallet…'
        ) : (
          <>
            {confirmLabel}
            <Amount>· {total}</Amount>
          </>
        )}
      </Button>
      {confirmDisabled && confirmBlocker && (
        <Blocker role="status">{confirmBlocker}</Blocker>
      )}
    </>
  )
  return bare ? (
    <Bare role="group" aria-label={title}>
      {body}
    </Bare>
  ) : (
    <Shell
      $padding="standard"
      $featured={featured}
      role="group"
      aria-label={title}
    >
      {body}
    </Shell>
  )
}

export default WhatHappensNext
