import { css, keyframes } from 'styled-components'

/*
 * Shared styles for the UI kit, v2 (the glow stage). Only token roles from
 * src/styles/global-styles.ts are used: no raw colors anywhere in the kit.
 * Labels are small uppercase sans, figures are Geist with tabular numbers,
 * floating panels are solid raised surfaces (blur belongs to the app bar,
 * the toolbar and the modal backdrop only), fields are raised.
 */

/*
 * Steps the global scale does not have yet. Each one reads the token name
 * proposed for global-styles.ts and falls back to today's value, so the kit
 * picks the token up as soon as it lands there.
 */
export const kitRadius = {
  /** 10px: buttons and tooltips. */
  control: 'var(--radius-control, 10px)',
  /** 14px: wells, list and alert surfaces, drop zones. */
  well: 'var(--radius-well, 14px)',
} as const

export const kitType = {
  /** 10px: badge counts. */
  micro: 'var(--fs-micro, 10px)',
  /** 12/16: field labels, help lines, tags, tips. */
  meta: 'var(--fs-meta, 12px)',
  metaLine: 'var(--lh-meta, 16px)',
  /** 24/30: result titles. */
  titleMd: 'var(--fs-title-md, 24px)',
  titleMdLine: 'var(--lh-title-md, 30px)',
} as const

/*
 * Movement on hover and press (lifts, dips, grows) is dropped under reduced
 * motion; colour, border and glow still change (SPEC 5.9). Wrap any
 * transform that only decorates an interaction in this.
 */
export const motionOk = (rules: ReturnType<typeof css>) => css`
  @media (prefers-reduced-motion: no-preference) {
    ${rules}
  }
`

export type Tone = 'registered' | 'window' | 'contested' | 'off' | 'neutral'

/** Figures: Geist at 13/18 and 500 with tabular numbers (counts, pages, units). */
export const figureData = css`
  font-family: var(--font-figure);
  font-size: var(--fs-data);
  line-height: var(--lh-data);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
`

/** One easing for every hover, press and colour change in the kit. */
export const kitTransition = (...properties: string[]) =>
  properties
    .map((property) => `${property} var(--dur-hover) var(--ease-out)`)
    .join(', ')

/*
 * The control language (DESIGN.md, Surfaces and controls; round 2, "Lit
 * edge"). Light lives on the edges: the primary action is a glass pill
 * (dark glass on the dark themes, lit white glass on light) whose edge is a
 * conic gradient in the theme's edge hues, turned by the registered
 * --edge-angle so it sweeps round on hover. Selectors sit in a recessed
 * track with a raised, lit glass thumb. Popovers are glass.
 *
 * Every element drawn with litEdgeBackground declares --edge-angle itself:
 * a browser without @property would otherwise drop the whole background.
 */

/** A fill inside the lit 1px edge (the element needs a transparent 1px border). */
export const litEdgeBackground = (fill: string): string =>
  `${fill} padding-box, conic-gradient(from var(--edge-angle), var(--edge-1), var(--edge-2) 25%, var(--edge-3) 50%, color-mix(in srgb, var(--edge-1) 35%, transparent) 75%, var(--edge-1)) border-box`

/** The primary glass: lit from above, deeper at the lip. */
export const ctaFill =
  'linear-gradient(180deg, var(--cta-top), var(--cta-bottom))'

/**
 * Primary action at rest: a glass pill, lit edge (--edge-width: 1px, 1.5px
 * on light), a soft top sheen (::before, so the element must isolate) and a
 * glow pooled inside its lower lip and under it. Its label is --cta-ink,
 * 12:1 or more on the glass in every theme.
 */
export const ctaButton = css`
  --edge-angle: 210deg;
  border: var(--edge-width, 1px) solid transparent;
  background: ${litEdgeBackground(ctaFill)};
  color: var(--cta-ink);
  box-shadow:
    inset 0 1px 0 var(--cta-highlight),
    inset 0 -10px 18px -12px var(--cta-glow),
    0 8px 26px -14px var(--cta-glow);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: linear-gradient(180deg, var(--cta-sheen), transparent 58%);
    pointer-events: none;
  }
`

/** Primary hover and keyboard focus: the edge sweeps round and the glow blooms. */
export const ctaButtonLit = css`
  --edge-angle: 570deg;
  color: var(--cta-ink);
  box-shadow:
    inset 0 1px 0 var(--cta-highlight),
    inset 0 -10px 20px -10px var(--cta-glow),
    0 0 0 4px color-mix(in srgb, var(--edge-2) 12%, transparent),
    0 12px 34px -10px var(--cta-glow);
`

/** The edge's turn; add it to the element's transition list. */
export const edgeTransition = '--edge-angle 900ms var(--ease-out)'

/** Secondary action: a quiet ghost with a hairline; fills on hover. */
export const quietButton = css`
  border: 1px solid var(--color-border-strong);
  background: transparent;
  color: var(--color-text);
  box-shadow: none;
`

export const quietButtonHover = css`
  border-color: color-mix(in srgb, var(--color-text) 30%, transparent);
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
`

/** Recessed track for segmented controls and switches. */
export const recessTrack = css`
  background: var(--recess);
  box-shadow: var(--recess-shadow);
`

/**
 * The raised glass thumb in a recessed track (the element must be
 * positioned). Its ::after is the "lamp": a 2px line of light under the
 * chosen label in the three edge hues, about half the label's width.
 */
export const litThumb = css`
  background: var(--thumb);
  box-shadow:
    var(--thumb-shadow),
    0 6px 16px -10px var(--cta-glow);

  &::after {
    content: '';
    position: absolute;
    left: 22%;
    right: 22%;
    bottom: 0;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--edge-1) 22%,
      var(--edge-2) 50%,
      var(--edge-3) 78%,
      transparent
    );
    box-shadow: 0 0 10px color-mix(in srgb, var(--edge-2) 75%, transparent);
    pointer-events: none;
  }
`

/**
 * Motion for a lit thumb that slides between options, placed with `left`
 * and `right` and told which way it travels (`data-dir="left|right"`): the
 * edge in the direction of travel leads and the other follows 40ms later,
 * so the thumb stretches a little and settles. `data-instant` places it
 * without moving (the first placement, a resize, counts arriving).
 * SegmentedControl and Pagination share it.
 */
export const slidingThumbMotion = css`
  &[data-dir='right'] {
    transition:
      right 260ms var(--ease-spring),
      left 360ms var(--ease-spring) 40ms;
  }

  &[data-dir='left'] {
    transition:
      left 260ms var(--ease-spring),
      right 360ms var(--ease-spring) 40ms;
  }

  &[data-instant] {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none !important;
  }
`

/** Glass popover (select menus, app bar menus): translucent, blurred, hairline. */
export const glassPopover = css`
  border: 1px solid var(--color-border-strong);
  border-radius: 16px;
  background: var(--popover);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-overlay);
  color: var(--color-text);
`

/** Raised panel for menus and popovers: solid fill, 18px radius, hairline, top highlight. */
export const overlayPanel = css`
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-overlay);
  color: var(--color-text);
`

/*
 * Entrance for floating panels. It moves with the individual `scale` and
 * `translate` properties so it composes with a placement `transform`.
 */
export const popIn = keyframes`
  from { opacity: 0; scale: 0.97; translate: 0 -4px; }
  to { opacity: 1; scale: 1; translate: 0 0; }
`

export const popInUp = keyframes`
  from { opacity: 0; scale: 0.97; translate: 0 4px; }
  to { opacity: 1; scale: 1; translate: 0 0; }
`

export const floatingEntrance = (up = false) => css`
  animation: ${up ? popInUp : popIn} 200ms var(--ease-out) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

/** A menu row, as in the app bar menus: 40px, radius 12; the chosen row reads in full text with a check. */
export const menuRow = css`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 4px 12px;
  border-radius: var(--radius);
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
  transition: ${kitTransition('background', 'color')};
`

/** Raised field: 44px, radius 12, hairline; focus is a 2px blue edge with a soft halo. */
export const fieldSurface = css`
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  color: var(--color-text);
  transition: ${kitTransition('border-color', 'box-shadow', 'background')};
`

export const fieldHover = css`
  border-color: var(--color-border-strong);
`

/*
 * Focus: the hairline turns the full action colour and a 1px ring doubles
 * it (a 2px edge that clears 3:1 on every surface), with the soft halo
 * outside it.
 */
export const fieldFocusRing =
  '0 0 0 1px var(--color-primary), 0 0 0 5px var(--color-primary-soft)'

export const fieldFocus = css`
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-raised));
  box-shadow: ${fieldFocusRing};
  outline: none;
`

/** Round ghost icon button (close, clear, remove). Size is set by the caller. */
export const ghostIconButton = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition: ${kitTransition('background', 'color', 'border-color')};

  &:hover:not(:disabled) {
    color: var(--color-text);
    border-color: var(--glass-border);
    background: var(--color-raised);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`

export const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

/** Thin arc that fades into its tail, drawn in the current color. Size by the caller. */
export const ringSpinner = css`
  display: inline-block;
  flex: 0 0 auto;
  border-radius: var(--radius-pill);
  background: conic-gradient(from 0deg, transparent 10%, currentColor);
  /* Masks read only alpha; any opaque token works as the ink. */
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 2px),
    var(--color-text) calc(100% - 1.5px)
  );
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 2px),
    var(--color-text) calc(100% - 1.5px)
  );
  animation: ${spin} 900ms linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2.4s;
  }
`

export const shimmer = keyframes`
  from { background-position: 150% 0; }
  to { background-position: -50% 0; }
`

/** Skeleton block: raised fill with a faint blue sweep (never a spinner). */
export const skeletonBlock = css`
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background-color: var(--color-raised);
  background-image: linear-gradient(
    90deg,
    transparent 30%,
    color-mix(in srgb, var(--color-primary) 9%, transparent) 50%,
    transparent 70%
  );
  background-size: 200% 100%;
  background-repeat: no-repeat;
  animation: ${shimmer} 1.4s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

/** Small status dot with a soft halo in its own tone. */
export const haloDot = (color: string) => css`
  display: inline-block;
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: ${color};
  box-shadow:
    0 0 0 3px color-mix(in srgb, ${color} 22%, transparent),
    0 0 10px color-mix(in srgb, ${color} 45%, transparent);
`

const TONE_WORDS: Record<string, Tone> = {
  registered: 'registered',
  success: 'registered',
  green: 'registered',
  window: 'window',
  processing: 'window',
  info: 'window',
  blue: 'window',
  contested: 'contested',
  warning: 'contested',
  orange: 'contested',
  gold: 'contested',
  amber: 'contested',
  yellow: 'contested',
  off: 'off',
  error: 'off',
  danger: 'off',
  red: 'off',
  neutral: 'neutral',
  default: 'neutral',
  gray: 'neutral',
  grey: 'neutral',
}

/** Maps a status word or a legacy color word onto a status role; undefined otherwise. */
export const toneFor = (value?: string): Tone | undefined =>
  value ? TONE_WORDS[value.toLowerCase()] : undefined

export const toneColor = (tone: Tone): string => `var(--status-${tone})`

export const joinClassNames = (
  ...parts: (string | false | null | undefined)[]
): string => parts.filter(Boolean).join(' ')
