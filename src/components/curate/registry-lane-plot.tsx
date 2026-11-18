import React, { useId, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { formatDate } from 'utils/time'
import { Label } from './primitives'
import type { StatusTone } from './primitives'
import {
  TONE_COLOR,
  integer,
  useInView,
  useWidth,
} from './registry-insights-kit'

/*
 * The listing-history drawing, with no opinion about where its lanes come
 * from: one lane per entry on a shared time axis, built from stretches
 * (segments) and the marks that open or close them. Both registry pages feed
 * it from their own mechanics — a Stake listing runs from its submission, a
 * Standard one only from the moment its request resolved — and write the
 * lane's own name, tooltip lines and legend themselves.
 *
 * Each lane is a link: hover, focus or a first tap shows its dates; a click,
 * Enter or a second tap opens the entry; the arrow keys move between lanes.
 */

/** The most recently active lanes a panel draws. */
export const LANE_CAP = 24

export interface LaneSegment {
  /** Unix seconds. */
  start: number
  /** Unix seconds; undefined while the stretch is still running. */
  end?: number
  kind: 'listed' | 'was-listed' | 'pending' | 'court'
  /** A running stretch glows, so the live lanes read first. */
  glow?: boolean
}

export interface LaneMark {
  /** Unix seconds, or the live head at the right end of the lane. */
  at: number | 'now'
  /** The status dot, the ruling that took the entry off, or a plain stop. */
  kind: 'status' | 'off' | 'stop'
  /** Colours a status mark; the other kinds carry their own meaning. */
  tone?: StatusTone
}

export interface PlotLane {
  id: string
  /** Already resolved by the caller: a hidden entry never gives its name. */
  name: string
  /** The tooltip, and the lane's accessible name after it. */
  lines: string[]
  /** Painted in order, so a request's overlay sits on its listing. */
  segments: LaneSegment[]
  marks: LaneMark[]
}

export const LANE_COLOR: Record<LaneSegment['kind'], string> = {
  /** On the list. */
  listed: 'var(--status-registered)',
  /** Was on the list: the listed colour, muted, and opaque. */
  'was-listed':
    'color-mix(in srgb, var(--status-registered) 42%, var(--color-surface))',
  /** A request running in its window. */
  pending: 'var(--status-window)',
  court: 'var(--status-contested)',
}

const pulse = keyframes`
  0% { transform: scale(0.8); opacity: 0.6; }
  70%, 100% { transform: scale(2.8); opacity: 0; }
`

const Plot = styled.figure`
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8px;
  min-height: 0;
  margin: 0;

  svg {
    display: block;
    width: 100%;
    overflow: visible;
  }

  /* The lanes wipe in from the left once the plot is in view; the heads
     land after them. */
  .lanes {
    clip-path: inset(-24px 100% -24px -24px);
    transition: clip-path 1200ms cubic-bezier(0.16, 1, 0.3, 1) 150ms;
  }

  &[data-in='true'] .lanes {
    clip-path: inset(-24px -24px -24px -24px);
  }

  .head {
    opacity: 0;
    transition: opacity 420ms cubic-bezier(0.16, 1, 0.3, 1) 1100ms;
  }

  &[data-in='true'] .head {
    opacity: 1;
  }

  .lane {
    transition: opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  &[data-active] .lane:not([data-on]) {
    opacity: 0.32;
  }

  .ping {
    transform-box: fill-box;
    transform-origin: center;
    animation: ${pulse} 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  .hit {
    cursor: pointer;
    outline: none;
    stroke: transparent;
    stroke-width: 1.5;
    transition: stroke 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .hit:focus-visible {
    stroke: var(--color-primary);
  }

  @media (prefers-reduced-motion: reduce) {
    .lanes,
    .head {
      transition: none;
    }

    .ping {
      animation: none;
      opacity: 0;
    }
  }
`

const Axis = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-faint);
  font-size: var(--fs-label);
  line-height: var(--lh-label);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Tip = styled.div`
  position: absolute;
  z-index: 3;
  width: max-content;
  max-width: 300px;
  padding: 10px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  /* The raised tint over a solid surface: never see-through. */
  background:
    linear-gradient(var(--color-raised), var(--color-raised)),
    var(--color-surface);
  box-shadow: var(--shadow-overlay);
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 12px));
  transition:
    left 160ms cubic-bezier(0.16, 1, 0.3, 1),
    top 160ms cubic-bezier(0.16, 1, 0.3, 1);

  b,
  span,
  em {
    display: block;
    overflow: hidden;
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  b {
    color: var(--color-text);
    font-weight: 500;
  }

  span {
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  em {
    margin-top: 4px;
    color: var(--color-primary);
    font-style: normal;
    font-weight: 500;
  }
`

/** Where a lane begins: the earliest stretch it holds. */
export const laneStart = (lane: PlotLane) =>
  Math.min(...lane.segments.map((segment) => segment.start))

/** The lane's right end: its last stretch or mark, running ones at `now`. */
export const laneLatest = (lane: PlotLane, now: number) =>
  Math.max(
    ...lane.segments.map((segment) => segment.end ?? now),
    ...lane.marks.map((mark) => (mark.at === 'now' ? now : mark.at)),
  )

/** The most recently active lanes, then oldest first: a waterfall. */
export const pickLanes = <L extends PlotLane>(
  lanes: L[],
  now: number,
  cap = LANE_CAP,
): L[] => {
  const recent = lanes
    .filter((lane) => lane.segments.length > 0)
    .sort((a, b) => laneLatest(b, now) - laneLatest(a, now))
    .slice(0, cap)
  return recent.sort((a, b) => laneStart(a) - laneStart(b))
}

export function LanePlot<L extends PlotLane>({
  lanes,
  totalLanes,
  now,
  ariaLabel,
  onOpen,
}: {
  /** The lanes to draw, from `pickLanes`. */
  lanes: L[]
  /** Every entry the list holds, drawn or not. */
  totalLanes: number
  now: number
  /** What the drawing measures and over what window. */
  ariaLabel: string
  onOpen?: (lane: L) => void
}) {
  const uid = useId().replace(/:/g, '')
  const [viewRef, inView] = useInView<HTMLElement>()
  const [boxRef, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  // The lane whose dates a touch tap has shown: a second tap opens it.
  const [armed, setArmed] = useState<number | null>(null)
  // The one lane in the tab order; the arrow keys move it.
  const [focusIndex, setFocusIndex] = useState(0)
  const pointerType = useRef('mouse')
  const hits = useRef<(SVGRectElement | null)[]>([])

  if (lanes.length === 0) return null

  const t0 = Math.min(...lanes.map(laneStart))
  const span = Math.max(now - t0, 86400)
  const n = lanes.length
  const plotH = Math.max(112, n * 14)
  const pitch = Math.min(34, plotH / n)
  const top = (plotH - pitch * n) / 2
  const stroke = n <= 4 ? 8 : Math.max(4, Math.min(7, pitch * 0.3))
  const padL = stroke
  const padR = 14
  const plotW = Math.max(0, width - padL - padR)
  const x = (t: number) => padL + ((t - t0) / span) * plotW
  const y = (i: number) => top + i * pitch + pitch / 2

  const open = (index: number) => {
    const lane = lanes[index]
    if (lane && onOpen) onOpen(lane)
  }

  // A mouse opens on the first click (hover already showed the dates); a
  // touch shows the dates on the first tap and opens on the second.
  const onTap = (index: number) => {
    if (pointerType.current === 'touch' && armed !== index) {
      setArmed(index)
      setActive(index)
      return
    }
    open(index)
  }

  const focusLane = (index: number) => {
    const next = Math.min(Math.max(index, 0), n - 1)
    hits.current[next]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        open(index)
        break
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        focusLane(index + 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        focusLane(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusLane(0)
        break
      case 'End':
        event.preventDefault()
        focusLane(n - 1)
        break
      case 'Escape':
        setActive(null)
        break
      default:
    }
  }

  const activeLane = active === null ? undefined : lanes[active]
  const activeTip = activeLane
    ? {
        name: activeLane.name,
        lines: activeLane.lines,
        tapAgain: onOpen && armed === active,
        left: Math.min(
          Math.max(x(laneLatest(activeLane, now)), 130),
          Math.max(130, width - 130),
        ),
        top: y(active ?? 0),
      }
    : undefined

  return (
    <Plot
      ref={viewRef}
      data-in={inView}
      data-active={active === null ? undefined : true}
    >
      <div ref={boxRef} style={{ position: 'relative' }}>
        {width > 0 && (
          <svg
            width={width}
            height={plotH}
            viewBox={`0 0 ${width} ${plotH}`}
            role="group"
            aria-label={ariaLabel}
            onMouseLeave={() => setActive(null)}
          >
            <defs>
              <filter
                id={`glow-${uid}`}
                filterUnits="userSpaceOnUse"
                x={0}
                y={-20}
                width={width}
                height={plotH + 40}
              >
                <feGaussianBlur stdDeviation="3" />
              </filter>
            </defs>
            {/* The active lane's track, to read it across to the axis. */}
            {active !== null && (
              <path
                aria-hidden
                d={`M${padL} ${y(active)}H${padL + plotW}`}
                strokeWidth={1}
                strokeLinecap="round"
                strokeDasharray="2 4"
                style={{ stroke: 'var(--color-border-strong)' }}
              />
            )}
            <g className="lanes" aria-hidden>
              {lanes.map((lane, index) => {
                const cy = y(index)
                return (
                  <g
                    key={lane.id}
                    className="lane"
                    data-on={active === index ? true : undefined}
                  >
                    {lane.segments.map((segment) => {
                      const x0 = x(segment.start)
                      const x1 = Math.max(x(segment.end ?? now), x0 + 0.5)
                      const color = LANE_COLOR[segment.kind]
                      return (
                        <g key={`${segment.kind}-${segment.start}`}>
                          {segment.glow && (
                            <path
                              d={`M${x0} ${cy}H${x1}`}
                              strokeWidth={stroke + 4}
                              strokeLinecap="round"
                              filter={`url(#glow-${uid})`}
                              style={{ stroke: color, opacity: 0.45 }}
                            />
                          )}
                          <path
                            d={`M${x0} ${cy}H${x1}`}
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            style={{ stroke: color }}
                          />
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </g>
            <g className="head" aria-hidden>
              {lanes.map((lane, index) => {
                const cy = y(index)
                return (
                  <g
                    key={lane.id}
                    className="lane"
                    data-on={active === index ? true : undefined}
                  >
                    {lane.marks.map((mark) => {
                      const cx = x(mark.at === 'now' ? now : mark.at)
                      const key = `${mark.kind}-${mark.at}`
                      if (mark.kind === 'status') {
                        const tone = mark.tone ?? 'registered'
                        const color = TONE_COLOR[tone]
                        // A window still running, or a court still sitting.
                        const live = tone === 'window' || tone === 'contested'
                        return (
                          <g key={key}>
                            {live && (
                              <circle
                                className="ping"
                                cx={cx}
                                cy={cy}
                                r={stroke * 0.7}
                                style={{ fill: color }}
                              />
                            )}
                            {tone === 'neutral' && (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={stroke * 1.4}
                                style={{ fill: color, opacity: 0.3 }}
                              />
                            )}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={stroke * 0.85}
                              style={{
                                fill: color,
                                stroke: 'var(--color-surface)',
                                strokeWidth: 1.5,
                              }}
                            />
                          </g>
                        )
                      }
                      if (mark.kind === 'off')
                        return (
                          <circle
                            key={key}
                            cx={cx}
                            cy={cy}
                            r={stroke * 0.8}
                            style={{
                              fill: 'var(--status-off)',
                              stroke: 'var(--color-surface)',
                              strokeWidth: 1.5,
                            }}
                          />
                        )
                      return (
                        <path
                          key={key}
                          d={`M${cx} ${cy - stroke * 0.95}V${cy + stroke * 0.95}`}
                          strokeWidth={2}
                          strokeLinecap="round"
                          style={{ stroke: 'var(--color-muted)' }}
                        />
                      )
                    })}
                  </g>
                )
              })}
            </g>
            {lanes.map((lane, index) => (
              <rect
                key={lane.id}
                ref={(node) => {
                  hits.current[index] = node
                }}
                className="hit"
                x={1}
                y={top + index * pitch + 1}
                width={Math.max(0, width - 2)}
                height={Math.max(0, pitch - 2)}
                rx={6}
                fill="transparent"
                role={onOpen ? 'link' : 'img'}
                tabIndex={index === focusIndex ? 0 : -1}
                aria-label={`${lane.name}. ${lane.lines.join('. ')}.`}
                onPointerDown={(event) => {
                  pointerType.current = event.pointerType
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setActive(index)
                }}
                onFocus={() => {
                  setFocusIndex(index)
                  setActive(index)
                }}
                onBlur={() => {
                  setActive((current) => (current === index ? null : current))
                  setArmed((current) => (current === index ? null : current))
                }}
                onKeyDown={(event) => onKeyDown(event, index)}
                onClick={onOpen ? () => onTap(index) : undefined}
              />
            ))}
          </svg>
        )}
        {!width && <div style={{ height: plotH }} />}
        {activeTip && (
          <Tip style={{ left: activeTip.left, top: activeTip.top }} aria-hidden>
            <b>{activeTip.name}</b>
            {activeTip.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            {activeTip.tapAgain && <em>Tap again to open</em>}
          </Tip>
        )}
      </div>
      <Axis aria-hidden>
        <span>{formatDate(t0)}</span>
        <span>{formatDate(t0 + span / 2)}</span>
        <span>Today</span>
      </Axis>
      {totalLanes > lanes.length && (
        <Label $tone="faint">
          Latest {integer.format(lanes.length)} of {integer.format(totalLanes)}
        </Label>
      )}
    </Plot>
  )
}
