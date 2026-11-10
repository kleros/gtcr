import React, { useEffect, useId, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { Label } from 'components/curate/primitives'
import { formatDuration } from 'utils/time'
import { useInView } from './use-in-view'

/*
 * The life of one entry under a list type's default periods, drawn to scale
 * on a time axis shared by every drawing on the page (see `axisScale`), as
 * three lanes: its status, when anyone can challenge it, and while the
 * submitter's funds are locked. Only the open-ended listed phase is cut
 * short, with an axis break; every timed window carries its duration. The
 * SVG is drawn in real pixels from the measured width, so its text keeps its
 * size on a phone; labels that would collide move or give way (the
 * aria-label always tells the whole story). It sweeps in once it is in view.
 */

export type LifeTone = 'window' | 'registered' | 'neutral'

export type LifePhase = {
  label: string
  tone: LifeTone
  /** Length in seconds. Leave it out for the open-ended listed phase. */
  duration?: number
  /** Happens only if someone acts: drawn dotted, from a hollow node. */
  optional?: boolean
  /** What starts an optional phase, longest wording first. */
  note?: string[]
  /** Anyone can challenge the entry during this phase. */
  challengeable?: boolean
}

export type LifecycleSpec = {
  phases: LifePhase[]
  /** The state the last phase ends in. */
  endLabel?: string
  /** The submitter's funds: locked from submission to the end of phase `until`. */
  funds: { lane: string; until: number; label: string }
  /** The whole story, for screen readers. */
  description: string
}

/** Share of the axis the open-ended phase keeps on the longest drawing. */
const OPEN_SHARE = 0.4

const timedTotal = (spec: LifecycleSpec) =>
  spec.phases.reduce((sum, phase) => sum + (phase.duration ?? 0), 0)

/**
 * Axis units per second, common to every drawing passed in, so the same
 * duration has the same length in each of them.
 */
export const axisScale = (specs: LifecycleSpec[]) => {
  const longest = Math.max(0, ...specs.map(timedTotal))
  return longest > 0 ? (1 - OPEN_SHARE) / longest : 0
}

const SPEED = 1500 // ms for a sweep across the whole axis
const LANE_LAG = 130 // ms between lanes
const PAD = 8
const GAP = 8 // minimum space between two labels on a row
const LINE = 14 // line height of a wrapped label

// Rows. HTML lane names sit at *_TOP; SVG text rows are baselines.
const NAME_1_TOP = 0
const ROW_A = 12
const STATUS_Y = 32
const PHASE_Y = 55
const NAME_2_TOP = 78
const BAND_Y = 106
const NAME_3_TOP = 124
const ROW_3 = 136
const FUNDS_Y = 152
const HEIGHT = 164

type FontKind = 'phase' | 'optional' | 'note' | 'duration' | 'lane'
const FONT: Record<FontKind, { weight: number; size: number }> = {
  phase: { weight: 500, size: 12.5 },
  optional: { weight: 400, size: 12.5 },
  note: { weight: 400, size: 12 },
  duration: { weight: 500, size: 11 },
  lane: { weight: 500, size: 11 },
}

let measureCanvas: HTMLCanvasElement | undefined
const measure = (text: string, font: string) => {
  const fallback = text.length * 7
  if (typeof document === 'undefined') return fallback
  measureCanvas ??= document.createElement('canvas')
  const context = measureCanvas.getContext('2d')
  if (!context) return fallback
  context.font = font
  return context.measureText(text).width
}

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

const travel = keyframes`
  from { opacity: 1; transform: translateX(var(--x0)); }
  to { opacity: 1; transform: translateX(var(--x1)); }
`

const vanish = keyframes`
  from { opacity: 1; transform: translateX(var(--x1)); }
  to { opacity: 0; transform: translateX(var(--x1)); }
`

const Figure = styled.figure`
  margin: 0;
  min-width: 0;
`

const Caption = styled.figcaption`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  span:last-child {
    color: var(--color-faint);
    font-size: 12px;
    line-height: 16px;
  }
`

const Canvas = styled.div`
  position: relative;
  width: 100%;
  height: ${HEIGHT}px;
`

const LaneName = styled(Label)`
  position: absolute;
  left: ${PAD - 4}px;
  white-space: nowrap;
`

const Svg = styled.svg`
  /* Out of flow: its measured width must never widen the card. */
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: ${HEIGHT}px;
  overflow: visible;

  /* Nothing shows before the sweep; each piece reads --d (delay) and --t (duration). */
  .draw {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }

  .pop,
  .fade,
  .head {
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

    .head {
      animation:
        ${travel} var(--t) linear var(--d) forwards,
        ${vanish} 380ms ease-out calc(var(--d) + var(--t)) forwards;
    }
  }

  text {
    font-family: var(--font-sans);
  }

  .phase {
    fill: var(--color-text);
    font-size: ${FONT.phase.size}px;
    font-weight: ${FONT.phase.weight};
  }

  .optional {
    fill: var(--color-muted);
    font-size: ${FONT.optional.size}px;
    font-weight: ${FONT.optional.weight};
  }

  .note {
    fill: var(--color-muted);
    font-size: ${FONT.note.size}px;
    font-weight: ${FONT.note.weight};
  }

  .duration {
    fill: var(--color-muted);
    font-family: var(--font-figure);
    font-size: ${FONT.duration.size}px;
    font-weight: ${FONT.duration.weight};
    font-variant-numeric: tabular-nums;
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

    .head,
    &[data-armed] .head {
      display: none;
    }
  }
`

const toneColor = (tone: LifeTone) => `var(--status-${tone})`

type Anchor = 'start' | 'end'
type Option = { y: number; x: number; anchor: Anchor; lines: string[] }
type Candidate = {
  key: string
  className: string
  font: FontKind
  options: Option[]
  style: React.CSSProperties
}
type Box = { y: number; x0: number; x1: number }

/** "Removal requested" → ["Removal", "requested"], split nearest the middle. */
const wrap = (text: string): string[] | undefined => {
  const spaces = [...text.matchAll(/ /g)].map((match) => match.index ?? 0)
  if (spaces.length === 0) return undefined
  const cut = spaces.reduce((best, index) =>
    Math.abs(index - text.length / 2) < Math.abs(best - text.length / 2)
      ? index
      : best,
  )
  return [text.slice(0, cut), text.slice(cut + 1)]
}

export const Lifecycle = ({
  spec,
  scale,
  delay = 160,
}: {
  spec: LifecycleSpec
  /** Axis units per second, from `axisScale` over every drawing on the page. */
  scale: number
  /** ms before the sweep, counted from mount, so the card lands first. */
  delay?: number
}) => {
  const id = useId().replace(/:/g, '')
  const [ref, inView] = useInView<HTMLDivElement>(0.35)
  const [width, setWidth] = useState(0)
  const [families, setFamilies] = useState({ sans: '', figure: '' })
  const mountedAt = useRef(performance.now())
  const [start, setStart] = useState<number>()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(Math.round(node.getBoundingClientRect().width))
    const readFonts = () => {
      const style = getComputedStyle(node)
      setFamilies({
        sans: style.getPropertyValue('--font-sans').trim() || 'sans-serif',
        figure:
          style.getPropertyValue('--font-figure').trim() ||
          style.getPropertyValue('--font-sans').trim() ||
          'sans-serif',
      })
    }
    readFonts()
    // Measure again once the webfonts have swapped in.
    let live = true
    document.fonts?.ready.then(() => live && readFonts())
    if (typeof ResizeObserver === 'undefined')
      return () => {
        live = false
      }
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    )
    observer.observe(node)
    return () => {
      live = false
      observer.disconnect()
    }
  }, [ref])

  // Arm the sweep once in view; if that is right after mount, still let
  // the card land first.
  useEffect(() => {
    if (!inView || start !== undefined) return
    setStart(
      Math.max(
        150,
        Math.round(delay - (performance.now() - mountedAt.current)),
      ),
    )
  }, [inView, start, delay])

  /* ---------- Geometry ---------- */

  const timed = timedTotal(spec) * scale
  const openCount = spec.phases.filter((p) => p.duration === undefined).length
  const openLength = openCount ? Math.max(0, 1 - timed) / openCount : 0
  let cursor = 0
  const spans = spec.phases.map((phase) => {
    const length =
      phase.duration === undefined ? openLength : phase.duration * scale
    const span = { ...phase, from: cursor, to: cursor + length }
    cursor += length
    return span
  })
  const axisEnd = cursor
  const breaks = spans
    .filter((p) => p.duration === undefined)
    .map((p) => (p.from + p.to) / 2)

  const x = (f: number) => PAD + f * (width - PAD * 2)
  const base = start ?? 0
  /** Timing for an element whose left edge is at `f` on lane `lane`. */
  const timing = (f: number, lane: number, length = 0) =>
    ({
      '--d': `${Math.round(base + lane * LANE_LAG + f * SPEED)}ms`,
      '--t': `${Math.max(1, Math.round(length * SPEED))}ms`,
    }) as React.CSSProperties

  // Challenge windows: runs of consecutive challengeable phases. A run made
  // only of optional phases is dashed (it opens only if someone acts).
  const runs: { from: number; to: number; optional: boolean }[] = []
  spans.forEach((span, index) => {
    if (!span.challengeable) return
    const previous = runs[runs.length - 1]
    if (previous && spans[index - 1]?.challengeable) {
      previous.to = span.to
      previous.optional = previous.optional && !!span.optional
    } else
      runs.push({ from: span.from, to: span.to, optional: !!span.optional })
  })
  const sweep = runs.find((run) => !run.optional)

  const release = spans[Math.min(spec.funds.until, spans.length - 1)]?.to ?? 0
  const fundsEnd = x(release)

  /* ---------- Labels, placed so they never collide ---------- */

  const font = (kind: FontKind) =>
    `${FONT[kind].weight} ${FONT[kind].size}px ${
      kind === 'duration' ? families.figure : families.sans
    }`
  const widthOf = (text: string, kind: FontKind) =>
    kind === 'lane'
      ? measure(text.toUpperCase(), font(kind)) + text.length * 0.66
      : measure(text, font(kind))

  const fixed: Box[] = [
    { y: ROW_A, x0: 0, x1: PAD - 4 + widthOf('Status', 'lane') },
    { y: ROW_3, x0: 0, x1: PAD - 4 + widthOf(spec.funds.lane, 'lane') },
  ]

  const placed: Box[] = [...fixed]
  const labels: (Candidate & { option: Option })[] = []
  const boxesOf = (candidate: Candidate, option: Option): Box[] => {
    const w = Math.max(...option.lines.map((l) => widthOf(l, candidate.font)))
    const x0 = option.anchor === 'start' ? option.x : option.x - w
    return option.lines.map((_, i) => ({
      y: option.y + i * LINE,
      x0,
      x1: x0 + w,
    }))
  }
  const fits = (boxes: Box[], against: Box[]) =>
    boxes.every(
      (box) =>
        box.x0 >= 0 &&
        box.x1 <= width &&
        !against.some(
          (other) =>
            other.y === box.y &&
            box.x0 < other.x1 + GAP &&
            other.x0 < box.x1 + GAP,
        ),
    )
  /** Places the candidate at its first option that fits, if any does. */
  const place = (candidate: Candidate, options = candidate.options) => {
    if (width <= 0) return false
    const option = options.find((o) => fits(boxesOf(candidate, o), placed))
    if (!option) return false
    placed.push(...boxesOf(candidate, option))
    labels.push({ ...candidate, option })
    return true
  }

  // 1. Phase names under their nodes: required phases first.
  const phaseCandidate = (span: (typeof spans)[number], index: number) => {
    const wrapped = wrap(span.label)
    const anchorX = x(span.from) - 4
    return {
      key: `phase-${index}`,
      className: span.optional ? 'optional fade' : 'phase fade',
      font: span.optional ? 'optional' : 'phase',
      options: [
        { y: PHASE_Y, x: anchorX, anchor: 'start', lines: [span.label] },
        ...(wrapped
          ? [{ y: PHASE_Y, x: anchorX, anchor: 'start', lines: wrapped }]
          : []),
        { y: PHASE_Y, x: x(span.to) + 4, anchor: 'end', lines: [span.label] },
      ],
      style: timing(span.from, 0),
    } as Candidate
  }
  spans.forEach((span, index) => {
    if (!span.optional) place(phaseCandidate(span, index))
  })
  spans.forEach((span, index) => {
    if (span.optional) place(phaseCandidate(span, index))
  })

  // 2. The release of the funds: beside its node, or above the lane.
  place({
    key: 'funds',
    className: 'note fade',
    font: 'note',
    options: [
      {
        y: FUNDS_Y + 4,
        x: fundsEnd + 14,
        anchor: 'start',
        lines: [spec.funds.label],
      },
      { y: ROW_3, x: fundsEnd + 4, anchor: 'end', lines: [spec.funds.label] },
    ],
    style: timing(release, 2),
  })

  // 3. The end state under its node, else above it. It outranks the notes:
  // a note shortens to leave it room and drops out where even its shortest
  // wording does not fit (the dotted line and hollow node still mark the
  // phase as optional, and the aria-label tells it).
  const end: Candidate | undefined = spec.endLabel
    ? {
        key: 'end',
        className: 'optional fade',
        font: 'optional',
        options: [
          {
            y: PHASE_Y,
            x: x(axisEnd) + 4,
            anchor: 'end',
            lines: [spec.endLabel],
          },
          {
            y: ROW_A,
            x: x(axisEnd) + 4,
            anchor: 'end',
            lines: [spec.endLabel],
          },
        ],
        style: timing(axisEnd, 0),
      }
    : undefined
  if (end) place(end)
  spans.forEach((span, index) => {
    if (!span.optional || !span.note?.length) return
    place({
      key: `note-${index}`,
      className: 'note fade',
      font: 'note',
      options: span.note.map((text) => ({
        y: ROW_A,
        x: x(span.from) - 4,
        anchor: 'start' as const,
        lines: [text],
      })),
      style: timing(span.from, 0),
    })
  })

  /* ---------- Status segments, with each timed window's duration ---------- */

  const hasNodeAt = (index: number) =>
    index < spans.length - 1 || !!spec.endLabel
  const segments = spans.flatMap((span, index) => {
    const x1 = x(span.from) + 9
    const x2 = x(span.to) - (hasNodeAt(index) ? 9 : 0)
    const stroke = {
      fill: 'none',
      stroke: toneColor(span.tone),
      strokeWidth: 3,
      strokeLinecap: 'round' as const,
      strokeDasharray: span.optional ? '1 6' : undefined,
      className: span.optional ? 'fade' : 'draw',
      pathLength: span.optional ? undefined : 1,
    }
    const text =
      span.duration !== undefined ? formatDuration(span.duration) : undefined
    const textWidth = text ? widthOf(text, 'duration') : 0
    // The duration sits on the line between the two nodes; on a narrow
    // drawing the line gives way to it, and only if even the text does not
    // fit is the window drawn bare (its duration stays in the aria-label).
    if (!text || textWidth + 4 > x2 - x1)
      return [
        <path
          key={`seg-${index}`}
          d={`M${x1} ${STATUS_Y} H${Math.max(x1 + 1, x2)}`}
          {...stroke}
          style={timing(span.from, 0, span.to - span.from)}
        />,
      ]
    const middle = (x1 + x2) / 2
    const left = middle - textWidth / 2 - 6
    const right = middle + textWidth / 2 + 6
    const midF = (span.from + span.to) / 2
    const pieces = left - x1 >= 4
    return [
      pieces && (
        <path
          key={`seg-${index}-a`}
          d={`M${x1} ${STATUS_Y} H${left}`}
          {...stroke}
          style={timing(span.from, 0, midF - span.from)}
        />
      ),
      <text
        key={`seg-${index}-t`}
        className="duration fade"
        x={middle}
        y={STATUS_Y + 4}
        textAnchor="middle"
        style={timing(midF, 0)}
      >
        {text}
      </text>,
      pieces && (
        <path
          key={`seg-${index}-b`}
          d={`M${right} ${STATUS_Y} H${x2}`}
          {...stroke}
          style={timing(midF, 0, span.to - midF)}
        />
      ),
    ]
  })

  const last = spans[spans.length - 1]
  const covered = (f: number) =>
    runs.some((run) => !run.optional && run.from < f && run.to > f)

  return (
    <Figure>
      <Caption>
        <Label $tone="faint">Life of an entry</Label>
        <span>Default periods, to scale</span>
      </Caption>
      <Canvas ref={ref}>
        <div aria-hidden>
          <LaneName $tone="faint" style={{ top: NAME_1_TOP }}>
            Status
          </LaneName>
          <LaneName $tone="faint" style={{ top: NAME_2_TOP }}>
            Open to challenge
          </LaneName>
          <LaneName $tone="faint" style={{ top: NAME_3_TOP }}>
            {spec.funds.lane}
          </LaneName>
        </div>
        {width > 0 && (
          <Svg
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={spec.description}
            data-armed={start !== undefined ? '' : undefined}
          >
            {/* Lane 1: status */}
            {segments}
            {spans.map((span, index) => (
              <g
                key={`node-${index}`}
                className="pop"
                style={timing(span.from, 0)}
              >
                <circle
                  cx={x(span.from)}
                  cy={STATUS_Y}
                  r={8}
                  fill={toneColor(span.tone)}
                  fillOpacity={span.optional ? 0.12 : 0.22}
                />
                <circle
                  cx={x(span.from)}
                  cy={STATUS_Y}
                  r={4.5}
                  fill={
                    span.optional
                      ? 'var(--color-surface)'
                      : toneColor(span.tone)
                  }
                  stroke={toneColor(span.tone)}
                  strokeWidth={span.optional ? 1.5 : 0}
                />
              </g>
            ))}
            {spec.endLabel && last && (
              <circle
                className="pop"
                cx={x(axisEnd)}
                cy={STATUS_Y}
                r={4.5}
                fill="var(--color-surface)"
                stroke={toneColor(last.tone)}
                strokeWidth={1.5}
                style={timing(axisEnd, 0)}
              />
            )}

            {/* Lane 2: open to challenge */}
            {runs.map((run) =>
              run.optional ? (
                <rect
                  key={`run-${run.from}`}
                  className="fade"
                  x={x(run.from) - 5}
                  y={BAND_Y - 5}
                  width={x(run.to) - x(run.from) + 10}
                  height={10}
                  rx={5}
                  fill="var(--status-window-soft)"
                  stroke="var(--status-window)"
                  strokeWidth={1.25}
                  strokeDasharray="3 3"
                  style={timing(run.from, 1)}
                />
              ) : (
                <path
                  key={`run-${run.from}`}
                  className="draw"
                  d={`M${x(run.from)} ${BAND_Y} H${x(run.to)}`}
                  pathLength={1}
                  fill="none"
                  stroke="var(--status-window)"
                  strokeWidth={10}
                  strokeLinecap="round"
                  style={timing(run.from, 1, run.to - run.from)}
                />
              ),
            )}
            {sweep && (
              <g
                className="head"
                style={
                  {
                    ...timing(sweep.from, 1, sweep.to - sweep.from),
                    '--x0': `${x(sweep.from)}px`,
                    '--x1': `${x(sweep.to)}px`,
                  } as React.CSSProperties
                }
              >
                <circle cx={0} cy={BAND_Y} r={9} fill={`url(#bloom-${id})`} />
                <circle
                  cx={0}
                  cy={BAND_Y}
                  r={3}
                  fill="var(--color-on-primary)"
                />
              </g>
            )}
            <defs>
              <radialGradient id={`bloom-${id}`}>
                <stop offset="0%" stopColor="var(--status-window)" />
                <stop
                  offset="100%"
                  stopColor="var(--status-window)"
                  stopOpacity={0}
                />
              </radialGradient>
            </defs>

            {/* Lane 3: the submitter's funds */}
            <path
              className="draw"
              d={`M${x(0)} ${FUNDS_Y} H${fundsEnd - 8}`}
              pathLength={1}
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth={2}
              strokeLinecap="round"
              style={timing(0, 2, release)}
            />
            <circle
              className="pop"
              cx={x(0)}
              cy={FUNDS_Y}
              r={3.5}
              fill="var(--color-muted)"
              style={timing(0, 2)}
            />
            <g className="pop" style={timing(release, 2)}>
              <circle
                cx={fundsEnd}
                cy={FUNDS_Y}
                r={8}
                fill="var(--status-registered)"
                fillOpacity={0.22}
              />
              <circle
                cx={fundsEnd}
                cy={FUNDS_Y}
                r={4.5}
                fill="var(--status-registered)"
              />
            </g>

            {/* The cut in the axis, on every lane that runs through it. */}
            {breaks.flatMap((f) =>
              [
                STATUS_Y,
                covered(f) ? BAND_Y : undefined,
                release > f ? FUNDS_Y : undefined,
              ].map((y, lane) =>
                y === undefined ? null : (
                  <g
                    key={`cut-${f}-${lane}`}
                    className="fade"
                    style={timing(f, lane)}
                  >
                    <rect
                      x={x(f) - 5}
                      y={y - 10}
                      width={10}
                      height={20}
                      fill="var(--color-surface)"
                    />
                    <path
                      d={`M${x(f) - 6} ${y + 7} L${x(f) - 1} ${y - 7} M${x(f) + 1} ${y + 7} L${x(f) + 6} ${y - 7}`}
                      fill="none"
                      stroke="var(--color-faint)"
                      strokeWidth={1.25}
                      strokeLinecap="round"
                    />
                  </g>
                ),
              ),
            )}

            {/* Phase names, notes, the end state and the release. */}
            {labels.map(({ key, className, option, style }) => (
              <text
                key={key}
                className={className}
                x={option.x}
                y={option.y}
                textAnchor={option.anchor}
                style={style}
              >
                {option.lines.length === 1
                  ? option.lines[0]
                  : option.lines.map((line, index) => (
                      <tspan
                        key={line}
                        x={option.x}
                        dy={index === 0 ? 0 : LINE}
                      >
                        {line}
                      </tspan>
                    ))}
              </text>
            ))}
          </Svg>
        )}
      </Canvas>
    </Figure>
  )
}

export default Lifecycle
