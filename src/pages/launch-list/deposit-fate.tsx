import React, { useEffect, useId, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { useInView } from './use-in-view'

/*
 * One fact per card: what happens to the submitter's money across an entry's
 * life. The drawing is two steps and not a timeline — the entry is submitted,
 * then it is registered or accepted — so the hairline is cut between them and
 * carries the break glyph: no length here may be read as a duration, because
 * the challenge window is the list creator's to set in the factory. Over the
 * steps runs the money band in `--viz-2`, a chart hue no status role takes
 * (money is a quantity, not a state), while the nodes keep the app's status
 * colours: blue submitted, green registered or accepted. The purple it used
 * to draw read as a third state in a drawing whose nodes are states.
 * Both cards draw the same two steps at the same size; the only difference is
 * what the band does in the second one — an empty trough once the deposit has
 * gone back, or the same solid band running off the faded edge because the
 * stake stays. It draws once, when it comes into view.
 */

export type FateSpec = {
  /** What the band does in the second step: it has gone back, or it stays. */
  fate: 'returned' | 'locked'
  /** The state the entry reaches, the second step's node. */
  milestone: string
  /** What the drawing measures and over what window, for screen readers. */
  description: string
}

const PAD = 8
/** Half the gap that breaks the hairline between the two steps. */
const BREAK = 7
const SPEED = 620 // ms the whole reveal takes
const BAND_LAG = 90 // ms the money trails the step it runs over
/** The share of the right edge the second step fades out over. */
const FADE = 0.14

const BAND_Y = 15
const BAND_WIDTH = 14
const AXIS_Y = 45
const LABEL_Y = 65
const HEIGHT = 76

/* Reveal order, in fractions of SPEED: the first step, then the second. */
const STEP_A = { from: 0, to: 0.44 }
const STEP_B = { from: 0.52, to: 1 }

const LABEL = { weight: 500, size: 12.5 }

const draw = keyframes`
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
`

const pop = keyframes`
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: none; }
`

const fade = keyframes`
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: none; }
`

const Canvas = styled.div`
  position: relative;
  width: 100%;
  height: ${HEIGHT}px;
  min-width: 0;
`

const Svg = styled.svg`
  /* Out of flow: its measured width must never widen the card. */
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: ${HEIGHT}px;

  /* Nothing shows before the sweep; each piece reads --d (delay) and --t. */
  .draw {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }

  .pop,
  .fade {
    opacity: 0;
  }

  .pop {
    transform-box: fill-box;
    transform-origin: center;
  }

  &[data-armed] {
    .draw {
      animation: ${draw} var(--t, 600ms) linear var(--d, 0ms) both;
    }

    .pop {
      animation: ${pop} 460ms var(--ease-out) var(--d, 0ms) both;
    }

    .fade {
      animation: ${fade} 420ms var(--ease-out) var(--d, 0ms) both;
    }
  }

  text {
    font-family: var(--font-sans);
    fill: var(--color-text);
    font-size: ${LABEL.size}px;
    font-weight: ${LABEL.weight};
  }

  /* Final state for print and reduced motion: no sweep. */
  @media print, (prefers-reduced-motion: reduce) {
    .draw,
    &[data-armed] .draw {
      stroke-dashoffset: 0;
      animation: none;
    }

    .pop,
    .fade,
    &[data-armed] .pop,
    &[data-armed] .fade {
      opacity: 1;
      animation: none;
    }
  }
`

export const DepositFate = ({
  spec,
  delay = 700,
}: {
  spec: FateSpec
  /** ms before the sweep, counted from mount, so the card lands first. */
  delay?: number
}) => {
  const id = useId().replace(/:/g, '')
  const [ref, inView] = useInView<HTMLDivElement>(0.35)
  const [width, setWidth] = useState(0)
  const mountedAt = useRef(performance.now())
  const [start, setStart] = useState<number>()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(Math.round(node.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  // Arm the sweep once in view; if that is right after mount, still let the
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

  const base = start ?? 0
  /** Timing for a piece that starts at `from` and runs for `length`. */
  const timing = (from: number, length = 0, lag = 0) =>
    ({
      '--d': `${Math.round(base + lag + from * SPEED)}ms`,
      '--t': `${Math.max(1, Math.round(length * SPEED))}ms`,
    }) as React.CSSProperties

  const left = PAD
  const right = width - PAD
  const middle = width / 2
  const stepAEnd = middle - BREAK
  const stepBStart = middle + BREAK

  /** The money band: a pill from `from` to `to`, caps inside those ends. */
  const radius = BAND_WIDTH / 2
  const bar = (from: number, to: number) =>
    `M${from + radius} ${BAND_Y} H${Math.max(from + radius, to - radius)}`

  const nodes = [
    { x: left, label: 'Submitted', tone: 'window', step: STEP_A },
    { x: stepBStart, label: spec.milestone, tone: 'registered', step: STEP_B },
  ]
  const maskId = `fate-fade-${id}`

  return (
    <Canvas ref={ref}>
      {width > 0 && (
        <Svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={spec.description}
          data-armed={start !== undefined ? '' : undefined}
        >
          <defs>
            <linearGradient id={`${maskId}-ramp`} x1="0" y1="0" x2="1" y2="0">
              <stop offset={1 - FADE} stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={width}
              height={HEIGHT}
            >
              <rect
                x={0}
                y={0}
                width={width}
                height={HEIGHT}
                fill={`url(#${maskId}-ramp)`}
              />
            </mask>
          </defs>

          {/* Step one: submitted, and under review. */}
          <path
            className="draw"
            d={`M${left} ${AXIS_Y} H${stepAEnd}`}
            pathLength={1}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={1}
            style={timing(STEP_A.from, STEP_A.to - STEP_A.from)}
          />

          {/*
           * The break: two steps, never a span of time. Whatever happens
           * between them takes as long as the list's creator decided, so the
           * drawing refuses to measure it.
           */}
          <path
            className="fade"
            d={`M${middle - 6} ${AXIS_Y + 6} L${middle - 2} ${AXIS_Y - 6} M${
              middle + 2
            } ${AXIS_Y + 6} L${middle + 6} ${AXIS_Y - 6}`}
            fill="none"
            stroke="var(--color-border-strong)"
            strokeWidth={1}
            style={timing(STEP_A.to)}
          />

          {/* Step two, running off the faded edge: the entry's life goes on. */}
          <path
            className="draw"
            d={`M${stepBStart} ${AXIS_Y} H${right}`}
            mask={`url(#${maskId})`}
            pathLength={1}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={1}
            style={timing(STEP_B.from, STEP_B.to - STEP_B.from)}
          />

          {/* The money, held from submission: the same in both cards. */}
          <path
            className="draw"
            d={bar(left, stepAEnd)}
            pathLength={1}
            fill="none"
            stroke="var(--viz-2)"
            strokeWidth={BAND_WIDTH}
            strokeLinecap="round"
            style={timing(STEP_A.from, STEP_A.to - STEP_A.from, BAND_LAG)}
          />

          {/*
           * Step two is the whole difference between the two cards, drawn at
           * the same size either way: the band still there and running off
           * the edge, or the same band's trough standing empty.
           */}
          {spec.fate === 'locked' ? (
            <path
              className="draw"
              d={bar(stepBStart, right)}
              mask={`url(#${maskId})`}
              pathLength={1}
              fill="none"
              stroke="var(--viz-2)"
              strokeWidth={BAND_WIDTH}
              strokeLinecap="round"
              style={timing(STEP_B.from, STEP_B.to - STEP_B.from, BAND_LAG)}
            />
          ) : (
            <rect
              className="fade"
              x={stepBStart}
              y={BAND_Y - radius}
              width={Math.max(0, right - stepBStart)}
              height={BAND_WIDTH}
              rx={radius}
              mask={`url(#${maskId})`}
              fill="none"
              stroke="var(--viz-2)"
              strokeWidth={1}
              strokeOpacity={0.65}
              style={timing(STEP_B.from, 0, BAND_LAG)}
            />
          )}

          {/* The two steps: a haloed status dot and its name. */}
          {nodes.map((node) => (
            <React.Fragment key={node.label}>
              <g className="pop" style={timing(node.step.from, 0, BAND_LAG)}>
                <circle
                  cx={node.x}
                  cy={AXIS_Y}
                  r={8}
                  fill={`var(--status-${node.tone})`}
                  fillOpacity={0.22}
                />
                <circle
                  cx={node.x}
                  cy={AXIS_Y}
                  r={4.5}
                  fill={`var(--status-${node.tone})`}
                />
              </g>
              <text
                className="fade"
                x={node.x - 4}
                y={LABEL_Y}
                textAnchor="start"
                style={timing(node.step.from, 0, BAND_LAG)}
              >
                {node.label}
              </text>
            </React.Fragment>
          ))}
        </Svg>
      )}
    </Canvas>
  )
}

export default DepositFate
