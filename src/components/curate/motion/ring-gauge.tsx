import React, { useEffect, useId, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'

/*
 * Ring gauge (EV tachometer / GPU dashboard recipe): a 270° open arc with the
 * gap at the bottom. The value arc is a conic gradient whose colour follows
 * the arc, so the head is the hottest point and the only part that glows;
 * a crown of ticks lights up as the head passes them; the figure inside is
 * Geist with tabular figures. The value tweens with an expo ease, never
 * overshooting; reduced motion jumps to the value.
 */

const C = 120
const R = 88
const W = 16
const START = -135
const SWEEP = 270
const TICKS = 54

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.sin(a), C - r * Math.cos(a)] as const
}
const arc = (r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(r, a0)
  const [x1, y1] = polar(r, a1)
  return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
}
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
const reduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const urgent = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50% { transform: scale(1.35); opacity: 0.2; }
`

const Wrap = styled.figure<{ $size: number; $mini: boolean }>`
  position: relative;
  margin: 0;
  width: ${({ $size }) => $size}px;
  max-width: 100%;
  aspect-ratio: 1;
  flex: 0 0 auto;
  --p: 0;

  .arc {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(
      from -135deg,
      var(--g-tail) 0deg,
      var(--g-mid) calc(var(--p) * 148.5deg),
      var(--g-head) calc(var(--p) * 270deg),
      transparent 0
    );
    -webkit-mask: radial-gradient(
      closest-side,
      transparent ${({ $mini }) => ($mini ? '68.5%' : '66.2%')},
      #000 ${({ $mini }) => ($mini ? '69%' : '66.7%')},
      #000 ${({ $mini }) => ($mini ? '77.4%' : '79.6%')},
      transparent ${({ $mini }) => ($mini ? '77.8%' : '80%')}
    );
    mask: radial-gradient(
      closest-side,
      transparent ${({ $mini }) => ($mini ? '68.5%' : '66.2%')},
      #000 ${({ $mini }) => ($mini ? '69%' : '66.7%')},
      #000 ${({ $mini }) => ($mini ? '77.4%' : '79.6%')},
      transparent ${({ $mini }) => ($mini ? '77.8%' : '80%')}
    );
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .tick {
    opacity: clamp(0.14, (var(--p) - var(--t)) * 45 + 1, 1);
  }

  .bloom {
    mix-blend-mode: screen;
    transform-box: fill-box;
    transform-origin: center;
  }

  &[data-urgent='true'] .bloom {
    animation: ${urgent} 1.6s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-urgent='true'] .bloom {
      animation: none;
    }
  }
`

const Center = styled.figcaption`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
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

  small {
    font-size: 0.5em;
    opacity: 0.5;
  }
`

const Caption = styled.span<{ $small: boolean }>`
  max-width: ${({ $small }) => ($small ? '58%' : '64%')};
  color: var(--color-faint);
  font-size: ${({ $small }) => ($small ? '11px' : '12px')};
  line-height: ${({ $small }) => ($small ? '13px' : '15px')};
`

const EndLabel = styled.text`
  fill: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 10px;
`

export const RingGauge = ({
  ratio,
  size = 200,
  from = 'var(--aurora-b)',
  to = 'var(--color-primary)',
  label,
  value,
  unit,
  caption,
  endLabels,
  urgent: isUrgent = false,
}: {
  /** 0..1 */
  ratio: number
  size?: number
  /** Colour at the tail of the arc. */
  from?: string
  /** Colour at the head of the arc (the only part that glows). */
  to?: string
  /** Accessible description, e.g. "Challenges won: 7 of 17" */
  label: string
  /** The figure in the middle; defaults to the percentage riding the tween. */
  value?: React.ReactNode
  unit?: string
  caption?: string
  /** Small labels at the two ends of the arc, e.g. ["0h", "84h"]. */
  endLabels?: [string, string]
  /** Pulses the head bloom (under 10% of a window left). */
  urgent?: boolean
}) => {
  const id = useId().replace(/:/g, '')
  const wrap = useRef<HTMLElement>(null)
  const [p, setP] = useState(0)
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0))
  const mini = size < 140

  useEffect(() => {
    if (reduced()) {
      setP(clamped)
      return
    }
    const node = wrap.current
    let frame = 0
    let started = false
    const run = () => {
      if (started) return
      started = true
      const from = p
      const t0 = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 1400)
        setP(from + (clamped - from) * easeOutExpo(t))
        if (t < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }
    // Draw in only once in view.
    if (node && typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run()
          io.disconnect()
        }
      })
      io.observe(node)
      return () => {
        io.disconnect()
        cancelAnimationFrame(frame)
      }
    }
    run()
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped])

  const [hx, hy] = polar(R, START + p * SWEEP)
  const [tx, ty] = polar(R, START)
  const showCaps = p > 0.005
  const figurePx = Math.round(
    size * (String(value ?? '').length > 6 ? 0.155 : 0.2),
  )

  return (
    <Wrap
      ref={wrap}
      $size={size}
      $mini={mini}
      role="img"
      aria-label={label}
      data-urgent={isUrgent}
      style={
        {
          ['--p' as string]: p,
          ['--g-tail' as string]: from,
          ['--g-mid' as string]: `color-mix(in srgb, ${from} 50%, ${to})`,
          ['--g-head' as string]: to,
        } as React.CSSProperties
      }
    >
      <svg viewBox={`0 0 ${C * 2} ${C * 2}`} aria-hidden>
        <defs>
          <radialGradient id={`dome-${id}`} cx="50%" cy="32%" r="60%">
            <stop offset="0%" stopColor={to} stopOpacity="0.16" />
            <stop offset="100%" stopColor={to} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`bloom-${id}`}>
            <stop offset="0%" stopColor={to} stopOpacity="0.55" />
            <stop offset="40%" stopColor={to} stopOpacity="0.25" />
            <stop offset="100%" stopColor={to} stopOpacity="0" />
          </radialGradient>
          <filter id={`tg-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={C} cy={C} r={72} fill={`url(#dome-${id})`} />
        {!mini && (
          <path
            d={arc(74, START, START + SWEEP)}
            fill="none"
            stroke="var(--glass-border)"
            strokeWidth="1"
            strokeDasharray="1 4"
            strokeLinecap="round"
          />
        )}
        <path
          d={arc(R, START, START + SWEEP)}
          fill="none"
          stroke="var(--color-raised)"
          strokeWidth={mini ? 10 : W}
          strokeLinecap="round"
        />
        {!mini && (
          <g filter={`url(#tg-${id})`} stroke="var(--color-faint)">
            {Array.from({ length: TICKS }, (_, i) => {
              const deg = START + (i / (TICKS - 1)) * SWEEP
              const long = i % 6 === 0
              const [x1, y1] = polar(long ? 103 : 106, deg)
              const [x2, y2] = polar(113, deg)
              return (
                <line
                  key={i}
                  className="tick"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={long ? 1.6 : 1.1}
                  style={{ ['--t' as string]: i / (TICKS - 1) }}
                />
              )
            })}
          </g>
        )}
        {endLabels && !mini && (
          <>
            <EndLabel
              x={polar(R - 2, START)[0] - 10}
              y={C * 2 - 8}
              textAnchor="end"
            >
              {endLabels[0]}
            </EndLabel>
            <EndLabel
              x={polar(R - 2, START + SWEEP)[0] + 10}
              y={C * 2 - 8}
              textAnchor="start"
            >
              {endLabels[1]}
            </EndLabel>
          </>
        )}
      </svg>
      <div className="arc" />
      <svg viewBox={`0 0 ${C * 2} ${C * 2}`} aria-hidden>
        {showCaps && (
          <>
            <circle cx={tx} cy={ty} r={(mini ? 10 : W) / 2} fill={from} />
            <circle
              className="bloom"
              cx={hx}
              cy={hy}
              r={mini ? 20 : 34}
              fill={`url(#bloom-${id})`}
            />
            <circle cx={hx} cy={hy} r={(mini ? 10 : W) / 2} fill={to} />
            <circle cx={hx} cy={hy} r={3.5} fill="#ffffff" />
          </>
        )}
      </svg>
      <Center>
        <Figure $px={figurePx}>
          {value === undefined ? `${Math.round(p * 100)}%` : value}
          {unit && <small> {unit}</small>}
        </Figure>
        {caption && <Caption $small={size < 200}>{caption}</Caption>}
      </Center>
    </Wrap>
  )
}

export default RingGauge
