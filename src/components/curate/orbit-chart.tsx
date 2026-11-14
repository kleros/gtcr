import React from 'react'
import styled, { keyframes } from 'styled-components'

/*
 * Ring chart: one arc per segment with small gaps and rounded caps, each
 * sitting on a wide, faint halo of its own colour (no blur filters, so the
 * edges stay crisp), the total set in the middle. Only real counts go in;
 * the arcs are proportional to them.
 */

const Wrap = styled.figure<{ $size?: number }>`
  position: relative;
  margin: 0;
  width: ${({ $size }) => ($size ? `${$size}px` : '100%')};
  max-width: ${({ $size }) => ($size ? `${$size}px` : '340px')};
  flex: 0 0 auto;
  aspect-ratio: 1;
`

const sweep = keyframes`
  from { stroke-dashoffset: var(--len); }
  to { stroke-dashoffset: 0; }
`

const ArcPath = styled.path`
  stroke-dasharray: var(--len);
  animation: ${sweep} 1600ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: var(--delay, 0ms);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Svg = styled.svg`
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
`

const Center = styled.figcaption`
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

const Total = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 28px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
`

/* Kept inside the ring's hole: at most ~62% of the figure, two lines. */
const Caption = styled.span`
  display: -webkit-box;
  max-width: 62%;
  overflow: hidden;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 15px;
  font-weight: 400;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

export interface OrbitSegment {
  key: string
  label: string
  value: number
  color: string
}

const polar = (cx: number, cy: number, r: number, angle: number) => {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const arcPath = (
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
) => {
  const a = polar(cx, cy, r, end)
  const b = polar(cx, cy, r, start)
  const large = end - start > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 0 ${b.x} ${b.y}`
}

export const OrbitChart = ({
  segments,
  total,
  caption,
  ariaLabel,
  size,
}: {
  segments: OrbitSegment[]
  total: string
  caption: string
  ariaLabel: string
  size?: number
}) => {
  const box = 320
  const c = box / 2
  const r = 132
  const sum = segments.reduce((acc, seg) => acc + seg.value, 0)
  const visible = segments.filter((seg) => seg.value > 0)
  const gap = visible.length > 1 ? 4 : 0
  let cursor = 0
  const arcs = visible.map((seg) => {
    const sweep = sum ? (seg.value / sum) * 360 : 0
    const start = cursor + gap / 2
    // keep tiny shares visible as a short arc
    const end = cursor + Math.max(sweep, 2.5) - gap / 2
    cursor += sweep
    return { ...seg, start, end }
  })

  return (
    <Wrap $size={size} role="img" aria-label={ariaLabel}>
      <Svg viewBox={`0 0 ${box} ${box}`}>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-raised)"
          strokeWidth="18"
        />
        <circle
          cx={c}
          cy={c}
          r={r - 26}
          fill="none"
          stroke="var(--glass-border)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        <circle
          cx={c}
          cy={c}
          r={r + 22}
          fill="none"
          stroke="var(--glass-border)"
          strokeWidth="1"
        />
        {arcs.length === 1 ? (
          // One segment holds everything: an arc from 0 to 360 degrees
          // has the same start and end point and would draw nothing.
          <>
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={arcs[0].color}
              strokeWidth="34"
              strokeOpacity="0.16"
            />
            <ArcPath
              d={`M ${c} ${c - r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 ${-2 * r}`}
              fill="none"
              stroke={arcs[0].color}
              strokeWidth="18"
              pathLength={1000}
              style={{ ['--len' as string]: '1000' }}
            />
          </>
        ) : (
          <>
            {arcs.map((arc, index) => (
              <ArcPath
                key={`${arc.key}-halo`}
                d={arcPath(c, c, r, arc.start, arc.end)}
                fill="none"
                stroke={arc.color}
                strokeWidth="34"
                strokeOpacity="0.16"
                strokeLinecap="round"
                pathLength={1000}
                style={{
                  ['--len' as string]: '1000',
                  ['--delay' as string]: `${index * 180}ms`,
                }}
              />
            ))}
            {arcs.map((arc, index) => (
              <ArcPath
                key={arc.key}
                d={arcPath(c, c, r, arc.start, arc.end)}
                fill="none"
                stroke={arc.color}
                strokeWidth="18"
                strokeLinecap="round"
                pathLength={1000}
                style={{
                  ['--len' as string]: '1000',
                  ['--delay' as string]: `${index * 180}ms`,
                }}
              />
            ))}
          </>
        )}
      </Svg>
      <Center>
        <Total>{total}</Total>
        <Caption>{caption}</Caption>
      </Center>
    </Wrap>
  )
}

export default OrbitChart
