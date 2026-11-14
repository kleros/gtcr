import React, { useEffect, useId, useRef } from 'react'
import styled, { keyframes } from 'styled-components'
import { formatAbsolute, formatDuration, windowProgress } from 'utils/time'
import { Label } from './primitives'

/*
 * The item page's countdown ring. The whole circle is one window (the
 * challenge window, or an appeal period); it opens and closes at 12 o'clock
 * and runs clockwise. The lit arc is the time still left: a conic gradient
 * that starts on "now" (the head, its hottest point and the only part that
 * glows) and cools toward the close. Ticks mark days (or hours) and light up
 * where time is still left; an optional marker shows a deadline inside the
 * window (the loser's half of an appeal), with the rest of the period after
 * it drawn dim. The figure in the middle is the time left to the deadline
 * that matters, in Geist with tabular figures.
 */

const C = 120
const R = 86
const W = 14
const DAY = 86400
const HOUR = 3600

/** A point on a circle of radius r around the centre, at a share of a turn. */
const point = (share: number, r: number) => ({
  x: C + r * Math.sin(share * 2 * Math.PI),
  y: C - r * Math.cos(share * 2 * Math.PI),
})

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const urgentPulse = keyframes`
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.2; transform: scale(1.35); }
`

const Wrap = styled.figure`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin: 0;
  min-width: 0;
`

const Dial = styled.div<{ $size: number }>`
  --dial: ${({ $size }) => $size}px;
  --p: 0;
  position: relative;
  width: var(--dial);
  max-width: 100%;
  aspect-ratio: 1;

  @media (max-width: 720px) {
    --dial: ${({ $size }) => Math.round($size * 0.86)}px;
  }

  svg {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  /* The time left, as a conic gradient masked to the ring: its colour
     follows the arc from the head (now) to the close. */
  .arc {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    -webkit-mask: radial-gradient(
      closest-side,
      transparent 65.4%,
      var(--color-text) 65.85%,
      var(--color-text) 77.5%,
      transparent 77.95%
    );
    mask: radial-gradient(
      closest-side,
      transparent 65.4%,
      var(--color-text) 65.85%,
      var(--color-text) 77.5%,
      transparent 77.95%
    );
  }

  .turn {
    transform-box: view-box;
    transform-origin: 50% 50%;
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

const Figure = styled.span<{ $long?: boolean }>`
  max-width: 64%;
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
  max-width: 62%;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 15px;

  @media (max-width: 720px) {
    font-size: 11px;
    line-height: 14px;
  }
`

const Caption = styled.figcaption`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: center;
`

const Key = styled.ul`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 16px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
  }
`

const ArcSwatch = styled.i`
  width: 16px;
  height: 5px;
  border-radius: var(--radius-pill);
`

const TickSwatch = styled.i`
  width: 1.5px;
  height: 9px;
  border-radius: 1px;
  background: var(--color-muted);
`

const NowSwatch = styled.i`
  position: relative;
  width: 9px;
  height: 9px;
  border-radius: var(--radius-pill);

  &::after {
    content: '';
    position: absolute;
    inset: 3px;
    border-radius: inherit;
    background: var(--color-text);
  }

  body[data-theme='light'] &::after {
    background: var(--color-surface);
  }
`

const Ends = styled.dl`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  border-top: 1px solid var(--glass-border);
  text-align: left;

  div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 0 0;
  }

  dt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
`

const Pip = styled.i`
  display: inline-block;
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
  if (s >= HOUR) return formatDuration(s)
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
  /** Drawn as the marker dot on the ring. */
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
  ends,
  size = 196,
}: {
  /** What the circle is, e.g. "Challenge window". Names the measure. */
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
  /** The dates under the ring (default: opened, closes); one may be the marker. */
  ends?: WindowEnd[]
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
  // the arc from the head to the close and moves the end cap with it.
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

  // Ticks: one per day, or per hour when the window is shorter than 2 days.
  const unit = duration >= 2 * DAY ? DAY : duration >= 3 * HOUR ? HOUR : 0
  const count = unit ? Math.floor(duration / unit) : 0
  const stride = Math.max(1, Math.ceil(count / 48))
  const ticks: number[] = []
  for (let i = stride; i * unit < duration; i += stride)
    ticks.push((i * unit) / duration)

  const colors = palette(tone)
  const nowDeg = elapsed * 360
  const litDeg = toDeadline * 360
  const leftDeg = remaining * 360
  const arcBackground = hasRest
    ? `conic-gradient(from ${nowDeg}deg, ${colors.head} 0deg, ${colors.mid} calc(var(--p) * ${litDeg * 0.45}deg), ${colors.tail} calc(var(--p) * ${litDeg}deg), ${colors.rest} calc(var(--p) * ${litDeg}deg), ${colors.rest} calc(var(--p) * ${leftDeg}deg), transparent 0)`
    : `conic-gradient(from ${nowDeg}deg, ${colors.head} 0deg, ${colors.mid} calc(var(--p) * ${litDeg * 0.45}deg), ${colors.tail} calc(var(--p) * ${litDeg}deg), transparent 0)`
  const marker = ends?.find((entry) => entry.marker)
  const markerShare = marker ? windowProgress(start, end, marker.at) : undefined
  const markerPoint =
    markerShare === undefined ? undefined : point(markerShare, R)
  const figure = passed ? passedLabel : formatCountdown(left)
  const top = point(0, R)

  const label = passed
    ? `${title}: ${passedLabel}, closed ${formatAbsolute(target)}`
    : target < end
      ? `${title}: ${formatCountdown(left)} ${verb}, by ${formatAbsolute(
          target,
        )}; the ${title.toLowerCase()} closes ${formatAbsolute(end)}`
      : `${title}: ${formatCountdown(left)} ${verb}, closes ${formatAbsolute(
          end,
        )}`

  return (
    <Wrap role="group" aria-label={label}>
      <Label $tone="muted">
        {title} · {formatDuration(duration)}
      </Label>
      <Dial
        ref={dialRef}
        $size={size}
        title={formatAbsolute(target)}
        data-urgent={urgent}
      >
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
          </defs>
          <circle cx={C} cy={C} r={70} fill={`url(#wr-dome-${id})`} />
          <circle
            cx={C}
            cy={C}
            r={70}
            fill="none"
            stroke="var(--glass-border)"
            strokeWidth="1"
            strokeDasharray="1 4"
            strokeLinecap="round"
          />
          {/* The track: the elapsed part of the window shows through. */}
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke="var(--color-raised)"
            strokeWidth={W}
          />
          {ticks.map((share) => {
            const a = point(share, 100)
            const b = point(share, 108)
            const ahead = share - elapsed
            return (
              <line
                key={share}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                strokeWidth="1.6"
                strokeLinecap="round"
                style={{
                  stroke: 'var(--color-muted)',
                  opacity:
                    ahead < 0
                      ? 0.28
                      : `clamp(0.28, calc((var(--p) * ${remaining} - ${ahead}) * 60 + 1), 0.95)`,
                }}
              />
            )
          })}
          {/* 12 o'clock: where the window opens and closes. */}
          <line
            x1={C}
            y1={C - 98}
            x2={C}
            y2={C - 111}
            strokeWidth="2.4"
            strokeLinecap="round"
            style={{ stroke: 'var(--color-text)' }}
          />
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
          {remaining > 0 && (
            <g className="caps">
              {/* The close: where what is left ends (a round cap). */}
              <g
                className="turn"
                style={{
                  transform: `rotate(calc(${nowDeg}deg + var(--p) * ${leftDeg}deg))`,
                }}
              >
                <circle
                  cx={top.x}
                  cy={top.y}
                  r={W / 2}
                  style={{ fill: hasRest ? colors.rest : colors.tail }}
                />
              </g>
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
              {/* Now: the head, the only part that glows. */}
              <g className="turn" style={{ transform: `rotate(${nowDeg}deg)` }}>
                {!passed && (
                  <circle
                    className="bloom"
                    cx={top.x}
                    cy={top.y}
                    r={30}
                    fill={`url(#wr-bloom-${id})`}
                  />
                )}
                <circle
                  cx={top.x}
                  cy={top.y}
                  r={W / 2}
                  style={{ fill: colors.head }}
                />
                <NowCore cx={top.x} cy={top.y} r={3.2} />
              </g>
            </g>
          )}
          {remaining <= 0 && markerPoint && (
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
        </svg>
        <Center>
          <Figure $long={figure.length >= 7}>
            <CountdownText text={figure} />
          </Figure>
          <Verb>{passed ? 'window over' : verb}</Verb>
        </Center>
      </Dial>
      <Caption>
        <Key aria-hidden>
          <li>
            <ArcSwatch
              style={{
                background: `linear-gradient(90deg, ${colors.head}, ${colors.mid}, ${colors.tail})`,
              }}
            />
            {marker && !passed ? 'Until the deadline' : 'Time left'}
          </li>
          {marker && hasRest ? (
            <li>
              <ArcSwatch style={{ background: colors.rest }} />
              Rest of the period
            </li>
          ) : null}
          {unit ? (
            <li>
              <TickSwatch />1 {unit === DAY ? 'day' : 'hour'}
            </li>
          ) : null}
          <li>
            <NowSwatch style={{ background: colors.head }} />
            Now
          </li>
        </Key>
        <Ends>
          {(
            ends ?? [
              { label: 'Opened', at: start },
              { label: 'Closes', at: end },
            ]
          ).map((entry) => (
            <div key={entry.label}>
              <dt>
                {entry.marker && <Pip aria-hidden />}
                {entry.label}
              </dt>
              <dd title={formatAbsolute(entry.at)}>{formatShort(entry.at)}</dd>
            </div>
          ))}
        </Ends>
      </Caption>
    </Wrap>
  )
}

export default WindowRing
