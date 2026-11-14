import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useReducedMotion } from './hooks'

/*
 * The drawing kit behind the guide's lifecycle maps: boxed nodes for the
 * horizontal maps, rail stops for the vertical one, edges that draw in, edge
 * labels, request tokens that travel a route once, and the frame that picks a
 * layout from its own width and arms the drawing when it comes into view.
 * Each map supplies its geometry; the look and the motion live here.
 */

export type Tone = 'window' | 'registered' | 'contested' | 'neutral' | 'off'

export interface NodeSpec {
  id: string
  title: string
  lines: string[]
  tone?: Tone
  delay: number
}

export const SchematicSvg = styled.svg<{ $max?: number }>`
  display: block;
  width: 100%;
  max-width: ${({ $max }) => ($max ? `${$max}px` : 'none')};
  height: auto;
  margin: 0;
  overflow: visible;
  font-family: var(--font-sans);

  .base {
    fill: var(--color-surface);
  }

  .face {
    fill: var(--color-raised);
    stroke: var(--glass-border);
    stroke-width: 1;
  }

  .tone-window .face {
    stroke: color-mix(in srgb, var(--status-window) 45%, var(--glass-border));
  }

  .tone-registered .face {
    stroke: color-mix(
      in srgb,
      var(--status-registered) 45%,
      var(--glass-border)
    );
  }

  .tone-contested .face {
    stroke: color-mix(
      in srgb,
      var(--status-contested) 45%,
      var(--glass-border)
    );
  }

  .tone-off .face {
    stroke: color-mix(in srgb, var(--status-off) 45%, var(--glass-border));
  }

  .title {
    fill: var(--color-text);
    font-size: 15px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .sub {
    fill: var(--color-muted);
    font-size: 13px;
  }

  .label,
  .tag {
    fill: var(--color-faint);
    font-size: 13px;
  }

  .chip {
    fill: var(--color-raised);
    stroke: var(--glass-border);
    stroke-width: 1;
  }

  .glyph {
    fill: none;
    stroke: var(--color-faint);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .edge,
  .head {
    fill: none;
    stroke: var(--color-border-strong);
    stroke-width: 1.5;
  }

  .edge {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }

  .head,
  .label,
  .fade {
    opacity: 0;
  }

  .node {
    opacity: 0;
    transform: translateY(8px);
    transform-box: fill-box;
  }

  .token {
    opacity: 0;
  }

  &[data-on='true'] {
    .edge {
      stroke-dashoffset: 0;
      transition: stroke-dashoffset 480ms
        var(--ease-in-out, cubic-bezier(0.65, 0, 0.35, 1)) var(--d, 0ms);
    }

    .head,
    .label,
    .fade {
      opacity: 1;
      transition: opacity 260ms ease calc(var(--d, 0ms) + 380ms);
    }

    .node {
      opacity: 1;
      transform: none;
      transition:
        opacity 520ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1))
          var(--d, 0ms),
        transform 680ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1))
          var(--d, 0ms);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .edge {
      stroke-dashoffset: 0;
    }

    .head,
    .label,
    .fade,
    .node {
      opacity: 1;
      transform: none;
    }

    &[data-on='true'] .edge,
    &[data-on='true'] .head,
    &[data-on='true'] .label,
    &[data-on='true'] .fade,
    &[data-on='true'] .node {
      transition: none;
    }
  }
`

export const delay = (ms: number) => ({ ['--d' as string]: `${ms}ms` })

export const Dot = ({ x, y, tone }: { x: number; y: number; tone?: Tone }) =>
  tone ? (
    <>
      <circle
        cx={x}
        cy={y}
        r={9}
        style={{
          fill: `color-mix(in srgb, var(--status-${tone}) 22%, transparent)`,
        }}
      />
      <circle cx={x} cy={y} r={4} style={{ fill: `var(--status-${tone})` }} />
    </>
  ) : (
    <circle
      cx={x}
      cy={y}
      r={5}
      style={{
        fill: 'var(--color-surface)',
        stroke: 'var(--color-border-strong)',
        strokeWidth: 1.5,
      }}
    />
  )

/** A boxed node for the horizontal maps. */
export const BoxNode = ({
  spec,
  x,
  y,
  w,
  h = 84,
  lines = spec.lines,
}: {
  spec: NodeSpec
  x: number
  y: number
  w: number
  h?: number
  lines?: string[]
}) => (
  <g
    className={`node${spec.tone ? ` tone-${spec.tone}` : ''}`}
    style={delay(spec.delay)}
  >
    <rect className="base" x={x} y={y} width={w} height={h} rx={14} />
    <rect className="face" x={x} y={y} width={w} height={h} rx={14} />
    {spec.tone && <Dot x={x + 22} y={y + 27} tone={spec.tone} />}
    <text className="title" x={x + (spec.tone ? 38 : 18)} y={y + 32}>
      {spec.title}
    </text>
    {lines.map((line, index) => (
      <text key={line} className="sub" x={x + 18} y={y + 56 + index * 18}>
        {line}
      </text>
    ))}
  </g>
)

/** A rail stop for the vertical maps: marker, title and its lines. */
export const RailNode = ({
  spec,
  x,
  cy,
  lines = spec.lines,
}: {
  spec: NodeSpec
  x: number
  cy: number
  lines?: string[]
}) => (
  <g
    className={`node${spec.tone ? ` tone-${spec.tone}` : ''}`}
    style={delay(spec.delay)}
  >
    <Dot x={x} y={cy} tone={spec.tone} />
    <text className="title" x={x + 24} y={cy + 5}>
      {spec.title}
    </text>
    {lines.map((line, index) => (
      <text key={line} className="sub" x={x + 24} y={cy + 25 + index * 18}>
        {line}
      </text>
    ))}
  </g>
)

export const Edge = ({
  d,
  head,
  ms,
}: {
  d: string
  head: string
  ms: number
}) => (
  <>
    <path className="edge" d={d} pathLength={1} style={delay(ms)} />
    <path className="head" d={head} style={delay(ms)} />
  </>
)

export const EdgeLabel = ({
  x,
  y,
  ms,
  anchor = 'start',
  children,
}: {
  x: number
  y: number
  ms: number
  anchor?: 'start' | 'middle' | 'end'
  children: React.ReactNode
}) => (
  <text className="label" x={x} y={y} textAnchor={anchor} style={delay(ms)}>
    {children}
  </text>
)

/** A small loop arrow, the same sign as the loops it labels. */
export const LoopGlyph = ({ x, y }: { x: number; y: number }) => (
  <g className="glyph" transform={`translate(${x} ${y})`} aria-hidden>
    <path d="M4.6 -2.6 A5 5 0 1 0 5 1.2" />
    <path d="M1.8 -3.2 L4.8 -2.4 L5.4 -5.4" />
  </g>
)

/** One token's trip: the route it follows, when it leaves and how long. */
export interface TokenRun {
  d: string
  delay: number
  duration: number
}

const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

/** Moves each token along its route once, then hides it. */
const useTokens = (
  armed: boolean,
  runs: TokenRun[],
  routes: React.RefObject<SVGPathElement>[],
  tokens: React.RefObject<SVGGElement>[],
) => {
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!armed || reduced) return
    let frame = 0
    const start = performance.now()
    const lengths = routes.map((route) => route.current?.getTotalLength() ?? 0)
    const step = (now: number) => {
      let running = false
      runs.forEach((token, index) => {
        const path = routes[index].current
        const node = tokens[index].current
        if (!path || !node) return
        const t = (now - start - token.delay) / token.duration
        if (t < 0) {
          running = true
          return
        }
        if (t > 1) {
          node.style.opacity = '0'
          return
        }
        running = true
        const point = path.getPointAtLength(lengths[index] * ease(t))
        node.setAttribute('transform', `translate(${point.x} ${point.y})`)
        node.style.opacity = String(Math.min(1, t * 8, (1 - t) * 8))
      })
      if (running) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [armed, reduced, runs, routes, tokens])
}

/**
 * The travelling tokens. `runs` must keep its length for the life of the
 * map: each layout mounts its own map, so a new layout gets new refs.
 */
export const Tokens = ({
  runs,
  armed,
  glow,
}: {
  runs: TokenRun[]
  armed: boolean
  /** The id of the map's TokenGlow gradient. */
  glow: string
}) => {
  const routeRefs = useRef(
    runs.map(() => React.createRef<SVGPathElement>()),
  ).current
  const tokenRefs = useRef(
    runs.map(() => React.createRef<SVGGElement>()),
  ).current
  useTokens(armed, runs, routeRefs, tokenRefs)
  return (
    <g aria-hidden>
      {runs.map((run, index) => (
        <path
          key={`route-${index}`}
          ref={routeRefs[index]}
          d={run.d}
          fill="none"
          stroke="none"
        />
      ))}
      {runs.map((_, index) => (
        <g key={`token-${index}`} ref={tokenRefs[index]} className="token">
          <circle r={11} fill={`url(#${glow})`} />
          <circle r={4} style={{ fill: 'var(--color-primary)' }} />
        </g>
      ))}
    </g>
  )
}

export const TokenGlow = ({ id }: { id: string }) => (
  <defs>
    <radialGradient id={id}>
      <stop offset="0%" style={{ stopColor: 'var(--color-primary)' }} />
      <stop
        offset="100%"
        style={{ stopColor: 'var(--color-primary)', stopOpacity: 0 }}
      />
    </radialGradient>
  </defs>
)

export type Layout = 'wide' | 'mid' | 'narrow'

const Frame = styled.figure`
  position: relative;
  display: grid;
  gap: 16px;
  width: 100%;
  margin: 0;
`

/**
 * On the horizontal maps the caption sits in a free corner of the drawing,
 * placed by the map; below the rail otherwise.
 */
const CaptionSlot = styled.figcaption<{
  $corner?: { top: string; width: string }
}>`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  ${({ $corner }) =>
    $corner &&
    `
    position: absolute;
    top: ${$corner.top};
    left: 0;
    width: ${$corner.width};
  `}
`

/** Container widths where the wide and the compact horizontal maps start. */
const WIDE_FROM = 860
const MID_FROM = 600

const layoutFor = (width: number): Layout =>
  width >= WIDE_FROM ? 'wide' : width >= MID_FROM ? 'mid' : 'narrow'

/**
 * Measures its own width to pick the wide, mid or narrow map, and arms the
 * drawing once `play` is true. A replay (`run`) or a layout switch remounts
 * the map and starts again from the empty drawing.
 */
export const SchematicFrame = ({
  play,
  run,
  caption,
  corner,
  children,
}: {
  /** Start drawing (the panel came into view). */
  play: boolean
  /** Bump to replay the drawing from the start. */
  run: number
  /** What the drawing shows; rendered inside the figure's figcaption. */
  caption: React.ReactNode
  /** Where the caption sits on the horizontal maps. */
  corner: Record<'wide' | 'mid', { top: string; width: string }>
  /** Draws the map for a layout; key it by `run` so a replay remounts it. */
  children: (layout: Layout, armed: boolean) => React.ReactNode
}) => {
  const frame = useRef<HTMLElement>(null)
  const [layout, setLayout] = useState<Layout>('wide')
  // Armed for one run and layout at a time, so a replay or a layout switch
  // starts from the empty drawing instead of flashing the finished one.
  const [armedFor, setArmedFor] = useState('')
  const key = `${run}-${layout}`
  const armed = play && armedFor === key

  // Measured before paint, so the page does not change height after a deep
  // link (/guide#stake-curate) has scrolled to its section.
  useLayoutEffect(() => {
    const node = frame.current
    if (!node) return
    const update = () => setLayout(layoutFor(node.clientWidth))
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Arm on the next frames so the CSS transitions run from the start.
  useEffect(() => {
    if (!play) return
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setArmedFor(key))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [play, key])

  return (
    <Frame ref={frame}>
      {children(layout, armed)}
      <CaptionSlot $corner={layout === 'narrow' ? undefined : corner[layout]}>
        {caption}
      </CaptionSlot>
    </Frame>
  )
}
