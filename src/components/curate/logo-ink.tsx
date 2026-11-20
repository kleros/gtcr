import React, { useState } from 'react'
import { css } from 'styled-components'

/*
 * Logos are drawn whole. A logo whose ink is lost on its tile (black strokes
 * on a transparent ground in a dark theme, white ones in the light theme)
 * gets a contrasting plate: the image is sampled once on a small canvas.
 * The IPFS gateway answers with CORS headers, so the sample is allowed; a
 * host that does not is loaded again without CORS and keeps the plain tile.
 */

export interface Ink {
  /** Most of the ink is lost on a dark tile (dark and Kleros themes). */
  dark: boolean
  /** Most of the ink is lost on a light tile (light theme). */
  light: boolean
}

export const NO_PLATE: Ink = { dark: false, light: false }

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
export const sampleInk = (image: HTMLImageElement): Ink => {
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

/**
 * The plate, on the element that paints the logo's tile: the text colour,
 * so it is light on the dark themes and dark on the light one, the opposite
 * of the ink it carries.
 */
export const inkPlate = css`
  body:not([data-theme='light']) &[data-ink-dark],
  body[data-theme='light'] &[data-ink-light] {
    background-color: color-mix(
      in srgb,
      var(--color-text) 86%,
      var(--color-surface)
    );
  }
`

/**
 * For a logo <img>: it loads with CORS so it can be sampled, and once loaded
 * says whether its ink is lost on the theme's tile. `key` goes on the <img>
 * (a new element when CORS is dropped), `img` on the <img> and `plate` on the
 * element that paints the tile (the <img> itself when it has the
 * background). `failed` is set once neither attempt loaded.
 */
export const useLogoInk = (src?: string | null) => {
  const [state, setState] = useState<{
    src?: string | null
    cors: boolean
    ink: Ink
    failed: boolean
  }>({ src, cors: true, ink: NO_PLATE, failed: false })
  const current =
    state.src === src
      ? state
      : { src, cors: true, ink: NO_PLATE, failed: false }
  return {
    key: `${src ?? ''}|${current.cors}`,
    failed: current.failed,
    img: {
      crossOrigin: current.cors ? ('anonymous' as const) : undefined,
      onLoad: (event: React.SyntheticEvent<HTMLImageElement>) =>
        setState({
          src,
          cors: current.cors,
          ink: current.cors ? sampleInk(event.currentTarget) : NO_PLATE,
          failed: false,
        }),
      onError: () =>
        setState(
          current.cors
            ? // A host without CORS headers: load it again without CORS.
              { src, cors: false, ink: NO_PLATE, failed: false }
            : { src, cors: false, ink: NO_PLATE, failed: true },
        ),
    },
    plate: {
      'data-ink-dark': current.ink.dark || undefined,
      'data-ink-light': current.ink.light || undefined,
    },
  }
}

/** An <img> that is its own tile, with the plate when its ink is lost. */
export const PlatedImg = ({
  src,
  alt,
  ...rest
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  src: string
  alt: string
}) => {
  const ink = useLogoInk(src)
  return (
    <img
      key={ink.key}
      src={src}
      alt={alt}
      {...rest}
      {...ink.img}
      {...ink.plate}
    />
  )
}
