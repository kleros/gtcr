import React, { useState } from 'react'
import styled from 'styled-components'
import { mediaUrl } from './view'

/*
 * A list's or an entry's picture. The image fades in over its fallback once
 * it has loaded, so a slow gateway shows the fallback rather than an empty
 * tile. Several sources can be given (an entry's own image, then its list's
 * logo): when one fails the next is tried, and the fallback stays only when
 * none loads.
 *
 * The fallback is the Kleros icosahedron (the theme menu's projection) cut
 * as a gem and lit from an angle picked from the address, in one of the
 * theme's three edge hues, so lists without a logo still differ from their
 * neighbours. It stands for "a Curate list with no logo of its own"; the
 * row next to it names the list.
 *
 * Logos are drawn whole. A logo whose ink is lost on the tile (black strokes
 * on a transparent ground in a dark theme, white ones in the light theme)
 * gets a contrasting plate: the image is sampled once on a small canvas.
 * The gateway answers with CORS headers, so the sample is allowed; a host
 * that does not is loaded again without CORS and keeps the plain tile.
 *
 * The image is an <img>, never a CSS url(): logo URIs come from metadata
 * that any list creator controls.
 */

/* ---------- The gem ---------- */

// Icosahedron down a three-fold axis, in a 24 unit box: the hexagon
// outline, the front face, and the nine edges joining them.
const HEX = [
  [12, 2.5],
  [20.2, 7.25],
  [20.2, 16.75],
  [12, 21.5],
  [3.8, 16.75],
  [3.8, 7.25],
] as const
const FRONT = [
  [12, 7],
  [16.4, 14.6],
  [7.6, 14.6],
] as const

type Point = readonly [number, number]

// The ten faces in view: the front one, the three that share an edge with
// it, and the six that reach the outline.
const FACETS: Point[][] = [
  [FRONT[0], FRONT[1], FRONT[2]],
  [FRONT[0], FRONT[1], HEX[1]],
  [FRONT[1], FRONT[2], HEX[3]],
  [FRONT[2], FRONT[0], HEX[5]],
  [FRONT[0], HEX[0], HEX[1]],
  [FRONT[0], HEX[5], HEX[0]],
  [FRONT[1], HEX[1], HEX[2]],
  [FRONT[1], HEX[2], HEX[3]],
  [FRONT[2], HEX[3], HEX[4]],
  [FRONT[2], HEX[4], HEX[5]],
]

const pathOf = (points: readonly Point[]) =>
  `M${points.map((point) => point.join(' ')).join('L')}Z`

const FACET_PATHS = FACETS.map(pathOf)
const OUTLINE = pathOf(HEX)
const WIRE = [
  pathOf(FRONT),
  ...[
    [0, 0],
    [0, 1],
    [0, 5],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 3],
    [2, 4],
    [2, 5],
  ].map(
    ([front, corner]) => `M${FRONT[front].join(' ')}L${HEX[corner].join(' ')}`,
  ),
].join('')

/** Each face's direction from the centre (unit vector), null for the front. */
const FACET_DIRECTIONS = FACETS.map((points) => {
  const x = points.reduce((sum, [px]) => sum + px, 0) / 3 - 12
  const y = points.reduce((sum, [, py]) => sum + py, 0) / 3 - 12
  const length = Math.hypot(x, y)
  return length < 1 ? null : ([x / length, y / length] as const)
})

const HUES = ['--edge-1', '--edge-2', '--edge-3'] as const

/** A small stable number from an address or id (FNV-1a). */
const hash = (seed: string): number => {
  let value = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

/** The gem's hue and light angle (degrees, 0 at twelve o'clock) for a seed. */
const gemOf = (seed: string) => {
  const value = hash(seed.toLowerCase())
  return {
    hue: HUES[value % HUES.length],
    angle: (value >>> 4) % 360,
  }
}

const Gem = ({ seed, size }: { seed: string; size: number }) => {
  const { hue, angle } = gemOf(seed)
  const radians = (angle * Math.PI) / 180
  const light = [Math.sin(radians), -Math.cos(radians)] as const
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {FACET_PATHS.map((d, index) => {
        const direction = FACET_DIRECTIONS[index]
        // Faces turned to the light glow, the far side stays dark glass.
        const facing = direction
          ? (direction[0] * light[0] + direction[1] * light[1] + 1) / 2
          : 0.5
        return (
          <path
            key={d}
            d={d}
            fill={`var(${hue})`}
            fillOpacity={0.06 + 0.84 * facing ** 1.8}
          />
        )
      })}
      <path
        d={WIRE}
        stroke="var(--color-text)"
        strokeOpacity="0.24"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d={OUTLINE}
        stroke={`color-mix(in srgb, var(${hue}) 72%, var(--color-text))`}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ---------- Ink sampling ---------- */

interface Ink {
  /** Most of the ink is lost on a dark tile (dark and Kleros themes). */
  dark: boolean
  /** Most of the ink is lost on a light tile (light theme). */
  light: boolean
}

const NO_PLATE: Ink = { dark: false, light: false }

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (r: number, g: number, b: number) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

// The tile as painted on a row: raised glass over the surface. Dark and
// Kleros land within a hair of each other, light is its own.
const DARK_TILE = luminance(23, 28, 40)
const LIGHT_TILE = luminance(241, 244, 250)

/** Under this contrast (WCAG's 3:1 for graphics) ink is lost on the tile. */
const LOST = 3
const SAMPLE = 32

const inks = new Map<string, Ink>()

/**
 * Whether a loaded image needs a plate: it has a see-through ground (15% of
 * its area or more) and at least half of its ink is under 3:1 on the tile.
 * Opaque images bring their own ground and never get one.
 */
const sampleInk = (image: HTMLImageElement): Ink => {
  const known = inks.get(image.currentSrc || image.src)
  if (known) return known
  let ink = NO_PLATE
  try {
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE
    canvas.height = SAMPLE
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (context) {
      context.drawImage(image, 0, 0, SAMPLE, SAMPLE)
      const pixels = context.getImageData(0, 0, SAMPLE, SAMPLE).data
      let covered = 0
      let lostOnDark = 0
      let lostOnLight = 0
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3] / 255
        if (alpha < 0.05) continue
        covered += alpha
        const value = luminance(
          pixels[index],
          pixels[index + 1],
          pixels[index + 2],
        )
        if (contrast(value, DARK_TILE) < LOST) lostOnDark += alpha
        if (contrast(value, LIGHT_TILE) < LOST) lostOnLight += alpha
      }
      const seeThrough = 1 - covered / (SAMPLE * SAMPLE)
      if (covered > 0 && seeThrough >= 0.15)
        ink = {
          dark: lostOnDark / covered >= 0.5,
          light: lostOnLight / covered >= 0.5,
        }
    }
  } catch {
    // A canvas the image tainted cannot be read: keep the plain tile.
  }
  inks.set(image.currentSrc || image.src, ink)
  return ink
}

/* ---------- Tile ---------- */

const Tile = styled.span<{ $size: number; $radius: number }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: ${({ $radius }) => $radius}px;
  background-color: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition: background-color 220ms cubic-bezier(0.2, 0.8, 0.2, 1);

  /* The plate: the text colour, so it is light on the dark themes and dark
     on the light one, the opposite of the ink it carries. */
  body:not([data-theme='light']) &[data-ink-dark],
  body[data-theme='light'] &[data-ink-light] {
    background-color: color-mix(
      in srgb,
      var(--color-text) 86%,
      var(--color-surface)
    );
  }

  > svg {
    transition: opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  &[data-loaded] > svg {
    opacity: 0;
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: ${({ $size }) => Math.max(2, Math.round($size * 0.1))}px;
    opacity: 0;
    transition: opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  img[data-loaded='true'] {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    &,
    > svg,
    img {
      transition: none;
    }
  }
`

type Attempt = {
  /** The sources this attempt belongs to; new sources start over. */
  key: string
  index: number
  /** Loaded with CORS, so the image can be sampled. */
  cors: boolean
  status: 'loading' | 'loaded'
  ink: Ink
}

const start = (key: string): Attempt => ({
  key,
  index: 0,
  cors: true,
  status: 'loading',
  ink: NO_PLATE,
})

export const Avatar = ({
  uri,
  seed,
  size = 44,
  radius,
  style,
  className,
}: {
  /**
   * Image URIs as stored (IPFS path, ipfs://, bare CID or https), tried in
   * order: an entry's image, then its list's logo.
   */
  uri?: string | null | Array<string | null | undefined>
  /** Address that picks the gem's hue and light. */
  seed: string
  size?: number
  radius?: number
  style?: React.CSSProperties
  className?: string
}) => {
  const sources = [
    ...new Set(
      (Array.isArray(uri) ? uri : [uri])
        .map((value) => mediaUrl(value))
        .filter((value): value is string => !!value),
    ),
  ]
  const key = sources.join('\n')
  const [stored, setAttempt] = useState<Attempt>(() => start(key))
  const attempt = stored.key === key ? stored : start(key)
  const src = sources[attempt.index]
  const loaded = !!src && attempt.status === 'loaded'
  const { hue, angle } = gemOf(seed)
  const radians = (angle * Math.PI) / 180

  const onError = () =>
    setAttempt(
      attempt.cors
        ? // A host without CORS headers: load it again without CORS.
          { ...attempt, cors: false, status: 'loading' }
        : { ...attempt, index: attempt.index + 1, cors: true },
    )

  const onLoad = (event: React.SyntheticEvent<HTMLImageElement>) =>
    setAttempt({
      ...attempt,
      status: 'loaded',
      ink: attempt.cors ? sampleInk(event.currentTarget) : NO_PLATE,
    })

  return (
    <Tile
      aria-hidden
      className={className}
      $size={size}
      $radius={radius ?? (size >= 40 ? 12 : size >= 30 ? 9 : 7)}
      data-loaded={loaded || undefined}
      data-ink-dark={(loaded && attempt.ink.dark) || undefined}
      data-ink-light={(loaded && attempt.ink.light) || undefined}
      style={{
        // The gem's glow pools on the side its light comes from; a loaded
        // image sits on the plain tile (or its plate).
        backgroundImage: loaded
          ? 'none'
          : `radial-gradient(110% 110% at ${Math.round(
              50 + 50 * Math.sin(radians),
            )}% ${Math.round(
              50 - 50 * Math.cos(radians),
            )}%, color-mix(in srgb, var(${hue}) 28%, transparent), transparent 64%)`,
        ...style,
      }}
    >
      <Gem seed={seed} size={Math.round(size * 0.7)} />
      {src && (
        <img
          key={`${src}|${attempt.cors}`}
          src={src}
          alt=""
          crossOrigin={attempt.cors ? 'anonymous' : undefined}
          data-loaded={loaded}
          onLoad={onLoad}
          onError={onError}
        />
      )}
    </Tile>
  )
}
