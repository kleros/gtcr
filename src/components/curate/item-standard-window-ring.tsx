import React, { useEffect, useId, useRef } from 'react'
import styled, { keyframes } from 'styled-components'
import { formatAbsolute, formatDuration, windowProgress } from 'utils/time'
import { Label } from './primitives'

/*
 * The item page's countdown ring: a 270° open arc with the gap at the
 * bottom, the geometry of the motion kit's RingGauge, so the app has one
 * ring language. The arc's left end is where the window opened and its
 * right end — a fixed, labelled point — is where it closes. The lit part is
 * the time still left: it runs from the head (now, the only part that
 * glows) to that close, so it visibly shortens as the head converges on the
 * finish, and the crown of ticks it covers goes out behind it.
 *
 * So everything lit here is time still left, the crown included — the
 * opposite side from the kit's RingGauge, where the arc is a value filling
 * up and the crown lights behind the head as that value grows. The two read
 * opposite because they measure opposite things (a remainder, not a
 * progress), and each is lit on one side only: a countdown that dimmed as
 * its arc shrank on one side and brightened on the other would be the kind
 * of double encoding point 5 asked us to remove.
 *
 * Round 2 of the design review: the old ring was a closed circle whose open
 * and close were the same point at 12 o'clock, so there was no zero to read
 * the remainder against, and its day/hour ticks were a scale nobody could
 * decode. Both ends now carry their own absolute UTC, the label above the
 * dial names the window and nothing else, and the window's length is one
 * caption line, so no second duration competes with the figure in the
 * middle (the time left to the deadline that matters).
 */

const C = 120
const R = 88
const W = 16
const START = -135
const SWEEP = 270
const TICKS = 54

/** A point at `deg` from 12 o'clock, clockwise, on a circle of radius r. */
const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) }
}

const arcPath = (r: number, a0: number, a1: number) => {
  const from = polar(r, a0)
  const to = polar(r, a1)
  return `M${from.x} ${from.y}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${to.x} ${to.y}`
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const urgentPulse = keyframes`
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.2; transform: scale(1.35); }
`

/* The dial's size lives here, so the end labels under the arc line up with
   the arc's own ends instead of the column's edges. */
const Wrap = styled.figure<{ $size: number }>`
  --dial: ${({ $size }) => $size}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 0;
  min-width: 0;

  @media (max-width: 720px) {
    --dial: ${({ $size }) => Math.round($size * 0.86)}px;
  }
`

const Dial = styled.div`
  --p: 0;
  position: relative;
  width: var(--dial);
  max-width: 100%;
  aspect-ratio: 1;

  svg {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  /* The time left, as a conic gradient masked to the ring: it starts on the
     head (now) and cools toward the close. */
  .arc {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    -webkit-mask: radial-gradient(
      closest-side,
      transparent 66.2%,
      var(--color-text) 66.7%,
      var(--color-text) 79.6%,
      transparent 80%
    );
    mask: radial-gradient(
      closest-side,
      transparent 66.2%,
      var(--color-text) 66.7%,
      var(--color-text) 79.6%,
      transparent 80%
    );
  }

  .caps {
    opacity: clamp(0, calc(var(--p) * 40), 1);
  }

  .bloom {
    mix-blend-mode: screen;
    transform-box: fill-box;
    transform-origin: center;
  }

  &[data-urgent='true'] .bloom {
    animation: ${urgentPulse} 1.6s ease-in-out infinite;
  }

  body[data-theme='light'] & .bloom {
    mix-blend-mode: normal;
    opacity: 0.22;
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-urgent='true'] .bloom {
      animation: none;
    }
  }
`

/* The figure sits in the dial, above the arc's open bottom. */
const Center = styled.div`
  position: absolute;
  inset: 0 0 18%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
  pointer-events: none;
`

const Figure = styled.span<{ $long?: boolean }>`
  max-width: 68%;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: calc(var(--dial) * ${({ $long }) => ($long ? 0.14 : 0.17)});
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  /* A text token, not opacity: over the ring's glow an opacity fade drops
     under 4.5:1 in the light theme. */
  small {
    margin-left: 0.04em;
    color: var(--color-muted);
    font-size: 0.55em;
    font-weight: 400;
    letter-spacing: 0;
  }
`

const Verb = styled.span`
  max-width: 64%;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 15px;

  @media (max-width: 720px) {
    font-size: 11px;
    line-height: 14px;
  }
`

/* Wider than the dial by 80px, so each end's date and its "UTC" fit on one
   line (round 5: at the dial's own width "15 Nov, 17:11" wrapped and left
   "UTC" alone on a second line). The labels reach about 40px past the
   dial's edges, which the arc's own ends, inset about 44px, never show. */
const Caption = styled.figcaption`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: min(100%, calc(var(--dial) + 80px));
`

/* The two ends of the arc, under the ends themselves: where the window
   opened on the left, where it closes on the right. */
const Ends = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  width: 100%;
`

const End = styled.div<{ $side: 'left' | 'right' }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  text-align: ${({ $side }) => $side};

  span {
    color: var(--color-faint);
    font-size: 11px;
    line-height: 14px;
  }

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`

/* What the ring measures over: the window's own length, and the deadline
   inside it when there is one. Never a second countdown. The list's own
   inline padding is cleared, or the browser's 40px pushes the centred line
   20px right of the dial's centre. */
const Notes = styled.ul`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  margin: 0;
  padding: 8px 0 0;
  border-top: 1px solid var(--glass-border);
  list-style: none;
  text-align: center;

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-faint);
    font-size: 11px;
    line-height: 15px;
  }
`

const Pip = styled.i`
  display: inline-block;
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border: 1.5px solid var(--color-text);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
`

/** The hot core of the head: light on the dark themes, white on light. */
const NowCore = styled.circle`
  fill: var(--color-text);

  body[data-theme='light'] & {
    fill: var(--color-surface);
  }
`

/** "2d 23h", "4h 12m", "12m 05s", "45s". */
export const formatCountdown = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  if (s >= 3600) return formatDuration(s)
  const m = Math.floor(s / 60)
  const rest = s % 60
  if (m > 0) return `${m}m ${String(rest).padStart(2, '0')}s`
  return `${rest}s`
}

/** "15h 47m" with the unit letters set small, so the digits lead. */
const CountdownText = ({ text }: { text: string }) => {
  const parts = [...text.matchAll(/(\d+)([a-z]+)/gi)]
  if (parts.length === 0) return <>{text}</>
  return (
    <>
      {parts.map(([, value, unit], index) => (
        <React.Fragment key={index}>
          {index > 0 && ' '}
          {value}
          <small>{unit}</small>
        </React.Fragment>
      ))}
    </>
  )
}

const shortDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  hour12: false,
})

/** "21 Oct, 19:49 UTC" */
const formatShort = (timestamp: number): string =>
  `${shortDate.format(new Date(timestamp * 1000))} UTC`

export interface WindowEnd {
  /** "Closes", "Challenger funds by" */
  label: string
  /** Unix seconds. */
  at: number
  /** Drawn as the marker dot on the arc instead of one of its two ends. */
  marker?: boolean
}

type Tone = 'window' | 'contested'

/** The arc's colours, from the head (now, hottest) to the tail (the close). */
const palette = (tone: Tone) => {
  const base =
    tone === 'contested' ? 'var(--status-contested)' : 'var(--status-window)'
  return {
    base,
    // Lighter than the base on dark themes, deeper on the light theme: the
    // hot end either way.
    head: `color-mix(in srgb, ${base} 62%, var(--color-text))`,
    mid: base,
    tail: `color-mix(in srgb, ${base} 34%, var(--color-surface))`,
    rest: `color-mix(in srgb, ${base} 16%, var(--color-surface))`,
  }
}

export const WindowRing = ({
  title,
  start,
  end,
  deadline,
  now,
  tone = 'window',
  verb,
  passedLabel = 'Closed',
  noun = 'window',
  ends,
  size = 184,
}: {
  /** What the arc is, e.g. "Challenge period". Names the measure. */
  title: string
  /** Unix seconds: the window opens and closes. */
  start: number
  end: number
  /** The deadline the figure counts to (defaults to `end`). */
  deadline?: number
  now: number
  tone?: Tone
  /** Under the figure: "left to challenge". */
  verb: string
  passedLabel?: string
  /** What this stretch of time is called: "3d window", "window over". */
  noun?: string
  /**
   * What the arc's ends are called. A `marker` entry is drawn on the arc at
   * its own time instead; of the rest the last names the close and, when
   * there are two, the first names the opening (default: "Opened").
   */
  ends?: WindowEnd[]
  /**
   * The dial's diameter. The default suits the entry pages' right-hand
   * column, 312px inside its padding (round 3: it came down from 196 so the
   * hero's two columns end nearer each other). The caption under it is 80px
   * wider, which keeps each end's date on one line down to a 158px dial.
   */
  size?: number
}) => {
  const id = useId().replace(/:/g, '')
  const dialRef = useRef<HTMLDivElement>(null)
  const target = deadline ?? end
  const duration = Math.max(1, end - start)
  const elapsed = windowProgress(start, end, now)
  const remaining = 1 - elapsed
  // The part of what is left that the figure counts down (now to deadline);
  // the rest of the window after the deadline is drawn dim.
  const toDeadline = Math.min(
    remaining,
    Math.max(0, windowProgress(start, end, target) - elapsed),
  )
  const hasRest = remaining - toDeadline > 0.0005
  const left = target - now
  const passed = left <= 0
  const urgent = !passed && toDeadline > 0 && toDeadline < 0.1

  // Draw in once the ring is on screen: one tween drives --p, which grows
  // the lit arc from the head toward the close and lights the ticks it
  // covers.
  useEffect(() => {
    const node = dialRef.current
    if (!node) return
    if (reducedMotion()) {
      node.style.setProperty('--p', '1')
      return
    }
    let frame = 0
    let started = false
    const run = () => {
      if (started) return
      started = true
      const t0 = performance.now() + 200
      const step = (time: number) => {
        const t = Math.min(1, Math.max(0, (time - t0) / 1400))
        node.style.setProperty('--p', String(easeOutExpo(t)))
        if (t < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }
    if (typeof IntersectionObserver === 'undefined') {
      run()
      return () => cancelAnimationFrame(frame)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          run()
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  const colors = palette(tone)
  const headDeg = START + elapsed * SWEEP
  const litDeg = toDeadline * SWEEP
  const leftDeg = remaining * SWEEP
  const arcBackground = hasRest
    ? `conic-gradient(from ${headDeg}deg, ${colors.head} 0deg, ${colors.mid} calc(var(--p) * ${litDeg * 0.45}deg), ${colors.tail} calc(var(--p) * ${litDeg}deg), ${colors.rest} calc(var(--p) * ${litDeg}deg), ${colors.rest} calc(var(--p) * ${leftDeg}deg), transparent 0)`
    : `conic-gradient(from ${headDeg}deg, ${colors.head} 0deg, ${colors.mid} calc(var(--p) * ${litDeg * 0.45}deg), ${colors.tail} calc(var(--p) * ${litDeg}deg), transparent 0)`

  const marker = ends?.find((entry) => entry.marker)
  const markerShare = marker ? windowProgress(start, end, marker.at) : undefined
  const markerPoint =
    markerShare === undefined
      ? undefined
      : polar(R, START + markerShare * SWEEP)
  const named = (ends ?? []).filter((entry) => !entry.marker)
  const opened: WindowEnd =
    named.length > 1 ? named[0] : { label: 'Opened', at: start }
  const closes: WindowEnd =
    named.length > 0
      ? named[named.length - 1]
      : { label: passed ? passedLabel : 'Closes', at: end }

  const head = polar(R, headDeg)
  const close = polar(R, START + SWEEP)
  const figure = passed ? passedLabel : formatCountdown(left)

  const label = passed
    ? `${title}: ${passedLabel}, closed ${formatAbsolute(target)}`
    : target < end
      ? `${title}: ${formatCountdown(left)} ${verb}, by ${formatAbsolute(
          target,
        )}; the ${title.toLowerCase()} opened ${formatAbsolute(
          start,
        )} and closes ${formatAbsolute(end)}`
      : `${title}: ${formatCountdown(left)} ${verb}; opened ${formatAbsolute(
          start,
        )}, closes ${formatAbsolute(end)}`

  return (
    <Wrap role="group" aria-label={label} $size={size}>
      <Label $tone="muted">{title}</Label>
      <Dial ref={dialRef} title={formatAbsolute(target)} data-urgent={urgent}>
        <svg viewBox={`0 0 ${C * 2} ${C * 2}`} aria-hidden>
          <defs>
            <radialGradient id={`wr-dome-${id}`} cx="50%" cy="32%" r="60%">
              <stop
                offset="0%"
                style={{ stopColor: colors.base, stopOpacity: 0.14 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: colors.base, stopOpacity: 0 }}
              />
            </radialGradient>
            <filter
              id={`wr-ticks-${id}`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="1.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx={C} cy={C} r={72} fill={`url(#wr-dome-${id})`} />
          <path
            d={arcPath(74, START, START + SWEEP)}
            fill="none"
            stroke="var(--glass-border)"
            strokeWidth="1"
            strokeDasharray="1 4"
            strokeLinecap="round"
          />
          {/* The track: the window, open to close. What time has spent shows
              through it. */}
          <path
            d={arcPath(R, START, START + SWEEP)}
            fill="none"
            stroke="var(--color-raised)"
            strokeWidth={W}
            strokeLinecap="round"
          />
          {/* The finish: the one mark that carries meaning, and the only
              one drawn in the text colour. It never moves. */}
          <line
            x1={polar(98, START + SWEEP).x}
            y1={polar(98, START + SWEEP).y}
            x2={polar(116, START + SWEEP).x}
            y2={polar(116, START + SWEEP).y}
            strokeWidth="2.4"
            strokeLinecap="round"
            style={{ stroke: 'var(--color-text)' }}
          />
          {/* The crown: every tick ahead of the head is time still left, and
              goes out as the head passes it — lit on the remaining side,
              like the arc, and never the spent one. No unit is claimed. */}
          <g filter={`url(#wr-ticks-${id})`} stroke="var(--color-faint)">
            {Array.from({ length: TICKS }, (_, index) => {
              // The last one would sit under the finish mark.
              if (index === TICKS - 1) return null
              const share = index / (TICKS - 1)
              const deg = START + share * SWEEP
              const long = index % 6 === 0
              const from = polar(long ? 103 : 106, deg)
              const to = polar(113, deg)
              return (
                <line
                  key={index}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  strokeWidth={long ? 1.6 : 1.1}
                  style={{
                    opacity:
                      share < elapsed
                        ? 0.16
                        : `clamp(0.16, calc((${elapsed} + var(--p) * ${remaining} - ${share}) * 45 + 1), 1)`,
                  }}
                />
              )
            })}
          </g>
        </svg>
        <div className="arc" style={{ background: arcBackground }} />
        <svg viewBox={`0 0 ${C * 2} ${C * 2}`} aria-hidden>
          <defs>
            <radialGradient id={`wr-bloom-${id}`}>
              <stop
                offset="0%"
                style={{ stopColor: colors.head, stopOpacity: 0.55 }}
              />
              <stop
                offset="40%"
                style={{ stopColor: colors.head, stopOpacity: 0.25 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: colors.head, stopOpacity: 0 }}
              />
            </radialGradient>
          </defs>
          {/* The close never moves: it is the finish the remainder is read
              against. */}
          <circle
            cx={close.x}
            cy={close.y}
            r={W / 2}
            style={{
              fill: passed
                ? colors.tail
                : hasRest
                  ? colors.rest
                  : 'var(--color-raised)',
            }}
          />
          {markerPoint && (
            <circle
              cx={markerPoint.x}
              cy={markerPoint.y}
              r="6"
              strokeWidth="2.2"
              style={{
                fill: 'var(--color-surface)',
                stroke: 'var(--color-text)',
              }}
            />
          )}
          {remaining > 0 && (
            <g className="caps">
              {/* Now: the head, the only part that glows. */}
              {!passed && (
                <circle
                  className="bloom"
                  cx={head.x}
                  cy={head.y}
                  r={30}
                  fill={`url(#wr-bloom-${id})`}
                />
              )}
              <circle
                cx={head.x}
                cy={head.y}
                r={W / 2}
                style={{ fill: colors.head }}
              />
              <NowCore cx={head.x} cy={head.y} r={3.2} />
            </g>
          )}
        </svg>
        <Center>
          <Figure $long={figure.length >= 7}>
            <CountdownText text={figure} />
          </Figure>
          <Verb>{passed ? `${noun} over` : verb}</Verb>
        </Center>
      </Dial>
      <Caption>
        <Ends>
          <End $side="left">
            <span>{opened.label}</span>
            <b title={formatAbsolute(opened.at)}>{formatShort(opened.at)}</b>
          </End>
          <End $side="right">
            <span>{closes.label}</span>
            <b title={formatAbsolute(closes.at)}>{formatShort(closes.at)}</b>
          </End>
        </Ends>
        <Notes>
          {marker && (
            <li>
              <Pip aria-hidden />
              <span title={formatAbsolute(marker.at)}>
                {marker.label} {formatShort(marker.at)}
              </span>
            </li>
          )}
          <li>
            {formatDuration(duration)} {noun}
          </li>
        </Notes>
      </Caption>
    </Wrap>
  )
}

export default WindowRing
