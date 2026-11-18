import React, { useEffect, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { formatDuration } from 'utils/time'
import { SkeletonBlock, Surface } from './primitives'
import type { StatusTone } from './primitives'
import { reveal } from './motion/reveal'
import { CountUpText } from './registry-shared-count'

/*
 * The panel language both registries' stats are drawn in: the bento, its
 * panels and their one-sentence headers, the legend parts, the tally and the
 * segmented status ring, plus the two hooks every drawing needs (in view, and
 * how wide). Nothing here knows about Standard or Stake data: the Stake
 * panels (registry-stake-insights.tsx) and the Standard ones
 * (registry-standard-insights.tsx) bring their own figures and their own
 * definitions, and share the shell so the two pages read as one.
 */

export const integer = new Intl.NumberFormat('en-US')

export const Bento = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;

  @media (max-width: 1180px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    > :first-child {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
`

export const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px;
  ${reveal}

  @media (max-width: 720px) {
    padding: 18px 16px;
  }
`

/* Placeholders sized to the panels they stand in for, per breakpoint, so the
   toolbar and the list do not jump when the summary arrives. */
export const PanelSkeleton = styled(SkeletonBlock)`
  min-height: 274px;
  border-radius: var(--radius-lg);

  @media (max-width: 1180px) {
    min-height: 232px;

    &:first-child {
      min-height: 256px;
    }
  }

  @media (max-width: 720px) {
    min-height: 228px;

    &:first-child {
      min-height: 296px;
    }
  }
`

export const PanelTop = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px 20px;
`

/* The first headings under the page's title (its h1), so h2s. */
export const PanelTitle = styled.h2`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--fs-heading);
  line-height: var(--lh-heading);
  font-weight: 600;
  letter-spacing: -0.02em;
`

export const PanelLine = styled.p`
  margin: 4px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/* ---------- Keys (legend) ---------- */

const Keys = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin: 0;
  padding: 2px 0 0;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    white-space: nowrap;
  }
`

export const KeyLine = styled.i<{ $color: string }>`
  width: 14px;
  height: 4px;
  border-radius: var(--radius-pill);
  background: ${({ $color }) => $color};
`

export const KeyDot = styled.i<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: ${({ $color }) => $color};
  box-shadow: 0 0 0 3px
    color-mix(in srgb, ${({ $color }) => $color} 22%, transparent);
`

/* The mark that closes a lane without a ruling: a stop bar across its end. */
export const KeyTick = styled.i`
  width: 2px;
  height: 11px;
  border-radius: var(--radius-pill);
  background: var(--color-muted);
`

/** One legend entry: the mark the drawing holds, and what it means. */
export interface InsightKey {
  key: string
  label: string
  mark: React.ReactNode
}

export const KeyList = ({ keys }: { keys: InsightKey[] }) =>
  keys.length === 0 ? null : (
    <Keys aria-label="Key">
      {keys.map((key) => (
        <li key={key.key}>
          <span aria-hidden style={{ display: 'inline-flex' }}>
            {key.mark}
          </span>
          {key.label}
        </li>
      ))}
    </Keys>
  )

export const TONE_COLOR: Record<StatusTone, string> = {
  registered: 'var(--status-registered)',
  window: 'var(--status-window)',
  contested: 'var(--status-contested)',
  neutral: 'var(--status-neutral)',
  off: 'var(--status-off)',
}

/* ---------- Hooks ---------- */

export const useInView = <T extends Element>() => {
  const ref = useRef<T>(null)
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
  return [ref, inView] as const
}

export const useWidth = <T extends Element>() => {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next) setWidth(next)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/* ---------- Copy ---------- */

/** "500 agents", "1 agent": what a figure covers, in the list's own words. */
export const scopeText = (
  count: number,
  itemName: string,
  itemNamePlural: string,
) => `${integer.format(count)} ${count === 1 ? itemName : itemNamePlural}`

export const ordinal = (n: number) => {
  const tail = n % 100
  if (tail >= 11 && tail <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** "236 days"; under a day, "13h 20m". */
export const onListFor = (seconds: number) => {
  const days = Math.floor(seconds / 86400)
  if (days < 1) return formatDuration(seconds)
  return `${integer.format(days)} day${days === 1 ? '' : 's'}`
}

/* ---------- Figures beside a tally ---------- */

export const Split = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  flex: 1 1 auto;

  @media (max-width: 380px) {
    gap: 14px;
  }
`

export const Tally = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;

  > div {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  /* Labels wrap rather than cut off: "Withdrawal ready" in a narrow card. */
  dt {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    overflow-wrap: break-word;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: var(--fs-body);
    line-height: var(--lh-small);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  > div[data-zero] dd {
    color: var(--color-faint);
  }
`

/* A ring of the entries by status: one arc per status, sized by its count,
   on a faint halo of its own colour; a single status closes the ring. The
   arcs wait, paused on their first frame, until the ring is in view. */
const ringIn = keyframes`
  from { stroke-dasharray: 0 400; }
`

/** The ring's size; its figure scales with it, as RingGauge's does. */
export const RING_SIZE = 124

const RingWrap = styled.figure`
  position: relative;
  flex: 0 0 auto;
  width: ${RING_SIZE}px;
  height: ${RING_SIZE}px;
  margin: 0;

  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    transform: rotate(-90deg);
  }

  .seg {
    animation: ${ringIn} 1100ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: var(--d, 0ms);
    animation-play-state: paused;
  }

  &[data-in='true'] .seg {
    animation-play-state: running;
  }

  figcaption {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    pointer-events: none;
  }

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: ${RING_SIZE * 0.2}px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  figcaption > span {
    color: var(--color-faint);
    font-size: var(--fs-label);
    line-height: var(--lh-label);
  }

  @media (prefers-reduced-motion: reduce) {
    .seg {
      animation: none;
    }
  }
`

const RING_R = 52
const RING_C = 2 * Math.PI * RING_R

export const StatusRing = ({
  segments,
  figure,
  caption,
  label,
}: {
  segments: { key: string; value: number; color: string }[]
  figure: string
  caption: string
  label: string
}) => {
  const [ref, inView] = useInView<HTMLElement>()
  const sum = segments.reduce((total, segment) => total + segment.value, 0)
  const visible = segments.filter((segment) => segment.value > 0)
  const gap = visible.length > 1 ? 5 : 0
  let cursor = 0
  const arcs = visible.map((segment, index) => {
    const share = (segment.value / sum) * RING_C
    const length = Math.max(share - gap, 2)
    const arc = {
      ...segment,
      length,
      offset: -(cursor + gap / 2),
      delay: index * 120,
    }
    cursor += share
    return arc
  })
  return (
    <RingWrap ref={ref} data-in={inView} role="img" aria-label={label}>
      <svg viewBox="0 0 140 140" aria-hidden>
        <circle
          cx={70}
          cy={70}
          r={RING_R}
          fill="none"
          strokeWidth={12}
          style={{ stroke: 'var(--color-raised)' }}
        />
        {arcs.map((arc) => (
          <circle
            key={`${arc.key}-halo`}
            className="seg"
            cx={70}
            cy={70}
            r={RING_R}
            fill="none"
            strokeWidth={26}
            style={
              {
                stroke: arc.color,
                opacity: 0.14,
                strokeDasharray: `${arc.length} ${RING_C - arc.length}`,
                strokeDashoffset: arc.offset,
                '--d': `${arc.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            className="seg"
            cx={70}
            cy={70}
            r={RING_R}
            fill="none"
            strokeWidth={12}
            style={
              {
                stroke: arc.color,
                strokeDasharray: `${arc.length} ${RING_C - arc.length}`,
                strokeDashoffset: arc.offset,
                '--d': `${arc.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </svg>
      <figcaption>
        {/* The figure climbs with the arcs, once the ring is in view. */}
        <b>
          <CountUpText value={inView ? figure : ''} />
        </b>
        <span>{caption}</span>
      </figcaption>
    </RingWrap>
  )
}
