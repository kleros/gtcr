import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Label, Surface } from './primitives'
import { reveal } from './motion/reveal'

/*
 * Beginner explainer: collapsed into a pill by default and remembered per id.
 * Opened, it is a compact row of numbered steps on one glowing connector
 * (the steps are the schematic), with an optional drawing beside it.
 * `embedded` drops the panel so it can open inside another panel.
 */

const STORAGE_PREFIX = 'curatevision-explainer:'

/** Collapsed unless the visitor opened it before: pages stay quiet by default. */
const readHidden = (id: string): boolean => {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id) !== 'open'
  } catch {
    return true
  }
}

const writeHidden = (id: string, hidden: boolean) => {
  try {
    if (hidden) localStorage.removeItem(STORAGE_PREFIX + id)
    else localStorage.setItem(STORAGE_PREFIX + id, 'open')
  } catch {
    // Storage can be blocked; the choice then lasts for the session.
  }
}

export const useExplainerHidden = (id: string) => {
  const [hidden, setHiddenState] = useState(() => readHidden(id))
  const setHidden = useCallback(
    (next: boolean) => {
      setHiddenState(next)
      writeHidden(id, next)
    },
    [id],
  )
  return [hidden, setHidden] as const
}

const layout = css`
  display: flex;
  flex-direction: column;
  gap: 20px;
  ${reveal}
`

const Shell = styled(Surface)`
  ${layout}
`

const Embedded = styled.section`
  ${layout}
  flex: 1 1 100%;
  width: 100%;
  min-width: 0;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);
`

const Top = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const Heading = styled.h2`
  margin: 0;
  /* Focus lands here only by code, after the reader opens the explainer. */
  &:focus {
    outline: none;
  }

  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 26px;
  font-weight: 500;
  letter-spacing: -0.025em;
  text-wrap: balance;
`

const Intro = styled.p`
  margin: 0;
  max-width: 72ch;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Body = styled.div<{ $withSchematic: boolean }>`
  display: grid;
  grid-template-columns: ${({ $withSchematic }) =>
    $withSchematic ? 'minmax(0, 1fr) minmax(260px, 380px)' : 'minmax(0, 1fr)'};
  gap: 28px;
  align-items: center;

  @media (max-width: 960px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const draw = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`

const drawDown = keyframes`
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
`

const Steps = styled.ol<{ $count: number }>`
  display: grid;
  grid-template-columns: repeat(
    ${({ $count }) => Math.min(Math.max($count, 1), 4)},
    minmax(0, 1fr)
  );
  gap: 20px 24px;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
`

const Step = styled.li`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  ${reveal}

  /* Connector to the next step: across on wide screens, down on phones. */
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 12px;
    left: 32px;
    right: -20px;
    height: 1px;
    background: linear-gradient(
      90deg,
      var(--color-primary),
      color-mix(in srgb, var(--color-primary) 20%, transparent)
    );
    box-shadow: 0 0 8px
      color-mix(in srgb, var(--color-primary) 60%, transparent);
    transform-origin: left;
    animation: ${draw} 800ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--i, 0) * 70ms + 200ms);
  }

  @media (max-width: 720px) {
    padding-left: 38px;

    &:not(:last-child)::after {
      top: 30px;
      bottom: -14px;
      left: 12px;
      right: auto;
      width: 1px;
      height: auto;
      background: linear-gradient(
        var(--color-primary),
        color-mix(in srgb, var(--color-primary) 20%, transparent)
      );
      transform-origin: top;
      animation-name: ${drawDown};
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none !important;
    }
  }
`

const Node = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-bottom: 6px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  box-shadow: 0 0 14px -2px
    color-mix(in srgb, var(--color-primary) 70%, transparent);
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
  font-variant-numeric: tabular-nums;

  @media (max-width: 720px) {
    position: absolute;
    top: 0;
    left: 0;
    margin: 0;
  }
`

const StepTitle = styled.div`
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
`

const StepBody = styled.div`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 18px;
`

const TextButton = styled.button`
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  cursor: pointer;
  transition: color var(--motion);

  &:hover {
    color: var(--color-text);
  }
`

const Schematic = styled.div`
  color: var(--color-muted);

  svg {
    display: block;
    width: 100%;
    height: auto;
  }
`

const Pill = styled.button<{ $embedded: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: ${({ $embedded }) => ($embedded ? 'center' : 'flex-start')};
  width: fit-content;
  height: 32px;
  margin-left: ${({ $embedded }) => ($embedded ? 'auto' : 0)};
  padding: 0 14px 0 6px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color var(--motion),
    border-color var(--motion),
    transform var(--motion);

  &:hover {
    color: var(--color-text);
    border-color: var(--color-border-strong);
    transform: translateY(-1px);
  }

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-pill);
    background: var(--color-primary-soft);
    /* Primary pulled toward the text ink: AA on the soft fill in every
       theme (plain primary is under 4.5:1 in Dark and Light). */
    color: color-mix(in srgb, var(--color-primary) 70%, var(--color-text));
    box-shadow: 0 0 10px -2px var(--color-primary);
    font-size: 11px;
    font-weight: 600;
  }
`

export interface ExplainerStep {
  title: string
  body: React.ReactNode
}

export const Explainer = ({
  id,
  eyebrow,
  heading,
  intro,
  steps,
  schematic,
  footer,
  embedded = false,
}: {
  id: string
  eyebrow?: string
  heading: string
  intro?: React.ReactNode
  steps: ExplainerStep[]
  schematic?: React.ReactNode
  footer?: React.ReactNode
  /** Open inside another panel (hairline on top) instead of its own panel. */
  embedded?: boolean
}) => {
  const [hidden, setHidden] = useExplainerHidden(id)
  const pillRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // The pill and the panel swap, so the pressed control unmounts: focus
  // follows to the heading (opened) or the pill (closed). Only after the
  // reader toggles, never on load, when the open state comes from storage.
  const toggled = useRef(false)
  useEffect(() => {
    if (!toggled.current) return
    ;(hidden ? pillRef : headingRef).current?.focus()
  }, [hidden])
  const toggle = (next: boolean) => {
    toggled.current = true
    setHidden(next)
  }

  if (hidden)
    return (
      <Pill
        ref={pillRef}
        type="button"
        $embedded={embedded}
        aria-expanded={false}
        onClick={() => toggle(false)}
      >
        <span aria-hidden>?</span>
        {eyebrow ?? 'How it works'}
      </Pill>
    )

  const content = (
    <>
      <Top>
        {eyebrow && <Label $tone="faint">{eyebrow}</Label>}
        <Heading ref={headingRef} tabIndex={-1}>
          {heading}
        </Heading>
        {intro && <Intro>{intro}</Intro>}
      </Top>
      <Body $withSchematic={!!schematic}>
        <Steps $count={steps.length}>
          {steps.map((step, index) => (
            <Step key={step.title} style={{ ['--i' as string]: index + 1 }}>
              <Node aria-hidden>{index + 1}</Node>
              <StepTitle>{step.title}</StepTitle>
              <StepBody>{step.body}</StepBody>
            </Step>
          ))}
        </Steps>
        {schematic && <Schematic aria-hidden>{schematic}</Schematic>}
      </Body>
      <Footer>
        {footer}
        <TextButton type="button" onClick={() => toggle(true)}>
          Close
        </TextButton>
      </Footer>
    </>
  )

  return embedded ? (
    <Embedded aria-label={heading}>{content}</Embedded>
  ) : (
    <Shell as="section" $padding="standard" aria-label={heading}>
      {content}
    </Shell>
  )
}

export default Explainer
