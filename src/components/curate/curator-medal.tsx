import React, { useId } from 'react'
import styled from 'styled-components'

/*
 * The curator's medals (round 10: "design beautiful badges … when achieved
 * they are displayed in the profile page on top"). They are cut in the
 * Kleros Verified seal's language (verified-badge.tsx), so the page has one
 * family of marks: a faceted gem of the primary glass (cta-top to
 * cta-bottom) tinted by the three edge hues the way the lit edge runs round
 * a button, a gradient rim, a top sheen and a soft edge-2 glow, with the
 * glyph cut into the face in cta-ink.
 *
 * Each badge has its own outline, so the four tell apart at a glance even
 * at 28px, and its own glyph:
 *   Librarian   a hexagon, a shelf of books    (submissions)
 *   Sheriff     a shield, a star               (challenges)
 *   Maintainer  an octagon, a broom            (removal requests)
 *   Juror       a round seal, the scales       (seats in Curate disputes)
 *
 * Unearned, the same medal is set in recessed glass: no hue, a hairline
 * rim and a faint glyph, inside a progress ring in the window blue, so a
 * badge on its way reads as the badge, dimmed, with how far there is to
 * go. Nothing here is a button; the medal is named by its caller (role img
 * with a label) or hidden when its name is written beside it.
 *
 * Earned, a medal carries its level (round 12, pages/address/levels.ts) on
 * a small pip at its lower right: the numeral in the figure face on the same
 * primary glass with a lit rim, set in pixels, not in the medal's units, so
 * it reads the same at every size. Level 10's two digits widen it into a
 * pill.
 */

export type MedalKind = 'librarian' | 'sheriff' | 'maintainer' | 'juror'

type Point = readonly [number, number]

const C = 32 // centre of the 64-unit box

const polygon = (sides: number, radius: number, rotation: number): Point[] =>
  Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index * 2 * Math.PI) / sides
    return [
      +(C + radius * Math.cos(angle)).toFixed(2),
      +(C + radius * Math.sin(angle)).toFixed(2),
    ] as const
  })

const pathOf = (points: readonly Point[]) =>
  `M${points.map((point) => point.join(' ')).join('L')}Z`

/* The outlines, all inside a 24-unit radius so the glow and the progress
   ring have room. */
const HEXAGON = polygon(6, 23, -Math.PI / 2)
const OCTAGON = polygon(8, 23, -Math.PI / 2 + Math.PI / 8)
const SHIELD: Point[] = [
  [32, 8],
  [52, 15],
  [50, 34],
  [42, 47],
  [32, 55],
  [22, 47],
  [14, 34],
  [12, 15],
]

/* The face: the outline drawn smaller round the centre, the bevel's inner
   edge. */
const shrink = (points: readonly Point[], factor: number): Point[] =>
  points.map(
    ([x, y]) =>
      [
        +(C + (x - C) * factor).toFixed(2),
        +(C + (y - C) * factor).toFixed(2),
      ] as const,
  )

const OUTLINES: Record<Exclude<MedalKind, 'juror'>, Point[]> = {
  librarian: HEXAGON,
  sheriff: SHIELD,
  maintainer: OCTAGON,
}

/* The glyphs, drawn on a 24-unit grid centred in the face. */
const GLYPHS: Record<MedalKind, string> = {
  // Three books on a shelf, the last one leaning.
  librarian:
    'M5 18.5h14M6.5 18.5V7.5h3v11M10.5 18.5V5.5h3v13M14.6 18.3l2.2-10.6 2.9.6-2.2 10.6',
  // A five-pointed star.
  sheriff:
    'M12 4.2l2.3 4.9 5.3.6-3.9 3.6 1 5.3L12 16l-4.7 2.6 1-5.3-3.9-3.6 5.3-.6z',
  // A broom: the handle, the head's outline, two lines of bristles.
  maintainer:
    'M18 4.5l-4.8 8M10 11.4l6.4 3.7-2.6 6-7.4-4.3zM8.9 17.5l2.6-4.4M11.5 19l2.4-4.2',
  // The scales: post, beam, the two pans.
  juror:
    'M12 4.5v15M7.5 19.5h9M5 8h14M7 8l-2.8 6h5.6zM17 8l-2.8 6h5.6zM3.8 14a3.2 1.6 0 0 0 6.4 0M13.8 14a3.2 1.6 0 0 0 6.4 0',
}

export const MEDAL_NAMES: Record<MedalKind, string> = {
  librarian: 'Librarian',
  sheriff: 'Sheriff',
  maintainer: 'Maintainer',
  juror: 'Juror on Curate',
}

const tint = (hue: 1 | 2 | 3, share: number, glass: 'top' | 'bottom') =>
  `color-mix(in srgb, var(--edge-${hue}) ${share}%, var(--cta-${glass}))`

/* The medal's box, so the level pip can sit on its corner. */
const Frame = styled.span`
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: middle;
`

const LevelPip = styled.span`
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 19px;
  height: 19px;
  padding: 0 4px;
  border: 1px solid color-mix(in srgb, var(--edge-2) 70%, transparent);
  border-radius: var(--radius-pill);
  background: linear-gradient(180deg, var(--cta-top), var(--cta-bottom));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 0 0 2px var(--color-raised),
    0 0 8px color-mix(in srgb, var(--edge-2) 40%, transparent);
  color: var(--cta-ink);
  font-family: var(--font-figure);
  font-size: 11px;
  line-height: 1;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
`

const Svg = styled.svg<{ $earned: boolean }>`
  display: block;
  flex: 0 0 auto;
  overflow: visible;

  ${({ $earned }) =>
    $earned &&
    `
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--edge-2) 38%, transparent))
      drop-shadow(0 4px 10px color-mix(in srgb, var(--edge-1) 22%, transparent));
  `}
`

export const CuratorMedal = ({
  kind,
  earned,
  progress = 0,
  level,
  size = 56,
  label,
  className,
}: {
  kind: MedalKind
  earned: boolean
  /** 0 to 1, for the ring round an unearned medal. */
  progress?: number
  /** Drawn on a pip at the lower right when the medal is earned. */
  level?: number
  size?: number
  /** Names the medal for assistive tech; without it the medal is hidden. */
  label?: string
  className?: string
}) => {
  const id = useId().replace(/:/g, '')
  const round = kind === 'juror'
  const outline = round ? undefined : OUTLINES[kind]
  const face = outline ? shrink(outline, 0.74) : undefined
  const share = Math.min(1, Math.max(0, progress))
  const ring = 2 * Math.PI * 29.5

  return (
    <Frame
      className={className}
      style={{ width: size, height: size }}
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true })}
    >
      <Svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        $earned={earned}
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              stopColor={earned ? tint(1, 34, 'top') : 'var(--color-raised)'}
            />
            <stop
              offset="0.55"
              stopColor={
                earned ? tint(3, 22, 'bottom') : 'var(--color-surface)'
              }
            />
            <stop
              offset="1"
              stopColor={
                earned ? tint(2, 30, 'bottom') : 'var(--color-surface)'
              }
            />
          </linearGradient>
          <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0"
              stopColor={earned ? tint(2, 26, 'top') : 'var(--color-surface)'}
            />
            <stop
              offset="1"
              stopColor={
                earned ? tint(1, 18, 'bottom') : 'var(--color-surface)'
              }
            />
          </linearGradient>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0"
              stopColor={
                earned ? 'var(--edge-1)' : 'var(--color-border-strong)'
              }
            />
            <stop
              offset="0.5"
              stopColor={
                earned ? 'var(--edge-2)' : 'var(--color-border-strong)'
              }
            />
            <stop
              offset="1"
              stopColor={
                earned ? 'var(--edge-3)' : 'var(--color-border-strong)'
              }
            />
          </linearGradient>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              stopColor="#fff"
              stopOpacity={earned ? 0.32 : 0.06}
            />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The progress ring round an unearned medal: the track, then the share. */}
        {!earned && (
          <g>
            <circle
              cx={C}
              cy={C}
              r="29.5"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="2"
            />
            {share > 0 && (
              <circle
                cx={C}
                cy={C}
                r="29.5"
                fill="none"
                stroke="var(--status-window)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${(ring * share).toFixed(2)} ${ring.toFixed(2)}`}
                transform={`rotate(-90 ${C} ${C})`}
              />
            )}
          </g>
        )}

        {round ? (
          <>
            <circle
              cx={C}
              cy={C}
              r="23"
              fill={`url(#${id}-glass)`}
              stroke={`url(#${id}-rim)`}
              strokeWidth="1.4"
            />
            <circle
              cx={C}
              cy={C}
              r="17.5"
              fill={`url(#${id}-face)`}
              stroke="#fff"
              strokeOpacity={earned ? 0.22 : 0.06}
              strokeWidth="0.8"
            />
            {/* The seal's milled edge: short ticks round the rim. */}
            <g
              stroke="#fff"
              strokeOpacity={earned ? 0.28 : 0.08}
              strokeWidth="0.9"
              strokeLinecap="round"
            >
              {Array.from({ length: 24 }, (_, index) => {
                const angle = (index * Math.PI) / 12
                const x1 = C + 19.5 * Math.cos(angle)
                const y1 = C + 19.5 * Math.sin(angle)
                const x2 = C + 21.4 * Math.cos(angle)
                const y2 = C + 21.4 * Math.sin(angle)
                return (
                  <line
                    key={index}
                    x1={x1.toFixed(2)}
                    y1={y1.toFixed(2)}
                    x2={x2.toFixed(2)}
                    y2={y2.toFixed(2)}
                  />
                )
              })}
            </g>
            <circle cx={C} cy={C} r="23" fill={`url(#${id}-sheen)`} />
          </>
        ) : (
          outline &&
          face && (
            <>
              <path
                d={pathOf(outline)}
                fill={`url(#${id}-glass)`}
                stroke={`url(#${id}-rim)`}
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              {/* The bevel: each corner to the face's, white facet lines. */}
              <g
                stroke="#fff"
                strokeOpacity={earned ? 0.2 : 0.06}
                strokeWidth="0.7"
              >
                {outline.map((point, index) => (
                  <line
                    key={index}
                    x1={point[0]}
                    y1={point[1]}
                    x2={face[index][0]}
                    y2={face[index][1]}
                  />
                ))}
              </g>
              <path
                d={pathOf(face)}
                fill={`url(#${id}-face)`}
                stroke="#fff"
                strokeOpacity={earned ? 0.24 : 0.06}
                strokeWidth="0.8"
                strokeLinejoin="round"
              />
              <path d={pathOf(outline)} fill={`url(#${id}-sheen)`} />
            </>
          )
        )}

        {/* The glyph, cut into the face. */}
        <g transform={`translate(${C - 12} ${C - 12})`}>
          <path
            d={GLYPHS[kind]}
            fill="none"
            stroke={earned ? 'var(--cta-ink)' : 'var(--color-faint)'}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </Svg>
      {earned && level !== undefined && level > 0 && (
        <LevelPip>{level}</LevelPip>
      )}
    </Frame>
  )
}

export default CuratorMedal
