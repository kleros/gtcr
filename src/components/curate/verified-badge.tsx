import React, { useId } from 'react'
import styled, { keyframes } from 'styled-components'
import Tooltip from 'components/ui/Tooltip'
import { litEdgeBackground } from 'components/ui/kit-styles'

/*
 * The trust marks for a list (round 2, item 16). A list is Kleros Verified
 * when it is one of the chain's Kleros lists of lists (the Light ones and
 * the older Classic ones) or a Registered entry of any of them (the rule in
 * verified-rule.ts). Every other list is a Community list: anyone can launch
 * a Curate list, and this one is simply not on a list of lists. Verified
 * carries a badge of approval; Community is a plain name, never a warning.
 *
 * The lists of lists on Ethereum and Gnosis, Light and Classic, accept
 * every list except the offensive, obviously insecure, malformed or
 * duplicate ones (their policy documents, read 2026-10-19), so the
 * explanation names what that policy rejects and claims no more.
 *
 * API
 *   <VerifiedBadge />                      the seal alone, 16px, named
 *                                          "Kleros Verified" (role img)
 *   <VerifiedBadge size={14} />            12 to 24px: rows, cards, avatars
 *   <VerifiedBadge variant="pill" />       seal + "Kleros Verified", 24px
 *                                          tall, the chip row's height
 *   tooltip                                true: the one-line explanation on
 *                                          hover and focus (the badge
 *                                          becomes a tab stop); a string
 *                                          replaces the text
 *   listOfLists                            the list is itself a list of
 *                                          lists: its own explanation
 *   decorative                             seal only: hidden from assistive
 *                                          tech when "Kleros Verified" is
 *                                          already written next to it
 *   <CommunityTag />                       the quiet chip "Community"; takes
 *                                          tooltip too
 *   <TrustTag verified listOfLists />      the right one of the two, or
 *                                          nothing while `verified` is
 *                                          undefined (loading or failed):
 *                                          never claims Community without data
 *
 * When to use which
 *   - A page about one list (registry header, entry page): TrustTag, with
 *     its tooltip on. One per page.
 *   - Dense rows and cards (Browse, dashboard tables): the seal alone, no
 *     tooltip (a tab stop per row is too many). Community rows carry no
 *     mark at all: the badge is the exception, its absence is neutral.
 *   - Headings, tabs, filters, legends: the words below (VERIFIED_LABEL,
 *     COMMUNITY_LABEL, the plurals and explanations), so every page says
 *     the same thing.
 *
 * The look ("Lit edge", DESIGN.md): the seal is the Kleros icosahedron seen
 * down a three-fold axis (the theme menu's projection), cut as a gem. Its
 * ten facets are the primary glass (cta-top / cta-bottom) tinted with the
 * three edge hues the way the lit edge runs round a button: edge-1 at the
 * upper left, edge-2 at the right, edge-3 underneath. A top sheen, white
 * facet lines, a 1px (1.5px on light) gradient edge and a soft edge-2 glow
 * finish it; the check sits on the front facet in cta-ink over a cta-bottom
 * keyline, so it reads at 14px in every theme (12:1 or more). The pill is a
 * chip of light: surface glass, the conic lit edge, the label in text, and
 * its edge sweeps round once when it appears (not under reduced motion).
 * Nothing here is a button: no hover state, no pointer.
 */

/* ---------- Wording ---------- */

export const VERIFIED_LABEL = 'Kleros Verified'
export const VERIFIED_LISTS_LABEL = 'Kleros Verified lists'
export const COMMUNITY_LABEL = 'Community'
export const COMMUNITY_LISTS_LABEL = 'Community lists'

/** Why a list is Verified: what its list of lists' policy checks. */
export const VERIFIED_EXPLANATION =
  'On a Kleros list of lists, whose policy rejects insecure, malformed and offensive lists.'
/** The same for a list that is itself a list of lists. */
export const LIST_OF_LISTS_EXPLANATION =
  'A Kleros list of lists: the lists it accepts are Kleros Verified.'
export const COMMUNITY_EXPLANATION =
  'Not on a Kleros list of lists. Anyone can launch a Curate list.'

/* ---------- The seal ---------- */

type Point = readonly [number, number]

// Regular hexagon, circumradius 10.5 round (12, 12), point up.
const HEX: Point[] = [
  [12, 1.5],
  [21.09, 6.75],
  [21.09, 17.25],
  [12, 22.5],
  [2.91, 17.25],
  [2.91, 6.75],
]
// The front facet, the icon's proportion (0.534 of the outline).
const FRONT: Point[] = [
  [12, 6.4],
  [16.85, 14.8],
  [7.15, 14.8],
]

const pathOf = (points: readonly Point[]) =>
  `M${points.map((point) => point.join(' ')).join('L')}Z`

const OUTLINE = pathOf(HEX)

// The front facet's outline and the nine edges to the hexagon.
const WIRE = [
  pathOf(FRONT),
  ...(
    [
      [0, 0],
      [0, 1],
      [0, 5],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 3],
      [2, 4],
      [2, 5],
    ] as const
  ).map(
    ([front, corner]) => `M${FRONT[front].join(' ')}L${HEX[corner].join(' ')}`,
  ),
].join('')

const tint = (hue: 1 | 2 | 3, share: number, glass: 'top' | 'bottom') =>
  `color-mix(in srgb, var(--edge-${hue}) ${share}%, var(--cta-${glass}))`

// The ten facets in view, each tinted by where the lit edge would be.
const FACETS: { d: string; style: React.CSSProperties }[] = [
  {
    d: pathOf([FRONT[0], HEX[5], HEX[0]]),
    style: { fill: tint(1, 40, 'top') },
  },
  {
    d: pathOf([FRONT[0], HEX[0], HEX[1]]),
    style: { fill: tint(2, 30, 'top') },
  },
  {
    d: pathOf([FRONT[2], FRONT[0], HEX[5]]),
    style: { fill: tint(1, 26, 'top') },
  },
  {
    d: pathOf([FRONT[0], FRONT[1], HEX[1]]),
    style: { fill: tint(2, 20, 'top') },
  },
  {
    d: pathOf([FRONT[2], HEX[4], HEX[5]]),
    style: { fill: tint(1, 22, 'bottom') },
  },
  {
    d: pathOf([FRONT[1], HEX[1], HEX[2]]),
    style: { fill: tint(2, 26, 'bottom') },
  },
  {
    d: pathOf([FRONT[2], HEX[3], HEX[4]]),
    style: { fill: tint(3, 30, 'bottom') },
  },
  {
    d: pathOf([FRONT[1], HEX[2], HEX[3]]),
    style: { fill: tint(3, 18, 'bottom') },
  },
  {
    d: pathOf([FRONT[1], FRONT[2], HEX[3]]),
    style: { fill: tint(3, 22, 'bottom') },
  },
  { d: pathOf(FRONT), style: { fill: tint(2, 10, 'top') } },
]

const CHECK = 'M7.7 12.35L10.65 15.2L16.35 9.25'

const stop = (color: string, opacity = 1): React.CSSProperties => ({
  stopColor: color,
  stopOpacity: opacity,
})
const EDGE_STOPS = [
  { offset: '0', style: stop('var(--edge-1)') },
  { offset: '0.45', style: stop('var(--edge-2)') },
  { offset: '0.8', style: stop('var(--edge-3)') },
  { offset: '1', style: stop('var(--edge-3)', 0.55) },
]
const SHEEN_STOPS = [
  { offset: '0', style: stop('var(--cta-sheen)') },
  { offset: '0.58', style: stop('var(--cta-sheen)', 0) },
]

const SealSvg = styled.svg`
  display: block;
  flex: 0 0 auto;
  overflow: visible;
  filter: drop-shadow(
    0 0 3px color-mix(in srgb, var(--edge-2) 36%, transparent)
  );

  .seal-wire {
    fill: none;
    stroke: var(--cta-highlight);
    stroke-width: 0.6;
    stroke-linejoin: round;
  }

  .seal-edge {
    fill: none;
    stroke-width: var(--edge-width, 1px);
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .seal-keyline,
  .seal-check {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .seal-keyline {
    stroke: var(--cta-bottom);
    stroke-width: 3.9;
  }

  .seal-check {
    stroke: var(--cta-ink);
    stroke-width: 2.3;
  }
`

const Seal = ({ size }: { size: number }) => {
  const id = useId().replace(/[^\w-]/g, '')
  const edge = `cv-seal-edge-${id}`
  const sheen = `cv-seal-sheen-${id}`
  return (
    <SealSvg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
          {EDGE_STOPS.map((s) => (
            <stop key={s.offset} offset={s.offset} style={s.style} />
          ))}
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          {SHEEN_STOPS.map((s) => (
            <stop key={s.offset} offset={s.offset} style={s.style} />
          ))}
        </linearGradient>
      </defs>
      {FACETS.map((facet) => (
        <path key={facet.d} d={facet.d} style={facet.style} />
      ))}
      <path d={OUTLINE} fill={`url(#${sheen})`} />
      <path className="seal-wire" d={WIRE} />
      <path className="seal-edge" d={OUTLINE} stroke={`url(#${edge})`} />
      <path className="seal-keyline" d={CHECK} />
      <path className="seal-check" d={CHECK} />
    </SealSvg>
  )
}

/* ---------- Hosts ---------- */

const focusRing = `
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

const SealHost = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  vertical-align: middle;
  border-radius: 6px;
  line-height: 0;
  ${focusRing}
`

// The edge turns once round as the pill arrives (the primary hover's sweep).
const edgeSweep = keyframes`
  from { --edge-angle: 210deg; }
  to { --edge-angle: 570deg; }
`

const tagType = `
  font-family: var(--font-label);
  font-size: 11px;
  line-height: var(--lh-label);
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
`

const Pill = styled.span`
  --edge-angle: 210deg;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 10px 0 3px;
  border: var(--edge-width, 1px) solid transparent;
  border-radius: var(--radius-pill);
  background: ${litEdgeBackground(
    'linear-gradient(180deg, color-mix(in srgb, var(--edge-1) 12%, var(--color-surface)), var(--color-surface))',
  )};
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    0 6px 18px -12px var(--cta-glow);
  color: var(--color-text);
  vertical-align: middle;
  ${tagType}
  ${focusRing}

  @media (prefers-reduced-motion: no-preference) {
    animation: ${edgeSweep} 1100ms var(--ease-out) 150ms both;
  }
`

const Quiet = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass);
  color: var(--color-muted);
  vertical-align: middle;
  ${tagType}
  ${focusRing}
`

/* ---------- Components ---------- */

const explanationFor = (
  tooltip: boolean | string | undefined,
  fallback: string,
): string | null =>
  typeof tooltip === 'string' ? tooltip : tooltip ? fallback : null

// Balanced lines: a two-line tip never leaves one word on its own line.
const TipText = styled.span`
  display: block;
  text-wrap: balance;
`

const withTip = (tip: string | null, node: React.ReactElement) =>
  tip ? <Tooltip title={<TipText>{tip}</TipText>}>{node}</Tooltip> : node

export interface VerifiedBadgeProps {
  /** "seal" (default): the gem alone; "pill": the gem and "Kleros Verified". */
  variant?: 'seal' | 'pill'
  /** The seal's size in px, 12 to 24 (16 by default); the pill's is 16. */
  size?: number
  /** The list is itself a list of lists: its own explanation. */
  listOfLists?: boolean
  /** true: the explanation on hover and focus; a string replaces it. */
  tooltip?: boolean | string
  /** Seal only: hidden from assistive tech (the words are already beside it). */
  decorative?: boolean
  className?: string
}

/** The Kleros Verified approval mark: a lit, faceted icosahedron seal. */
export const VerifiedBadge = ({
  variant = 'seal',
  size = 16,
  listOfLists = false,
  tooltip,
  decorative = false,
  className,
}: VerifiedBadgeProps) => {
  const tip = explanationFor(
    tooltip,
    listOfLists ? LIST_OF_LISTS_EXPLANATION : VERIFIED_EXPLANATION,
  )
  const focusable = tip ? 0 : undefined

  if (variant === 'pill')
    return withTip(
      tip,
      <Pill className={className} tabIndex={focusable}>
        <Seal size={16} />
        {VERIFIED_LABEL}
      </Pill>,
    )

  const hidden = decorative && !tip
  return withTip(
    tip,
    <SealHost
      className={className}
      tabIndex={focusable}
      role={hidden ? undefined : 'img'}
      aria-label={hidden ? undefined : VERIFIED_LABEL}
      aria-hidden={hidden || undefined}
    >
      <Seal size={Math.min(24, Math.max(12, size))} />
    </SealHost>,
  )
}

/** The quiet counterpart: "Community", in the chip style. */
export const CommunityTag = ({
  tooltip,
  className,
}: {
  /** true: the explanation on hover and focus; a string replaces it. */
  tooltip?: boolean | string
  className?: string
}) => {
  const tip = explanationFor(tooltip, COMMUNITY_EXPLANATION)
  return withTip(
    tip,
    <Quiet className={className} tabIndex={tip ? 0 : undefined}>
      {COMMUNITY_LABEL}
    </Quiet>,
  )
}

/**
 * The trust mark for one list: the Verified pill, the Community tag, or
 * nothing while `verified` is unknown (loading, or the indexer failed).
 */
export const TrustTag = ({
  verified,
  listOfLists = false,
  tooltip = true,
}: {
  verified?: boolean
  listOfLists?: boolean
  tooltip?: boolean
}) => {
  if (verified === undefined) return null
  return verified ? (
    <VerifiedBadge variant="pill" listOfLists={listOfLists} tooltip={tooltip} />
  ) : (
    <CommunityTag tooltip={tooltip} />
  )
}
