import React, { useEffect, useId, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import type { StatusTone } from 'components/curate/primitives'

/*
 * The address's challenge record as one 270° ring split by outcome (the
 * vote-split arc recipe): every challenge it raised has its share of the arc,
 * won first, then lost, no ruling and still in court, each in its status
 * tone. Nothing on the ring is a scale: no ticks, no end labels. The centre
 * reads the decided ones ("14 of 14 decided challenges won"); open disputes
 * stay on the ring and in the legend beside it, never in that ratio.
 * Segments draw in one after another once in view; reduced motion shows
 * them drawn.
 */

const C = 120
const R = 88
const W = 14
const START = -135
const SWEEP = 270
const END = START + SWEEP
/** Degrees a round cap reaches past the end of its arc. */
const CAP = ((W / 2 / R) * 180) / Math.PI
/** Gap between two segments, between their caps. */
const GAP = 3

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.sin(a), C - r * Math.cos(a)] as const
}
const arc = (r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(r, a0)
  const [x1, y1] = polar(r, a1)
  return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

const draw = keyframes`
  from { stroke-dashoffset: 1; opacity: 0; }
  1% { opacity: 1; }
  to { stroke-dashoffset: 0; opacity: 1; }
`

const pop = keyframes`
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: scale(1); }
`

const halo = keyframes`
  from { opacity: 0; }
`

const segmentMotion = css`
  .seg {
    stroke-dasharray: 1 2;
    stroke-dashoffset: 1;
    opacity: 0;
  }

  .dot {
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
  }

  .halo {
    opacity: 0;
  }

  &[data-in='true'] .seg {
    animation: ${draw} 640ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(200ms + var(--n) * 140ms);
  }

  &[data-in='true'] .dot {
    animation: ${pop} 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(200ms + var(--n) * 140ms);
  }

  &[data-in='true'] .halo {
    opacity: 0.16;
    animation: ${halo} 600ms ease both;
    animation-delay: calc(500ms + var(--n) * 140ms);
  }

  @media (prefers-reduced-motion: reduce) {
    .seg,
    .dot,
    &[data-in='true'] .seg,
    &[data-in='true'] .dot {
      animation: none;
      opacity: 1;
      stroke-dashoffset: 0;
      transform: none;
    }

    .halo,
    &[data-in='true'] .halo {
      animation: none;
      opacity: 0.16;
    }
  }
`

const Wrap = styled.div<{ $size: number }>`
  position: relative;
  width: ${({ $size }) => $size}px;
  max-width: 100%;
  aspect-ratio: 1;
  flex: 0 0 auto;

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  ${segmentMotion}
`

const Center = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
  pointer-events: none;
`

const Figure = styled.span<{ $px: number }>`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: ${({ $px }) => $px}px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  small {
    margin-left: 0.3em;
    color: var(--color-muted);
    font-size: 0.5em;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
`

const Caption = styled.span`
  max-width: 62%;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 15px;
`

export interface RingSegment {
  key: string
  value: number
  tone: StatusTone
}

export const ChallengeRing = ({
  segments,
  value,
  unit,
  caption,
  label,
  size = 208,
}: {
  /** Outcomes in arc order; their values add up to the whole ring. */
  segments: RingSegment[]
  /** The figure in the middle. */
  value: string
  /** Small text after the figure ("of 14"). */
  unit?: string
  caption: string
  /** Accessible description of the whole record. */
  label: string
  size?: number
}) => {
  const id = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  let cursor = START
  const shapes = segments
    .filter((segment) => segment.value > 0)
    .map((segment, n) => {
      const a0 = cursor
      const a1 = cursor + (segment.value / Math.max(1, total)) * SWEEP
      cursor = a1
      // Round caps reach CAP past each end: trim the inner ends so a gap is
      // left between neighbours; the ring's two outer ends stay where the
      // track's own caps are.
      const from = a0 <= START + 1e-6 ? a0 : a0 + CAP + GAP / 2
      const to = a1 >= END - 1e-6 ? a1 : a1 - CAP - GAP / 2
      return { ...segment, n, a0, a1, from, to, dot: to - from < 0.5 }
    })

  const head = shapes[0]
  const domeTone = head ? `var(--status-${head.tone})` : 'var(--color-faint)'
  const figurePx = Math.round(size * (value.length > 4 ? 0.17 : 0.2))

  return (
    <Wrap ref={ref} $size={size} data-in={inView} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${C * 2} ${C * 2}`} aria-hidden>
        <defs>
          <radialGradient id={`dome-${id}`} cx="50%" cy="34%" r="60%">
            <stop
              offset="0%"
              style={{ stopColor: domeTone }}
              stopOpacity="0.14"
            />
            <stop
              offset="100%"
              style={{ stopColor: domeTone }}
              stopOpacity="0"
            />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={70} fill={`url(#dome-${id})`} />
        <path
          d={arc(R, START, END)}
          fill="none"
          strokeWidth={W}
          strokeLinecap="round"
          style={{ stroke: 'var(--color-raised)' }}
        />
        {shapes.map((shape) => {
          const stroke = `var(--status-${shape.tone})`
          const style = { ['--n' as string]: shape.n } as React.CSSProperties
          if (shape.dot) {
            const [x, y] = polar(R, (shape.a0 + shape.a1) / 2)
            return (
              <g key={shape.key}>
                <circle
                  className="halo"
                  cx={x}
                  cy={y}
                  r={W / 2 + 5}
                  style={{ ...style, fill: stroke }}
                />
                <circle
                  className="dot"
                  cx={x}
                  cy={y}
                  r={W / 2}
                  style={{ ...style, fill: stroke }}
                />
              </g>
            )
          }
          const d = arc(R, shape.from, shape.to)
          return (
            <g key={shape.key}>
              <path
                className="halo"
                d={d}
                fill="none"
                strokeWidth={W + 10}
                strokeLinecap="round"
                style={{ ...style, stroke }}
              />
              <path
                className="seg"
                d={d}
                pathLength={1}
                fill="none"
                strokeWidth={W}
                strokeLinecap="round"
                style={{ ...style, stroke }}
              />
            </g>
          )
        })}
      </svg>
      <Center>
        <Figure $px={figurePx}>
          {value}
          {unit && <small>{unit}</small>}
        </Figure>
        <Caption>{caption}</Caption>
      </Center>
    </Wrap>
  )
}

export default ChallengeRing
