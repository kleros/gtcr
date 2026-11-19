import React, { useEffect, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { useInView } from './use-in-view'

/*
 * One fact per card: how much of an entry's life the submitter's money spends
 * inside it. The lane is the entry's life, a track lit a step above the card
 * so that the part the money never reaches is still something the eye can
 * see, fading out at its right edge because neither kind of list has an end
 * anyone can draw. The glowing band inside it is the money — `--viz-2`, a
 * chart hue no status role takes, because money is a quantity and not a
 * state. A lit head runs the band's length once and goes out, so the extent
 * reads as travel rather than as a shape.
 *
 * Both cards draw the same lane at the same size, and the difference between
 * them is extent, which is the one thing a bar says well without words: the
 * Standard band stops part-way, at the green node that releases it, with the
 * rest of the lane standing visibly empty beside it as the reference the eye
 * needs; the Stake band runs the whole lane and dissolves into the fade with
 * no node at all, because there is no event at which a stake comes back. Each
 * end carries two short lines, the event over what the money does, so a card
 * reads left to right as one sentence.
 *
 * Nothing here is a measurement. The lane carries no axis, no tick and no
 * figure, its own end is faded out rather than drawn, and the caption says as
 * much: how long any of this takes is the list creator's to set in the
 * factory, not ours to quote. The two dots are events, not marks on a scale.
 * It draws once, when it comes into view.
 */

export type FateSpec = {
  /**
   * How much of the lane the money is inside: a share of it, or 'full' — the
   * whole lane, dissolving into the fade, with no node and no end.
   */
  fill: number | 'full'
  /** What ends the money's stay, the first line at the lane's right end. */
  event: string
  /** What the money does there, the second line under the event. */
  verdict: string
  /** What the drawing shows and over what window, for screen readers. */
  description: string
}

const LANE = 14
/** Half the lane's height: the round cap the band's end sits in. */
const CAP = LANE / 2
/** Where the lane starts to fade: no one can draw the end of an entry's life. */
const FADE_FROM = '86%'
/** Where a band with no end puts its head out, just inside the fade. */
const HEAD_OUT = '84%'
const SPEED = 620 // ms the band takes to run its length
const LAG = 80 // ms the money trails the node it leaves
const GONE = 380 // ms the head takes to go out once it has arrived

const FADE = css`
  -webkit-mask-image: linear-gradient(to right, #000 ${FADE_FROM}, transparent);
  mask-image: linear-gradient(to right, #000 ${FADE_FROM}, transparent);
`

const pop = keyframes`
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: none; }
`

/* Opacity alone: the end labels are placed with a transform of their own. */
const appear = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const travel = keyframes`
  from { left: 0; opacity: 1; }
  to { left: var(--stop); opacity: 1; }
`

const goOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`

const Figure = styled.figure`
  margin: 0;
  min-width: 0;
`

const Lane = styled.div`
  position: relative;
  height: ${LANE}px;
`

/*
 * The entry's life: a track raised a step off the card and ringed with a
 * hairline, going at the right edge. Not the recessed control track: that one
 * is 32% black over a card already near black, so in the dark theme the empty
 * remainder of the Standard lane sank out of sight and the band read as a bar
 * that simply stopped. This is the lift the withdrawal stepper's track uses,
 * which reads as a step up in the dark and as a soft grey strip in the light.
 */
const Track = styled.span`
  position: absolute;
  inset: 0;
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  box-shadow: inset 0 0 0 1px var(--glass-border);
  ${FADE}
`

/* The money. Grows from the left under the node that locks it. */
const Band = styled.span<{ $open?: boolean }>`
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--to);
  border-radius: var(--radius-pill);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--viz-2) 45%, transparent),
    var(--viz-2)
  );
  box-shadow: 0 0 12px color-mix(in srgb, var(--viz-2) 50%, transparent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform ${SPEED}ms var(--ease-out) var(--d-band, 0ms);

  /* A band that ends at an event keeps its end; one with none dissolves. */
  ${({ $open }) => $open && FADE}

  [data-drawn='true'] & {
    transform: none;
  }

  @media print, (prefers-reduced-motion: reduce) {
    transform: none;
    transition: none;
  }
`

/* The light at the band's leading edge, which runs its length and goes out. */
const Head = styled.i`
  position: absolute;
  top: 50%;
  left: 0;
  width: 6px;
  height: 6px;
  margin-left: -3px;
  border-radius: var(--radius-pill);
  background: var(--color-text);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--viz-2) 45%, transparent),
    0 0 14px var(--viz-2);
  transform: translateY(-50%);
  opacity: 0;

  body[data-theme='light'] & {
    background: var(--color-surface);
  }

  [data-drawn='true'] & {
    animation:
      ${travel} ${SPEED}ms var(--ease-out) var(--d-band, 0ms) forwards,
      ${goOut} ${GONE}ms ease-out var(--d-end, 0ms) forwards;
  }

  @media print, (prefers-reduced-motion: reduce) {
    display: none;
  }
`

/*
 * A moment the money moves: a haloed status dot in the lane, in the role the
 * moment actually has — blue because the challenge window is open at
 * submission, green because registration is the event that releases a
 * deposit. A stake has no such moment, so the Stake lane carries one dot.
 * Each lands when the money reaches it: the first as the band sets off, the
 * second under the head that has just arrived.
 */
const Node = styled.span<{ $tone: 'window' | 'registered' }>`
  position: absolute;
  top: ${(LANE - 10) / 2}px;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: var(--radius-pill);
  background: var(--status-${({ $tone }) => $tone});
  box-shadow:
    0 0 0 3px var(--status-${({ $tone }) => $tone}-soft),
    0 0 12px
      color-mix(in srgb, var(--status-${({ $tone }) => $tone}) 55%, transparent);
  opacity: 0;

  &[data-at='end'] {
    --d-node: var(--d-end, 0ms);
  }

  [data-drawn='true'] & {
    animation: ${pop} 460ms var(--ease-spring) var(--d-node, 0ms) both;
  }

  @media print, (prefers-reduced-motion: reduce) {
    opacity: 1;

    [data-drawn='true'] & {
      animation: none;
    }
  }
`

const Ends = styled.div`
  position: relative;
  height: 33px;
  margin-top: 9px;
`

/*
 * The two ends in words, each anchored to the band: the left at its start,
 * the right at wherever it stops, so the words and the extent say the same
 * thing. They arrive with the moment they name.
 */
const End = styled.div`
  position: absolute;
  top: 0;
  white-space: nowrap;
  opacity: 0;

  &[data-side='start'] {
    left: 0;
    --d-label: var(--d-node, 0ms);
  }

  &[data-side='end'] {
    left: var(--to);
    transform: translateX(-100%);
    text-align: right;
    --d-label: var(--d-end, 0ms);
  }

  [data-drawn='true'] & {
    animation: ${appear} 420ms var(--ease-out) var(--d-label, 0ms) both;
  }

  @media print, (prefers-reduced-motion: reduce) {
    opacity: 1;

    [data-drawn='true'] & {
      animation: none;
    }
  }
`

const Moment = styled.div`
  color: var(--color-text);
  font-size: 12.5px;
  line-height: 17px;
  font-weight: 500;
`

const Money = styled.div`
  color: var(--color-muted);
  font-size: 12px;
  line-height: 16px;
`

/* What the drawing measures, which is nothing: it is ordered, not scaled. */
const Caption = styled.figcaption`
  margin-top: 4px;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  text-align: right;
`

export const DepositFate = ({
  spec,
  delay = 700,
}: {
  spec: FateSpec
  /** ms before the draw, counted from mount, so the card lands first. */
  delay?: number
}) => {
  const [ref, inView] = useInView<HTMLElement>(0.35)
  const mountedAt = useRef(performance.now())
  const [start, setStart] = useState<number>()

  // Arm the draw once in view; if that is right after mount, still let the
  // card land first.
  useEffect(() => {
    if (!inView || start !== undefined) return
    setStart(
      Math.max(
        150,
        Math.round(delay - (performance.now() - mountedAt.current)),
      ),
    )
  }, [inView, start, delay])

  const open = spec.fill === 'full'
  const to = open ? '100%' : `${+((spec.fill as number) * 100).toFixed(2)}%`
  // The head stops in the band's end cap, or just inside the fade when the
  // band has no end to stop at.
  const stop = open ? HEAD_OUT : `calc(${to} - ${CAP}px)`
  const base = start ?? 0

  return (
    <Figure
      ref={ref}
      role="img"
      aria-label={spec.description}
      data-drawn={start !== undefined}
      style={
        {
          '--to': to,
          '--stop': stop,
          '--d-node': `${base}ms`,
          '--d-band': `${base + LAG}ms`,
          '--d-end': `${base + LAG + SPEED}ms`,
        } as React.CSSProperties
      }
    >
      <Lane aria-hidden>
        <Track />
        <Band $open={open} />
        <Head />
        {/* Submission, where the money goes in: the same in both cards. */}
        <Node $tone="window" style={{ left: `${CAP}px` }} />
        {/* The release, which only a deposit has. */}
        {!open && (
          <Node $tone="registered" data-at="end" style={{ left: stop }} />
        )}
      </Lane>

      <Ends aria-hidden>
        <End data-side="start">
          <Moment>You submit</Moment>
          <Money>Locked</Money>
        </End>
        <End data-side="end">
          <Moment>{spec.event}</Moment>
          <Money>{spec.verdict}</Money>
        </End>
      </Ends>

      <Caption aria-hidden>By event, not to scale</Caption>
    </Figure>
  )
}

export default DepositFate
