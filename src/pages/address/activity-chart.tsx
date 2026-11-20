import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import styled, { keyframes } from 'styled-components'

/*
 * The address's actions over time, drawn like the home page's activity wave:
 * submissions and removal requests as a glowing area above the baseline,
 * challenges as amber bars mirrored below it. Each half has its own scale,
 * labelled inside the plot at the right like the home page's ("100
 * requests" over the top, "5 challenges" at the bottom); a half with nothing
 * in the window keeps its room and says "no challenges" rather than a scale.
 * A scanner reveal sweeps in once the chart is in view and the head at the
 * newest bucket arrives with the line; it pings only when that bucket holds
 * actions. Hover snaps a crosshair to a bucket and reads both counts in a
 * tooltip beside it, at the hovered value's height, so it never hides the
 * point it reads. Reduced motion shows the final state.
 */

const scan = keyframes`
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
`

const ping = keyframes`
  0% { transform: scale(1); opacity: 0.7; }
  70%, 100% { transform: scale(4.2); opacity: 0; }
`

const arrive = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const Wrap = styled.div`
  position: relative;
  width: 100%;
  touch-action: pan-y;
`

const Svg = styled.svg`
  display: block;
  width: 100%;
  overflow: visible;

  .reveal {
    clip-path: inset(0 100% 0 0);
  }

  &[data-in='true'] .reveal {
    animation: ${scan} 1400ms cubic-bezier(0.65, 0, 0.35, 1) both;
  }

  /* The head waits for the scan to reach the right edge. */
  .head {
    opacity: 0;
  }

  &[data-in='true'] .head {
    animation: ${arrive} 320ms ease-out 1280ms both;
  }

  .ping {
    transform-box: fill-box;
    transform-origin: center;
    animation: ${ping} 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  text {
    font-family: var(--font-figure);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    fill: var(--color-faint);
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal,
    &[data-in='true'] .reveal {
      clip-path: none;
      animation: none;
    }

    .head,
    &[data-in='true'] .head {
      opacity: 1;
      animation: none;
    }

    .ping {
      animation: none;
      opacity: 0;
    }
  }
`

const Tip = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  /* Its own width wherever it sits, so the measured size is the real one. */
  width: max-content;
  min-width: 168px;
  padding: 10px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: var(--color-surface);
  box-shadow: var(--shadow-overlay);
  pointer-events: none;
  transition:
    left 160ms cubic-bezier(0.16, 1, 0.3, 1),
    top 160ms cubic-bezier(0.16, 1, 0.3, 1);
  font-size: 12px;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  b {
    display: block;
    margin-bottom: 8px;
    color: var(--color-text);
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
  }

  div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    color: var(--color-muted);
  }

  div + div {
    margin-top: 4px;
  }

  i {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 8px;
    border-radius: var(--radius-pill);
  }

  span:last-child {
    color: var(--color-text);
    font-size: 13px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

const Axis = styled.div`
  position: relative;
  height: 16px;
  margin-top: 4px;
  color: var(--color-faint);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;

  span {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
  }

  span:first-child {
    transform: none;
  }

  span:last-child {
    transform: translateX(-100%);
  }
`

/** Monotone cubic (Fritsch–Carlson): never overshoots, never dips below zero. */
const monotonePath = (pts: [number, number][]) => {
  const n = pts.length
  if (n < 2) return ''
  const dx: number[] = []
  const m: number[] = []
  const t: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0]
    m[i] = dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i]
  }
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      t[i] = 0
      continue
    }
    const w1 = 2 * dx[i] + dx[i - 1]
    const w2 = dx[i] + 2 * dx[i - 1]
    t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i])
  }
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${
      pts[i + 1][1] - t[i + 1] * h
    } ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

/**
 * A round top for the scale (5, then the next whole step of the leading
 * digit: 80, 100, 200…), the same rule as the home page's activity wave so
 * the two charts read alike.
 */
const niceMax = (max: number) => {
  if (max <= 5) return 5
  const pow = 10 ** Math.floor(Math.log10(max))
  return Math.ceil(max / pow) * pow
}

/** Room at the right edge so the head and its ping stay inside the frame. */
const GUTTER = 8
/** Room under the challenge bars for the bottom scale label. */
const LABEL_ROOM = 16
/** Gap between the crosshair and the tooltip. */
const TIP_GAP = 14

export const ActivityChart = ({
  labels,
  axisLabels = labels,
  requests,
  challenges,
  height = 220,
  ariaLabel,
}: {
  /** One label per bucket, oldest first (tooltip). */
  labels: string[]
  /** Shorter labels for the axis; defaults to `labels`. */
  axisLabels?: string[]
  /** Submissions and removal requests per bucket. */
  requests: number[]
  /** Challenges per bucket. */
  challenges: number[]
  height?: number
  ariaLabel: string
}) => {
  const id = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const [inView, setInView] = useState(false)
  const tipRef = useRef<HTMLDivElement>(null)
  const [tipSize, setTipSize] = useState({ width: 176, height: 84 })

  useEffect(() => {
    const node = ref.current
    if (!node) return
    // A zero width (the block hidden or mid-relayout for a moment) keeps the
    // last real one: dropping the plot would replay its draw-in from nothing.
    const measure = (next: number) => {
      if (next > 0) setWidth(Math.round(next))
    }
    measure(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

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

  // The tooltip's real size, so it can sit beside the crosshair and inside
  // the chart at any width.
  useLayoutEffect(() => {
    const node = tipRef.current
    if (hover === null || !node) return
    const next = { width: node.offsetWidth, height: node.offsetHeight }
    setTipSize((size) =>
      size.width === next.width && size.height === next.height ? size : next,
    )
  }, [hover])

  const count = labels.length
  const w = Math.max(width, 240)
  const plotW = w - GUTTER
  const mid = Math.round(height * 0.7)
  const top = 18
  const bottom = height - 4
  // Challenge bars stop short of the bottom label.
  const barsEnd = bottom - LABEL_ROOM
  const upTotal = requests.reduce((sum, v) => sum + v, 0)
  const downTotal = challenges.reduce((sum, v) => sum + v, 0)
  const upMax = niceMax(Math.max(1, ...requests))
  const downMax = niceMax(Math.max(1, ...challenges))
  const x = (i: number) => (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW)
  const yUp = (v: number) => mid - (v / upMax) * (mid - top)
  const yDown = (v: number) => mid + 4 + (v / downMax) * (barsEnd - mid - 4)
  const pts = requests.map((v, i) => [x(i), yUp(v)] as [number, number])
  const line = monotonePath(pts)
  const area = line ? `${line}L${plotW},${mid}L0,${mid}Z` : ''
  const barW = Math.max(3, Math.min(12, (plotW / Math.max(1, count)) * 0.46))
  const head = pts[pts.length - 1]
  // Live only when the newest bucket (the one holding now) has actions.
  const live = (requests[count - 1] ?? 0) + (challenges[count - 1] ?? 0) > 0
  // A half with nothing in the window names no scale, only the absence.
  const upScale = upTotal > 0 ? `${upMax} requests` : 'no requests'
  const downScale = downTotal > 0 ? `${downMax} challenges` : 'no challenges'

  // The tooltip sits beside the crosshair (left of it on the right half) at
  // the height of the value it reads. When neither side has room (a narrow
  // chart, a bucket near the middle) it sits above the point, or below it
  // near the top; either way the point it reads stays in view.
  const placeTip = (index: number) => {
    const { width: tw, height: th } = tipSize
    const at = x(index)
    const y = yUp(requests[index] ?? 0)
    const clampTop = (value: number) =>
      Math.max(0, Math.min(height - th, value))
    const before = at - TIP_GAP - tw
    const after = at + TIP_GAP
    const sides = at > plotW / 2 ? [before, after] : [after, before]
    const side = sides.find((left) => left >= 0 && left + tw <= w)
    if (side !== undefined) return { left: side, top: clampTop(y - th / 2) }
    return {
      left: Math.max(0, Math.min(w - tw, at - tw / 2)),
      top: clampTop(y - TIP_GAP - th >= 0 ? y - TIP_GAP - th : y + TIP_GAP),
    }
  }
  const tip = hover === null ? undefined : placeTip(hover)

  const onMove = (event: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box || count < 2) return
    const ratio = (event.clientX - box.left) / Math.max(1, box.width - GUTTER)
    setHover(Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1)))))
  }

  const step = Math.max(1, Math.ceil(count / (plotW < 520 ? 3 : 6)))
  const ticks = axisLabels
    .map((label, index) => ({ label, index }))
    .filter(
      ({ index }) =>
        index === 0 ||
        index === count - 1 ||
        (index % step === 0 && count - 1 - index >= step / 2),
    )

  return (
    <Wrap
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={ariaLabel}
    >
      {width > 0 && (
        <Svg
          viewBox={`0 0 ${w} ${height + 4}`}
          style={{ height: height + 4 }}
          data-in={inView}
          aria-hidden
        >
          <defs>
            <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                style={{ stopColor: 'var(--color-primary)' }}
                stopOpacity="0.3"
              />
              <stop
                offset="70%"
                style={{ stopColor: 'var(--color-primary)' }}
                stopOpacity="0.06"
              />
              <stop
                offset="100%"
                style={{ stopColor: 'var(--color-primary)' }}
                stopOpacity="0"
              />
            </linearGradient>
            <linearGradient
              id={`line-${id}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={plotW}
              y2="0"
            >
              <stop
                offset="0%"
                style={{ stopColor: 'var(--color-primary)' }}
                stopOpacity="0.2"
              />
              <stop
                offset="30%"
                style={{ stopColor: 'var(--color-primary)' }}
                stopOpacity="0.65"
              />
              <stop
                offset="100%"
                style={{ stopColor: 'var(--color-primary)' }}
                stopOpacity="1"
              />
            </linearGradient>
            <linearGradient id={`bar-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                style={{ stopColor: 'var(--status-contested)' }}
                stopOpacity="0.95"
              />
              <stop
                offset="100%"
                style={{ stopColor: 'var(--status-contested)' }}
                stopOpacity="0.3"
              />
            </linearGradient>
            <radialGradient id={`bloom-${id}`}>
              <stop
                offset="0%"
                style={{ stopColor: 'var(--color-primary)' }}
                stopOpacity="0.5"
              />
              <stop
                offset="100%"
                style={{ stopColor: 'var(--color-primary)' }}
                stopOpacity="0"
              />
            </radialGradient>
            <filter
              id={`glow-${id}`}
              filterUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={w}
              height={height + 4}
            >
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* The scale of each half, inside the plot at the right: the top
              of the upper half over it, the bottom of the lower half under
              its bars. The baseline is the zero of both. */}
          <g aria-hidden>
            <text x={plotW} y={top - 7} textAnchor="end">
              {upScale}
            </text>
            <text x={plotW} y={bottom} textAnchor="end">
              {downScale}
            </text>
          </g>

          <g className="reveal">
            <path d={area} fill={`url(#area-${id})`} />
            <path
              d={line}
              fill="none"
              stroke={`url(#line-${id})`}
              strokeWidth="6"
              strokeOpacity="0.35"
              filter={`url(#glow-${id})`}
            />
            <path
              d={line}
              fill="none"
              stroke={`url(#line-${id})`}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {challenges.map((v, i) =>
              v > 0 ? (
                <rect
                  key={i}
                  x={x(i) - barW / 2}
                  y={mid + 4}
                  width={barW}
                  height={Math.max(3, yDown(v) - mid - 4)}
                  rx={Math.min(3, barW / 2)}
                  fill={`url(#bar-${id})`}
                />
              ) : null,
            )}
          </g>

          <line
            x1="0"
            x2={plotW}
            y1={mid}
            y2={mid}
            style={{ stroke: 'var(--color-border-strong)' }}
          />

          {head && (
            <g className="head">
              <circle
                cx={head[0]}
                cy={head[1]}
                r="28"
                fill={`url(#bloom-${id})`}
              />
              {live && (
                <circle
                  className="ping"
                  cx={head[0]}
                  cy={head[1]}
                  r="4"
                  fill="none"
                  strokeWidth="1.5"
                  style={{ stroke: 'var(--color-primary)' }}
                />
              )}
              <circle
                cx={head[0]}
                cy={head[1]}
                r="4.5"
                strokeWidth="2.5"
                style={{
                  fill: 'var(--color-surface)',
                  stroke: 'var(--color-primary)',
                }}
              />
            </g>
          )}

          {hover !== null && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={top}
                y2={bottom}
                style={{ stroke: 'var(--color-border-strong)' }}
              />
              <circle
                cx={x(hover)}
                cy={yUp(requests[hover] ?? 0)}
                r="4"
                strokeWidth="2"
                style={{
                  fill: 'var(--color-text)',
                  stroke: 'var(--color-primary)',
                }}
              />
            </g>
          )}
        </Svg>
      )}

      {hover !== null && tip && width > 0 && (
        <Tip ref={tipRef} style={{ left: tip.left, top: tip.top }}>
          <b>{labels[hover]}</b>
          <div>
            <span>
              <i style={{ background: 'var(--color-primary)' }} />
              Submissions and removals
            </span>
            <span>{requests[hover] ?? 0}</span>
          </div>
          <div>
            <span>
              <i style={{ background: 'var(--status-contested)' }} />
              Challenges
            </span>
            <span>{challenges[hover] ?? 0}</span>
          </div>
        </Tip>
      )}

      <Axis aria-hidden>
        {ticks.map(({ label, index }) => (
          <span
            key={`${label}-${index}`}
            style={{ left: `${(x(index) / w) * 100}%` }}
          >
            {label}
          </span>
        ))}
      </Axis>
    </Wrap>
  )
}

export default ActivityChart
