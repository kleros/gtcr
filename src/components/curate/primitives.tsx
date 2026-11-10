import React from 'react'
import { createPortal } from 'react-dom'
import styled, { css, keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import { CurateIcon, type CurateIconName } from './icons'
import ChainLogo from 'components/chain-logo'
import { NETWORKS_INFO } from 'config/networks'
import {
  ctaButton,
  ctaButtonLit,
  edgeTransition,
  glassPopover,
  litThumb,
  quietButton,
  quietButtonHover,
  recessTrack,
  slidingThumbMotion,
} from 'components/ui/kit-styles'

/*
 * CurateVision primitives, built from DESIGN.md. Every page composes these:
 * layout (Page, Section, Surface), type (Statement, Heading, Label, Data, Figure),
 * controls (Button, Chip, Segmented), status (StatusDot, Status), tables and
 * empty/skeleton states. Colors come only from the token roles in global-styles.
 */

/* ---------- Layout ---------- */

export const Page = styled.main`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: 40px var(--horizontal-padding) 96px;

  @media (max-width: 720px) {
    padding-top: 24px;
    padding-bottom: 64px;
  }
`

export const Section = styled.section<{ $gap?: 'sm' | 'md' | 'lg' }>`
  margin-top: ${({ $gap }) =>
    $gap === 'sm' ? '16px' : $gap === 'lg' ? '48px' : '32px'};

  &:first-child {
    margin-top: 0;
  }
`

export const Stack = styled.div<{ $gap?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $gap }) => $gap ?? 12}px;
`

export const Row = styled.div<{
  $gap?: number
  $wrap?: boolean
  $align?: string
  $justify?: string
}>`
  display: flex;
  align-items: ${({ $align }) => $align ?? 'center'};
  justify-content: ${({ $justify }) => $justify ?? 'flex-start'};
  flex-wrap: ${({ $wrap }) => ($wrap ? 'wrap' : 'nowrap')};
  gap: ${({ $gap }) => $gap ?? 8}px;
  min-width: 0;
`

export const Surface = styled.div<{
  $padding?: 'none' | 'compact' | 'standard'
  $interactive?: boolean
  $raised?: boolean
  /** One panel per page may carry the iridescent rim (YMax's chart frame). */
  $featured?: boolean
}>`
  position: relative;
  min-width: 0;
  background: ${({ $raised }) =>
    $raised ? 'var(--color-raised)' : 'var(--color-surface)'};
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-card);
  padding: ${({ $padding }) =>
    $padding === 'none' ? 0 : $padding === 'compact' ? '18px' : '24px'};
  transition:
    border-color var(--motion),
    box-shadow var(--motion),
    transform var(--motion);

  ${({ $featured }) =>
    $featured &&
    css`
      border-color: transparent;
      background:
        linear-gradient(var(--color-surface), var(--color-surface)) padding-box,
        linear-gradient(
            120deg,
            var(--aurora-b),
            color-mix(in srgb, var(--color-warning) 70%, transparent) 38%,
            var(--aurora-c) 68%,
            var(--aurora-a)
          )
          border-box;
      border-width: 1.5px;

      &::after {
        content: '';
        position: absolute;
        inset: -1.5px;
        padding: 1.5px;
        border-radius: inherit;
        background: conic-gradient(
          from var(--cv-comet),
          transparent 0deg 290deg,
          color-mix(in srgb, var(--color-primary) 80%, transparent) 340deg,
          white 354deg,
          transparent 360deg
        );
        -webkit-mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
        opacity: 0;
        animation: cv-comet 2800ms cubic-bezier(0.45, 0, 0.2, 1) 500ms 1 both;
      }

      @media (prefers-reduced-motion: reduce) {
        &::after {
          display: none;
        }
      }
    `}

  ${({ $interactive }) =>
    $interactive &&
    css`
      cursor: pointer;
      color: inherit;
      text-decoration: none;

      &:hover {
        border-color: var(--color-border-strong);
        box-shadow:
          inset 0 1px 0 var(--glass-highlight),
          var(--shadow-card-hover);
        transform: translateY(-1px);
      }
    `}
`

export const Hairline = styled.hr`
  margin: 0;
  border: 0;
  border-top: 1px solid var(--color-border);
`

export const Grid = styled.div<{ $min?: number; $gap?: number }>`
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(${({ $min }) => $min ?? 280}px, 1fr)
  );
  gap: ${({ $gap }) => $gap ?? 16}px;
`

export const SplitGrid = styled.div<{ $rail?: number }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) ${({ $rail }) => $rail ?? 360}px;
  gap: 24px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`

/* ---------- Type ---------- */

/** The page's one statement: large, light, tight (no serif). */
export const Statement = styled.h1`
  margin: 0;
  max-width: 22ch;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--fs-display);
  line-height: var(--lh-display);
  font-weight: 500;
  letter-spacing: -0.03em;
  text-wrap: balance;
`

/** Oversized hero line for the landing moments (dashboard, launch). */
export const HeroStatement = styled.h1`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--fs-hero);
  line-height: var(--lh-hero);
  font-weight: 500;
  letter-spacing: -0.035em;
  text-wrap: balance;

  em {
    font-style: normal;
    color: var(--color-primary);
  }
`

export const Heading = styled.h2`
  margin: 0;
  font-family: var(--font-display);
  color: var(--color-text);
  font-size: var(--fs-heading);
  line-height: var(--lh-heading);
  font-weight: 500;
  letter-spacing: var(--tracking-tight);
`

export const Subheading = styled.h3`
  margin: 0;
  color: var(--color-text);
  font-size: var(--fs-subheading);
  line-height: var(--lh-subheading);
  font-weight: 500;
  letter-spacing: -0.01em;
`

export const Title = styled.h4`
  margin: 0;
  color: var(--color-text);
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);
  font-weight: 600;
`

export const Body = styled.p<{ $muted?: boolean; $large?: boolean }>`
  margin: 0;
  max-width: 68ch;
  color: ${({ $muted }) =>
    $muted ? 'var(--color-muted)' : 'var(--color-text)'};
  font-size: ${({ $large }) =>
    $large ? 'var(--fs-body-lg)' : 'var(--fs-body)'};
  line-height: ${({ $large }) =>
    $large ? 'var(--lh-body-lg)' : 'var(--lh-body)'};
`

export const Small = styled.span<{ $muted?: boolean; $faint?: boolean }>`
  color: ${({ $muted, $faint }) =>
    $faint
      ? 'var(--color-faint)'
      : $muted
        ? 'var(--color-muted)'
        : 'var(--color-text)'};
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/** Small uppercase label (eyebrows, column headers): sans, tracked, quiet. */
export const Label = styled.span<{
  $tone?: 'muted' | 'faint' | 'text' | 'primary'
}>`
  display: inline-block;
  color: ${({ $tone }) =>
    $tone === 'faint'
      ? 'var(--color-faint)'
      : $tone === 'text'
        ? 'var(--color-text)'
        : $tone === 'primary'
          ? 'var(--color-primary)'
          : 'var(--color-muted)'};
  font-family: var(--font-label);
  font-size: var(--fs-label);
  line-height: var(--lh-label);
  font-weight: 500;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
`

/**
 * Data: figures, amounts and short values (13/18, tabular figures).
 * `$mono` sets Geist Mono, for addresses, hashes and IDs only.
 */
export const Data = styled.span<{
  $muted?: boolean
  $weight?: 400 | 500 | 600
  $mono?: boolean
}>`
  color: ${({ $muted }) =>
    $muted ? 'var(--color-muted)' : 'var(--color-text)'};
  font-family: ${({ $mono }) =>
    $mono ? 'var(--font-mono)' : 'var(--font-figure)'};
  font-size: var(--fs-data);
  line-height: var(--lh-data);
  font-weight: ${({ $weight }) => $weight ?? 500};
  font-variant-numeric: tabular-nums;
`

/** Big figure (hero counts, countdowns): light, large, tabular. */
export const Figure = styled.span<{ $size?: 'md' | 'lg' }>`
  display: block;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: ${({ $size }) =>
    $size === 'lg' ? 'clamp(40px, 3.4vw + 16px, 64px)' : 'var(--fs-figure)'};
  line-height: var(--lh-figure);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--tracking-display);
`

export const Mono = styled.span`
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
`

/** Text for screen readers only (e.g. the final value of an animated figure). */
export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`

/* ---------- Controls ---------- */

/*
 * The control language (round 2, "Lit edge"; DESIGN.md, Surfaces and
 * controls). Primary is a dark glass pill with a luminous 1px edge that
 * sweeps round and glows on hover and focus; secondary is a quiet ghost with
 * a hairline; ghost is text that fills on hover; danger is a soft red tint.
 * No flat blue fill anywhere. Every button is a pill.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonStyles = css<{
  $variant?: ButtonVariant
  $size?: 'sm' | 'md'
  $block?: boolean
}>`
  position: relative;
  isolation: isolate;
  display: ${({ $block }) => ($block ? 'flex' : 'inline-flex')};
  width: ${({ $block }) => ($block ? '100%' : 'auto')};
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: ${({ $size }) => ($size === 'sm' ? '34px' : '44px')};
  padding: 0 ${({ $size }) => ($size === 'sm' ? '14px' : '20px')};
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  font-family: var(--font-sans);
  font-size: ${({ $size }) =>
    $size === 'sm' ? 'var(--fs-small)' : 'var(--fs-body)'};
  line-height: var(--lh-body);
  font-weight: 500;
  letter-spacing: -0.005em;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--motion),
    border-color var(--motion),
    box-shadow 260ms var(--ease-out),
    color var(--motion),
    transform 260ms var(--ease-spring),
    ${edgeTransition};

  @media (prefers-reduced-motion: no-preference) {
    &:active:not(:disabled):not([aria-disabled='true']) {
      transform: scale(0.97);
      transition-duration: var(--dur-press);
    }
  }

  ${({ $variant }) =>
    $variant === 'secondary'
      ? css`
          ${quietButton}

          &:hover:not(:disabled) {
            ${quietButtonHover}
            color: var(--color-text);
          }
        `
      : $variant === 'ghost'
        ? css`
            background: transparent;
            color: var(--color-muted);

            &:hover:not(:disabled) {
              color: var(--color-text);
              background: var(--color-raised);
            }
          `
        : $variant === 'danger'
          ? css`
              border-color: color-mix(
                in srgb,
                var(--color-danger) 38%,
                transparent
              );
              background: var(--color-danger-soft);
              color: var(--color-danger);

              &:hover:not(:disabled) {
                border-color: color-mix(
                  in srgb,
                  var(--color-danger) 60%,
                  transparent
                );
                background: color-mix(
                  in srgb,
                  var(--color-danger) 20%,
                  transparent
                );
                color: var(--color-danger);
              }
            `
          : css`
              ${ctaButton}

              &:hover:not(:disabled):not([aria-disabled='true']),
              &:focus-visible:not(:disabled) {
                ${ctaButtonLit}
              }
            `}

  /* Disabled keeps its label legible: muted text on the raised fill, no glow. */
  &&:disabled,
  &&[aria-disabled='true'] {
    cursor: not-allowed;
    background: var(--color-raised);
    border-color: var(--glass-border);
    color: var(--color-muted);
    box-shadow: none;
    filter: none;
    transform: none;

    &::before {
      content: none;
    }
  }
`

export const Button = styled.button<{
  $variant?: ButtonVariant
  $size?: 'sm' | 'md'
  $block?: boolean
}>`
  ${buttonStyles}
`

export const ButtonLink = styled(Link)<{
  $variant?: ButtonVariant
  $size?: 'sm' | 'md'
  $block?: boolean
}>`
  ${buttonStyles}
`

export const ButtonAnchor = styled.a<{
  $variant?: ButtonVariant
  $size?: 'sm' | 'md'
  $block?: boolean
}>`
  ${buttonStyles}
`

export const IconButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid
    ${({ $active }) => ($active ? 'var(--glass-border)' : 'transparent')};
  border-radius: var(--radius-pill);
  background: ${({ $active }) => ($active ? 'var(--glass)' : 'transparent')};
  color: ${({ $active }) =>
    $active ? 'var(--color-text)' : 'var(--color-muted)'};
  cursor: pointer;
  transition:
    background var(--motion),
    color var(--motion);

  &:hover {
    color: var(--color-text);
    background: var(--color-raised);
  }
`

/*
 * 24px pill chip, sans label. A selected chip speaks the selector language,
 * never a blue tint: it sits on the raised glass thumb of a chosen segment
 * (litThumb) with its lamp, the 2px line of light under the label, and the
 * label in full text (10:1 or more in every theme). The conic lit edge is
 * kept for primary actions and the Kleros Verified pill, so a selected chip
 * never reads as that badge of approval.
 */
const selectedChip = css`
  position: relative;
  border-color: transparent;
  color: var(--color-text);
  ${litThumb}
`

const chipStyles = css<{ $selected?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass);
  color: var(--color-muted);
  font-family: var(--font-label);
  font-size: 11px;
  line-height: var(--lh-label);
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;

  ${({ $selected }) => $selected && selectedChip}
`

export const Chip = styled.span<{ $selected?: boolean }>`
  ${chipStyles}
`

/** A chip that toggles; `$selected` lights it and reads as aria-pressed. */
export const ChipButton = styled.button.attrs<{ $selected?: boolean }>(
  ({ $selected }) => ({
    'aria-pressed': $selected === undefined ? undefined : $selected,
  }),
)<{ $selected?: boolean }>`
  ${chipStyles}
  height: 28px;
  cursor: pointer;
  transition:
    background var(--motion),
    color var(--motion),
    box-shadow var(--motion);

  &:hover {
    color: var(--color-text);
    ${({ $selected }) =>
      !$selected &&
      css`
        background: var(--color-raised);
      `}
  }
`

export const ChainChip = ({
  chainId,
  size = 'md',
}: {
  chainId: number
  size?: 'sm' | 'md'
}) => {
  const info = NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]
  return (
    <Chip title={info ? `${info.name} (chain ${chainId})` : `Chain ${chainId}`}>
      <ChainLogo chainId={chainId} size={size === 'sm' ? 12 : 14} />
      {info?.name ?? `Chain ${chainId}`}
    </Chip>
  )
}

/* Each mark's plate is opaque (see chain-logo), so the overlap reads cleanly. */
const StackWrap = styled.span<{ $size: number }>`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;

  > span + span {
    margin-left: ${({ $size }) => -Math.round($size * 0.38)}px;
  }
`

/**
 * Several chain marks, overlapped: the glyph for a scope that covers more
 * than one chain ("All chains" is the Ethereum and Gnosis marks), so the
 * icon says what it covers. Decorative; the label names the chains.
 */
export const ChainStack = ({
  chainIds,
  size = 16,
}: {
  chainIds: number[]
  size?: number
}) => (
  <StackWrap $size={size} aria-hidden>
    {chainIds.map((chainId) => (
      <ChainLogo key={chainId} chainId={chainId} size={size} />
    ))}
  </StackWrap>
)

/** Width of the fade at a scrolling track's hidden end. */
const EDGE_FADE = 28
/*
 * How much of the next option a scrolling track keeps in view beside the
 * chosen one: more than the fade, so the chosen option never sits under it
 * and the neighbour's label shows, cut by the fade.
 */
const EDGE_PEEK = 44

/*
 * Selectors (round 2): a recessed track with a raised, lit glass thumb.
 * `Segmented` and `Segment` are the static parts (the active segment draws
 * its own thumb); `SegmentedControl` is the full control, whose thumb slides
 * on a spring, leading edge first.
 */
export const Segmented = styled.div`
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-pill);
  ${recessTrack}
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  /*
   * A track too wide for its space scrolls sideways with no scrollbar, so
   * each end that hides options fades out (useEdgeFade sets data-fade):
   * the word cut by the fade says there is more that way.
   */
  &[data-fade] {
    --fade-start: 0px;
    --fade-end: 0px;
    -webkit-mask-image: linear-gradient(
      90deg,
      transparent,
      #000 var(--fade-start),
      #000 calc(100% - var(--fade-end)),
      transparent
    );
    mask-image: linear-gradient(
      90deg,
      transparent,
      #000 var(--fade-start),
      #000 calc(100% - var(--fade-end)),
      transparent
    );
  }

  &[data-fade~='start'] {
    --fade-start: ${EDGE_FADE}px;
  }

  &[data-fade~='end'] {
    --fade-end: ${EDGE_FADE}px;
  }
`

/**
 * Keeps `data-fade` on a sideways-scrolling track up to date: "start" when
 * options are hidden before the left edge, "end" when some are hidden past
 * the right one, nothing when everything fits. It follows scrolling, the
 * track's size and each option's size (counts arriving, fonts loading).
 */
const useEdgeFade = (
  ref: React.RefObject<HTMLElement | null>,
  layoutKey: string,
) => {
  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () => {
      const hidden = node.scrollWidth - node.clientWidth
      const edges = [
        node.scrollLeft > 1 && 'start',
        node.scrollLeft < hidden - 1 && 'end',
      ]
        .filter(Boolean)
        .join(' ')
      if (edges) node.dataset.fade = edges
      else delete node.dataset.fade
    }
    update()
    node.addEventListener('scroll', update, { passive: true })
    if (typeof ResizeObserver === 'undefined')
      return () => node.removeEventListener('scroll', update)
    const observer = new ResizeObserver(update)
    observer.observe(node)
    for (const child of node.children) observer.observe(child)
    return () => {
      node.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [ref, layoutKey])
}

export const Segment = styled.button<{
  $active?: boolean
  /** Inside a sliding track the thumb draws the active state. */
  $sliding?: boolean
  $size?: 'sm' | 'md'
}>`
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: ${({ $size }) => ($size === 'sm' ? '28px' : '32px')};
  padding: 0 ${({ $size }) => ($size === 'sm' ? '12px' : '14px')};
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: ${({ $active }) =>
    $active ? 'var(--color-text)' : 'var(--color-muted)'};
  font-family: var(--font-sans);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--motion);

  ${({ $active, $sliding }) =>
    $active &&
    !$sliding &&
    css`
      ${litThumb}
    `}

  &:hover {
    color: var(--color-text);
  }

  /* The track clips, so the focus ring sits inside the segment. */
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  svg {
    flex: 0 0 auto;
  }
`

const SlidingThumb = styled.span`
  position: absolute;
  top: 3px;
  bottom: 3px;
  z-index: -1;
  border-radius: var(--radius-pill);
  ${litThumb}
  ${slidingThumbMotion}
`

/** A segment's count: small tabular figure, brighter on the chosen segment. */
const SegmentCount = styled.span`
  color: var(--color-faint);
  font-family: var(--font-figure);
  font-size: var(--fs-meta);
  font-variant-numeric: tabular-nums;
  transition: color var(--motion);

  [aria-checked='true'] > &,
  [aria-pressed='true'] > & {
    color: var(--color-muted);
  }
`

/** A segment's qualifier, e.g. "testnet": tiny, quiet, outlined. */
const SegmentTag = styled.span`
  padding: 1px 6px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font-size: var(--fs-micro);
  line-height: 14px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`

/** A CurateIcon by name, or an element; an element with a `size` prop takes this size. */
const renderGlyph = (
  icon: CurateIconName | React.ReactElement | undefined,
  size: number,
) => {
  if (icon === undefined) return null
  if (typeof icon === 'string') return <CurateIcon name={icon} size={size} />
  const props = icon.props as { size?: number }
  return 'size' in props
    ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, {
        size,
      })
    : icon
}

export type SegmentOption<T extends string> = {
  value: T
  label: string
  /** A CurateIcon name or any element (a custom glyph, a chain logo). */
  icon?: CurateIconName | React.ReactElement
  /** A count shown after the label (from the same query as the list). */
  count?: number
  /** A qualifier after the label, e.g. "testnet". */
  tag?: string
  /** Show the icon only; the label stays the accessible name and tooltip. */
  hideLabel?: boolean
}

const segmentCount = new Intl.NumberFormat('en-US')

/**
 * Segmented control: a radio group in a recessed track whose lit thumb
 * slides between options. Arrows and Home/End move the choice and focus.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const track = React.useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = React.useState<{
    left: number
    right: number
    dir?: 'left' | 'right'
    instant?: boolean
  }>()
  // Places the thumb under the chosen segment. Only a move animates, and
  // only when the choice changed; anything else (counts arriving, fonts
  // loading, a resize) re-places it in the same frame, glued to its label.
  const measure = React.useCallback((instant: boolean) => {
    const node = track.current
    const checked = node?.querySelector<HTMLButtonElement>(
      '[aria-checked="true"]',
    )
    if (!node || !checked) {
      setThumb(undefined)
      return
    }
    const left = checked.offsetLeft
    const right = node.clientWidth - left - checked.offsetWidth
    setThumb((previous) => {
      if (previous && previous.left === left && previous.right === right)
        return previous
      const dir =
        previous && left !== previous.left
          ? left > previous.left
            ? 'right'
            : 'left'
          : previous?.dir
      // The first placement never animates in from nowhere.
      return { left, right, dir, instant: instant || !previous }
    })
  }, [])
  // Everything that can move a segment without resizing the track: the
  // labels, counts and tags (a count arriving widens its label inside a
  // track capped by max-width on phones), and which options there are.
  const layoutKey = options
    .map((option) =>
      [
        option.value,
        option.label,
        option.count ?? '',
        option.tag ?? '',
        option.hideLabel ? 1 : 0,
      ].join('\u001F'),
    )
    .join('\u001E')
  const placedValue = React.useRef(value)
  React.useLayoutEffect(() => {
    const moved = placedValue.current !== value
    placedValue.current = value
    measure(!moved)
    // A track that scrolls (phones) keeps the chosen option in view with a
    // little of each neighbour beside it (EDGE_PEEK, cut by the edge fade):
    // on arrival (a link to the fourth option), on a change, and when
    // counts arriving push it out.
    const reveal = () => {
      const node = track.current
      const checked = node?.querySelector<HTMLElement>('[aria-checked="true"]')
      if (!node || !checked) return
      const hidden = node.scrollWidth - node.clientWidth
      if (hidden <= 0) return
      const peek = Math.max(
        0,
        Math.min(EDGE_PEEK, (node.clientWidth - checked.offsetWidth) / 2),
      )
      const start = checked.offsetLeft - peek
      const end = checked.offsetLeft + checked.offsetWidth + peek
      const target =
        start < node.scrollLeft
          ? start
          : end > node.scrollLeft + node.clientWidth
            ? end - node.clientWidth
            : node.scrollLeft
      const left = Math.round(Math.max(0, Math.min(hidden, target)))
      if (Math.abs(left - node.scrollLeft) < 1) return
      const smooth =
        moved &&
        !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      node.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })
    }
    // The first placement lands before paint. A new pick scrolls on the
    // next frame, after any layout effect of the page around it.
    if (!moved) {
      reveal()
      return undefined
    }
    const frame = requestAnimationFrame(reveal)
    return () => cancelAnimationFrame(frame)
  }, [measure, value, layoutKey])
  useEdgeFade(track, layoutKey)
  // Re-place without animating when the track or any segment resizes
  // (late web fonts, a label that changes width, a media query).
  React.useEffect(() => {
    const node = track.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure(true))
    observer.observe(node)
    node
      .querySelectorAll<HTMLElement>('[role="radio"]')
      .forEach((segment) => observer.observe(segment))
    return () => observer.disconnect()
  }, [measure, layoutKey])
  // Radio group keys: arrows and Home/End move the selection and the focus.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = options.findIndex((option) => option.value === value)
    const last = options.length - 1
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? index >= last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? index <= 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1
    if (next < 0 || !options[next]) return
    event.preventDefault()
    onChange(options[next].value)
    track.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus()
  }
  const selected = options.some((option) => option.value === value)
  return (
    <Segmented
      ref={track}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={className}
    >
      {thumb && (
        <SlidingThumb
          aria-hidden
          data-dir={thumb.dir}
          data-instant={thumb.instant ? '' : undefined}
          style={{ left: thumb.left, right: thumb.right }}
        />
      )}
      {options.map((option, index) => (
        <Segment
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.hideLabel ? option.label : undefined}
          title={option.hideLabel ? option.label : undefined}
          tabIndex={
            option.value === value || (!selected && index === 0) ? 0 : -1
          }
          $active={option.value === value}
          $sliding
          $size={size}
          style={option.hideLabel ? { paddingInline: 10 } : undefined}
          onClick={() => onChange(option.value)}
        >
          {renderGlyph(option.icon, 15)}
          {!option.hideLabel && option.label}
          {option.tag && <SegmentTag>{option.tag}</SegmentTag>}
          {option.count !== undefined && (
            <SegmentCount>{segmentCount.format(option.count)}</SegmentCount>
          )}
        </Segment>
      ))}
    </Segmented>
  )
}

export type ToggleOption<T extends string> = {
  value: T
  label: string
  /** A CurateIcon name or any element. */
  icon?: CurateIconName | React.ReactElement
  /** A count shown after the label (from the same query as the list). */
  count?: number
  /** Show the icon only; the label stays the accessible name and tooltip. */
  hideLabel?: boolean
}

/**
 * Toggle group: several independent on/off choices in one recessed track,
 * e.g. the registry types (Light, Classic, Stake). Each pressed option sits
 * on its own lit thumb, the same thumb SegmentedControl slides. Buttons with
 * aria-pressed, each its own tab stop; Space or Enter flips one. `value`
 * holds the pressed options and onChange gets them back in option order.
 * For one choice out of several, use SegmentedControl instead.
 *
 *   <ToggleGroup
 *     ariaLabel="Registry type"
 *     value={kinds}
 *     onChange={setKinds}
 *     options={[
 *       { value: 'light', label: 'Light' },
 *       { value: 'classic', label: 'Classic' },
 *       { value: 'stake', label: 'Stake' },
 *     ]}
 *   />
 */
export function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: {
  value: T[]
  options: ToggleOption<T>[]
  onChange: (value: T[]) => void
  ariaLabel: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const track = React.useRef<HTMLDivElement>(null)
  useEdgeFade(
    track,
    options
      .map((option) =>
        [option.value, option.label, option.count ?? ''].join('\u001F'),
      )
      .join('\u001E'),
  )
  return (
    <Segmented
      ref={track}
      role="group"
      aria-label={ariaLabel}
      className={className}
    >
      {options.map((option) => {
        const pressed = value.includes(option.value)
        return (
          <Segment
            key={option.value}
            type="button"
            aria-pressed={pressed}
            aria-label={option.hideLabel ? option.label : undefined}
            title={option.hideLabel ? option.label : undefined}
            $active={pressed}
            $size={size}
            style={option.hideLabel ? { paddingInline: 10 } : undefined}
            onClick={() =>
              onChange(
                options
                  .filter((other) =>
                    other.value === option.value
                      ? !pressed
                      : value.includes(other.value),
                  )
                  .map((other) => other.value),
              )
            }
          >
            {renderGlyph(option.icon, 15)}
            {!option.hideLabel && option.label}
            {option.count !== undefined && (
              <SegmentCount>{segmentCount.format(option.count)}</SegmentCount>
            )}
          </Segment>
        )
      })}
    </Segmented>
  )
}

/* ---------- Select menu ---------- */

/*
 * SelectMenu: the app's dropdown for picking one value (sort orders, chain
 * scopes, the theme). Replaces native <select> and menu-of-radios patterns.
 *
 *   <SelectMenu
 *     label="Sort"                       // names the choice (trigger + a11y)
 *     value={sort}
 *     onChange={setSort}
 *     options={[
 *       { value: 'recent', label: 'Latest activity' },
 *       { value: 'entries', label: 'Most entries', hint: 'Largest first' },
 *       { value: 'sepolia', label: 'Sepolia', tag: 'testnet', divider: true },
 *     ]}
 *   />
 *
 * Appearances: 'quiet' (default) is a hairline pill reading "Sort  Latest
 * activity ⌄" (hideLabel drops the label, keeping it for screen readers);
 * 'chip' is the app bar's glass chip (icon + value); 'icon' is a round icon
 * button showing the chosen option's icon. Options take an icon (a
 * CurateIcon name or any element, e.g. a chain logo), a hint line, a tag and
 * a divider above them. `align="end"` opens the panel from the right edge.
 *
 * The panel is glass, portalled to <body> so no overflow clips it, placed
 * under the trigger (above when there is no room) and kept there on scroll
 * and resize. A highlight slides to the hovered or keyboard-active row; the
 * chosen row carries a check.
 *
 * ARIA: the trigger is a combobox button (aria-haspopup="listbox",
 * aria-expanded, aria-controls, aria-activedescendant) that keeps focus;
 * the panel is a listbox of options with aria-selected. Keys: ArrowDown /
 * ArrowUp / Home / End / Enter / Space open it; inside, the arrows, Home,
 * End, PageUp and PageDown move, Enter or Space pick, Escape closes (and
 * only the menu, never a dialog around it), Tab closes, and typing jumps to
 * the next option starting with the typed letters.
 */
export type SelectMenuOption<T extends string> = {
  value: T
  label: string
  /** A muted second line under the label. */
  hint?: string
  /** Leading glyph: a CurateIcon name or any element (a chain logo). */
  icon?: CurateIconName | React.ReactElement
  /** A small qualifier after the label, e.g. "testnet". */
  tag?: string
  /** Draw a hairline above this option to start a new group. */
  divider?: boolean
  disabled?: boolean
}

export type SelectMenuProps<T extends string> = {
  /** Names the choice: shown on the quiet trigger, read by screen readers. */
  label: string
  value: T
  options: SelectMenuOption<T>[]
  onChange: (value: T) => void
  appearance?: 'quiet' | 'chip' | 'icon'
  /** Quiet trigger: show only the value (the label stays the accessible name). */
  hideLabel?: boolean
  /** Which trigger edge the panel lines up with. */
  align?: 'start' | 'end'
  /** A small heading at the top of the panel. */
  heading?: string
  /** Shown when the value matches no option. */
  placeholder?: string
  /** Custom trigger value (e.g. to hide the text at some widths). */
  renderValue?: (option: SelectMenuOption<T> | undefined) => React.ReactNode
  /** Tooltip on the trigger. */
  title?: string
  /** Panel width floor in px (it is never narrower than the trigger). */
  menuWidth?: number
  disabled?: boolean
  id?: string
  className?: string
}

const MENU_GAP = 8
const MENU_EDGE = 8
const MENU_MAX = 360
const TYPEAHEAD_MS = 600

const MenuChevron = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--color-muted);
  transition: transform var(--dur-control) var(--ease-spring);

  [aria-expanded='true'] > & {
    transform: rotate(180deg);
  }
`

const MenuTrigger = styled.button<{ $appearance: 'quiet' | 'chip' | 'icon' }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
  height: 38px;
  padding: ${({ $appearance }) =>
    $appearance === 'icon'
      ? '0'
      : $appearance === 'chip'
        ? '0 12px 0 10px'
        : '0 12px 0 14px'};
  width: ${({ $appearance }) => ($appearance === 'icon' ? '38px' : 'auto')};
  border: 1px solid
    ${({ $appearance }) =>
      $appearance === 'icon'
        ? 'transparent'
        : $appearance === 'chip'
          ? 'var(--glass-border)'
          : 'var(--color-border-strong)'};
  border-radius: var(--radius-pill);
  background: ${({ $appearance }) =>
    $appearance === 'chip' ? 'var(--glass)' : 'transparent'};
  box-shadow: ${({ $appearance }) =>
    $appearance === 'chip' ? 'inset 0 1px 0 var(--glass-highlight)' : 'none'};
  color: ${({ $appearance }) =>
    $appearance === 'icon' ? 'var(--color-muted)' : 'var(--color-text)'};
  font-family: var(--font-sans);
  font-size: var(--fs-small);
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--motion),
    border-color var(--motion),
    color var(--motion);

  &:hover:not(:disabled),
  &[aria-expanded='true'] {
    border-color: ${({ $appearance }) =>
      $appearance === 'icon'
        ? 'var(--color-border)'
        : 'color-mix(in srgb, var(--color-text) 26%, transparent)'};
    background: var(--color-raised);
    color: var(--color-text);
  }

  &:disabled {
    cursor: not-allowed;
    color: var(--color-muted);
  }
`

const MenuTriggerLabel = styled.span`
  color: var(--color-muted);
  font-weight: 400;
`

const MenuTriggerValue = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`

const menuIn = keyframes`
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
`

const menuInUp = keyframes`
  from { opacity: 0; transform: translateY(4px) scale(0.98); }
`

const MenuPanel = styled.div<{ $up?: boolean }>`
  position: fixed;
  z-index: 1100;
  padding: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  ${glassPopover}
  transform-origin: ${({ $up }) => ($up ? '50% 100%' : '50% 0')};
  animation: ${({ $up }) => ($up ? menuInUp : menuIn)} 200ms var(--ease-out)
    both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const MenuHeading = styled.div`
  padding: 6px 10px 6px;
  color: var(--color-muted);
  font-size: var(--fs-label);
  line-height: var(--lh-label);
  font-weight: 500;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
`

const MenuList = styled.div`
  position: relative;
  isolation: isolate;
  outline: none;
`

const MenuHighlight = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: -1;
  border-radius: 10px;
  background: var(--hover-fill);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition:
    transform 220ms var(--ease-out),
    height 220ms var(--ease-out),
    opacity 120ms linear;
  pointer-events: none;

  &[data-instant] {
    transition: opacity 120ms linear;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const MenuOption = styled.div<{ $divider?: boolean; $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 7px 10px 7px 12px;
  border-radius: 10px;
  color: ${({ $disabled }) =>
    $disabled ? 'var(--color-faint)' : 'var(--color-muted)'};
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  transition: color var(--motion);
  ${({ $divider }) =>
    $divider &&
    css`
      position: relative;
      margin-top: 11px;

      &::before {
        content: '';
        position: absolute;
        top: -6px;
        left: 10px;
        right: 10px;
        height: 1px;
        background: var(--color-border);
      }
    `}

  &[data-active='true'] {
    color: var(--color-text);
  }

  &[aria-selected='true'] {
    color: var(--color-text);
    font-weight: 500;
  }

  > svg,
  > img {
    flex: 0 0 auto;
  }
`

const MenuOptionText = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`

const MenuOptionLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

const MenuOptionHint = styled.span`
  color: var(--color-muted);
  font-size: var(--fs-meta);
  line-height: var(--lh-meta);
  font-weight: 400;
`

const MenuCheck = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  width: 16px;
  color: var(--color-primary);
`

type MenuPlace = {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
  up: boolean
}

export function SelectMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  appearance = 'quiet',
  hideLabel,
  align = 'start',
  heading,
  placeholder = 'Choose',
  renderValue,
  title,
  menuWidth = 220,
  disabled,
  id,
  className,
}: SelectMenuProps<T>) {
  const baseId = React.useId()
  const listId = `${baseId}-list`
  const optionId = (index: number) => `${baseId}-option-${index}`
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const optionRefs = React.useRef<Array<HTMLDivElement | null>>([])
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const [place, setPlace] = React.useState<MenuPlace>()
  const [highlight, setHighlight] = React.useState<{
    top: number
    height: number
    instant: boolean
  }>()
  const typed = React.useRef({ text: '', at: 0 })

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = options[selectedIndex]
  const enabled = (index: number) =>
    index >= 0 && index < options.length && !options[index].disabled

  const close = React.useCallback(() => {
    setOpen(false)
    setActive(-1)
    setHighlight(undefined)
  }, [])

  const openAt = (index: number) => {
    if (disabled) return
    setActive(index)
    setOpen(true)
  }

  const pick = (index: number) => {
    if (!enabled(index)) return
    if (options[index].value !== value) onChange(options[index].value)
    close()
    triggerRef.current?.focus()
  }

  const step = (from: number, delta: number) => {
    let index = from
    for (let moved = 0; moved < options.length; moved += 1) {
      const next = index + delta
      if (next < 0 || next >= options.length) break
      index = next
      if (enabled(index)) return index
    }
    return enabled(from) ? from : -1
  }
  const firstEnabled = () => options.findIndex((option) => !option.disabled)
  const lastEnabled = () => {
    for (let index = options.length - 1; index >= 0; index -= 1)
      if (!options[index].disabled) return index
    return -1
  }

  /** Type-ahead: the next option whose label starts with the typed letters. */
  const matchTyped = (key: string, from: number) => {
    const now = Date.now()
    const memory = typed.current
    memory.text = now - memory.at > TYPEAHEAD_MS ? key : `${memory.text}${key}`
    memory.at = now
    const query = memory.text.toLowerCase()
    const repeat =
      query.length > 1 && query.split('').every((c) => c === query[0])
    const needle = repeat ? query[0] : query
    const start = repeat || query.length === 1 ? from + 1 : from
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (Math.max(start, 0) + offset) % options.length
      if (
        enabled(index) &&
        options[index].label.toLowerCase().startsWith(needle)
      )
        return index
    }
    return -1
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    const { key } = event
    const printable =
      key.length === 1 && key !== ' ' && !event.metaKey && !event.ctrlKey
    if (!open) {
      if (
        key === 'ArrowDown' ||
        key === 'ArrowUp' ||
        key === 'Enter' ||
        key === ' '
      ) {
        event.preventDefault()
        openAt(enabled(selectedIndex) ? selectedIndex : firstEnabled())
      } else if (key === 'Home') {
        event.preventDefault()
        openAt(firstEnabled())
      } else if (key === 'End') {
        event.preventDefault()
        openAt(lastEnabled())
      } else if (printable) {
        const match = matchTyped(key, selectedIndex)
        if (match >= 0) {
          event.preventDefault()
          openAt(match)
        }
      }
      return
    }
    let next = -2
    if (key === 'ArrowDown') next = step(active, 1)
    else if (key === 'ArrowUp')
      next = step(active < 0 ? options.length : active, -1)
    else if (key === 'Home') next = firstEnabled()
    else if (key === 'End') next = lastEnabled()
    else if (key === 'PageDown')
      next = step(Math.min(active + 9, options.length - 1), 1)
    else if (key === 'PageUp') next = step(Math.max(active - 9, 0), -1)
    else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      if (active >= 0) pick(active)
      else close()
      return
    } else if (key === 'Escape') {
      // The menu alone answers Escape, never a dialog around it.
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    } else if (key === 'Tab') {
      close()
      return
    } else if (printable) {
      const match = matchTyped(key, active)
      if (match >= 0) next = match
    }
    if (next === -2) return
    event.preventDefault()
    if (next >= 0) setActive(next)
  }

  // Place the panel under (or above) the trigger, inside the viewport.
  const measure = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = window.innerHeight
    const width = Math.min(
      Math.max(rect.width, menuWidth),
      viewportWidth - MENU_EDGE * 2,
    )
    const natural = panelRef.current?.scrollHeight ?? 0
    const below = viewportHeight - rect.bottom - MENU_GAP - MENU_EDGE
    const above = rect.top - MENU_GAP - MENU_EDGE
    const up = natural > below && above > below
    const room = up ? above : below
    const maxHeight = Math.max(160, Math.min(MENU_MAX, room))
    const start = align === 'end' ? rect.right - width : rect.left
    const left = Math.min(
      Math.max(MENU_EDGE, start),
      viewportWidth - MENU_EDGE - width,
    )
    setPlace({
      left,
      width,
      maxHeight,
      up,
      top: up ? undefined : rect.bottom + MENU_GAP,
      bottom: up ? viewportHeight - rect.top + MENU_GAP : undefined,
    })
  }, [align, menuWidth])

  React.useLayoutEffect(() => {
    if (!open) {
      setPlace(undefined)
      return undefined
    }
    measure()
    const onMove = () => measure()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, measure])

  // Outside presses close the menu (the trigger toggles it itself).
  React.useEffect(() => {
    if (!open) return undefined
    const onPress = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return
      close()
    }
    document.addEventListener('mousedown', onPress)
    document.addEventListener('touchstart', onPress)
    return () => {
      document.removeEventListener('mousedown', onPress)
      document.removeEventListener('touchstart', onPress)
    }
  }, [open, close])

  // The highlight follows the active row; it jumps on open, then slides.
  React.useLayoutEffect(() => {
    if (!open || !place) return
    const node = optionRefs.current[active]
    if (!node) {
      setHighlight(undefined)
      return
    }
    setHighlight((previous) => ({
      top: node.offsetTop,
      height: node.offsetHeight,
      instant: !previous,
    }))
    node.scrollIntoView?.({ block: 'nearest' })
  }, [active, open, place])

  const trigger = (() => {
    if (appearance === 'icon')
      return renderGlyph(selected?.icon ?? 'chevron-down', 19)
    const valueNode = renderValue
      ? renderValue(selected)
      : (selected?.label ?? placeholder)
    return (
      <>
        {appearance === 'chip' && renderGlyph(selected?.icon, 16)}
        {appearance === 'quiet' && !hideLabel && (
          <MenuTriggerLabel>{label}</MenuTriggerLabel>
        )}
        {appearance === 'quiet' &&
          selected?.icon !== undefined &&
          renderGlyph(selected.icon, 15)}
        <MenuTriggerValue data-part="value">{valueNode}</MenuTriggerValue>
        <MenuChevron aria-hidden>
          <CurateIcon name="chevron-down" size={13} />
        </MenuChevron>
      </>
    )
  })()

  return (
    <>
      <MenuTrigger
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && active >= 0 ? optionId(active) : undefined
        }
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        title={title}
        disabled={disabled}
        className={className}
        $appearance={appearance}
        onClick={() =>
          open ? close() : openAt(enabled(selectedIndex) ? selectedIndex : -1)
        }
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (!panelRef.current?.contains(event.relatedTarget as Node)) close()
        }}
      >
        {trigger}
      </MenuTrigger>
      {open &&
        createPortal(
          <MenuPanel
            ref={panelRef}
            $up={place?.up}
            style={{
              left: place?.left ?? 0,
              top: place?.top,
              bottom: place?.bottom,
              width: place?.width ?? menuWidth,
              maxHeight: place?.maxHeight ?? MENU_MAX,
              visibility: place ? 'visible' : 'hidden',
            }}
            // Presses inside keep focus on the trigger.
            onMouseDown={(event) => event.preventDefault()}
          >
            {heading && <MenuHeading aria-hidden>{heading}</MenuHeading>}
            <MenuList
              id={listId}
              role="listbox"
              aria-label={label}
              onMouseLeave={() => setActive(-1)}
            >
              <MenuHighlight
                aria-hidden
                data-instant={highlight?.instant ? '' : undefined}
                style={{
                  transform: `translateY(${highlight?.top ?? 0}px)`,
                  height: highlight?.height ?? 0,
                  opacity: highlight ? 1 : 0,
                }}
              />
              {options.map((option, index) => (
                <MenuOption
                  key={option.value}
                  ref={(node) => {
                    optionRefs.current[index] = node
                  }}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === selectedIndex}
                  aria-disabled={option.disabled || undefined}
                  data-active={index === active}
                  $divider={option.divider}
                  $disabled={option.disabled}
                  onMouseEnter={() => enabled(index) && setActive(index)}
                  onClick={() => pick(index)}
                >
                  {renderGlyph(option.icon, 16)}
                  <MenuOptionText>
                    <MenuOptionLabel>
                      {option.label}
                      {option.tag && <SegmentTag>{option.tag}</SegmentTag>}
                    </MenuOptionLabel>
                    {option.hint && (
                      <MenuOptionHint>{option.hint}</MenuOptionHint>
                    )}
                  </MenuOptionText>
                  <MenuCheck aria-hidden>
                    {index === selectedIndex && (
                      <CurateIcon name="check" size={16} />
                    )}
                  </MenuCheck>
                </MenuOption>
              ))}
            </MenuList>
          </MenuPanel>,
          document.body,
        )}
    </>
  )
}

export const TextInput = styled.input`
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  transition:
    border-color var(--motion),
    box-shadow var(--motion);

  &::placeholder {
    color: var(--color-faint);
  }

  &:hover {
    border-color: var(--color-border-strong);
  }

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 4px var(--color-primary-soft);
  }
`

export const SearchField = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  color: var(--color-faint);
  transition:
    border-color var(--motion),
    box-shadow var(--motion);

  &:hover {
    border-color: var(--color-border-strong);
  }

  &:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 4px var(--color-primary-soft);
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0 !important;
    outline: 0;
    background: transparent !important;
    box-shadow: none !important;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }

  input::placeholder {
    color: var(--color-faint);
  }
`

/* ---------- Status ---------- */

export type StatusTone =
  | 'registered'
  | 'window'
  | 'contested'
  | 'off'
  | 'neutral'

/** 8px dot in a status role color with a soft halo. Never alone: pair it with a label. */
export const StatusDot = styled.span<{ $tone: StatusTone }>`
  display: inline-block;
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--status-${({ $tone }) => $tone});
  box-shadow: 0 0 0 3px
    color-mix(in srgb, var(--status-${({ $tone }) => $tone}) 22%, transparent);
`

const StatusWrap = styled.span<{ $wrap?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  white-space: ${({ $wrap }) => ($wrap ? 'normal' : 'nowrap')};
`

/**
 * Dot + label, optional detail: "Submitted · 2d 4h to challenge".
 * The dot carries the role color; the text stays in the text roles.
 */
export const Status = ({
  tone,
  label,
  detail,
  title,
  className,
}: {
  tone: StatusTone
  label: React.ReactNode
  detail?: React.ReactNode
  title?: string
  className?: string
}) => (
  <StatusWrap className={className} title={title}>
    <StatusDot $tone={tone} aria-hidden />
    <Data $weight={500}>{label}</Data>
    {detail && (
      <Data $muted $weight={400}>
        · {detail}
      </Data>
    )}
  </StatusWrap>
)

/** Kept for the registry panels: a status label shown as a chip. */
export const StatusPill = ({
  tone,
  children,
}: {
  tone: StatusTone
  children: React.ReactNode
}) => (
  <Chip>
    <StatusDot $tone={tone} aria-hidden />
    {children}
  </Chip>
)

/** An 8px indicator used next to "live" labels. */
export const LiveDot = styled(StatusDot).attrs({
  $tone: 'registered' as StatusTone,
})``

/** Progress rail; fill color follows the status tone, with a soft glow. */
export const Rail = styled.div<{ $value: number; $tone?: StatusTone }>`
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: ${({ $value }) =>
      Math.round(Math.min(1, Math.max(0, $value)) * 100)}%;
    border-radius: var(--radius-pill);
    background: var(--status-${({ $tone }) => $tone ?? 'window'});
    box-shadow: 0 0 12px
      color-mix(
        in srgb,
        var(--status-${({ $tone }) => $tone ?? 'window'}) 60%,
        transparent
      );
    transition: width 400ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
`

/* ---------- Panels ---------- */

export const PanelHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
`

export const PanelTitle = styled(Subheading)`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const PanelHint = styled(Label)``

/* ---------- Tables ---------- */

export const TableScroller = styled.div`
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
`

export const Table = styled.table`
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    height: 44px;
    padding: 0 16px;
    border-bottom: 1px solid var(--glass-border);
    background: transparent;
    color: var(--color-faint);
    font-family: var(--font-label);
    font-size: var(--fs-label);
    line-height: var(--lh-label);
    font-weight: 500;
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    text-align: left;
    white-space: nowrap;
  }

  thead th[data-sortable='true'] {
    cursor: pointer;
  }

  thead th[data-sortable='true']:hover {
    color: var(--color-text);
  }

  tbody td {
    height: 56px;
    padding: 0 16px;
    border-bottom: 1px solid var(--glass-border);
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    vertical-align: middle;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  tbody tr {
    transition: background var(--motion);
  }

  tbody tr[data-href]:hover td {
    background: var(--color-raised);
    cursor: pointer;
  }

  td.num,
  th.num {
    text-align: right;
  }

  td.num {
    font-size: var(--fs-body);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

/* ---------- Rows (comfortable list) ---------- */

export const ListRow = styled(Link)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  min-height: 56px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  color: inherit;
  text-decoration: none;
  transition: background var(--motion);

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: var(--color-raised);
  }
`

/* ---------- States ---------- */

const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`

export const SkeletonBlock = styled.div<{ $height?: string; $width?: string }>`
  position: relative;
  overflow: hidden;
  width: ${({ $width }) => $width || '100%'};
  min-height: ${({ $height }) => $height || '20px'};
  border-radius: var(--radius-sm);
  background: var(--color-raised);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      var(--color-surface),
      transparent
    );
    opacity: 0.6;
    animation: ${shimmer} 1.4s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
    }
  }
`

const EmptyWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 40px 24px;
  text-align: center;
  color: var(--color-muted);
`

const EmptyIcon = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-faint);
`

export const EmptyState = ({
  icon = 'list',
  title,
  children,
  action,
}: {
  icon?: CurateIconName
  title: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
}) => (
  <EmptyWrap>
    <EmptyIcon>
      <CurateIcon name={icon} size={18} />
    </EmptyIcon>
    <Title>{title}</Title>
    {children && <Body $muted>{children}</Body>}
    {action && <div style={{ marginTop: 10 }}>{action}</div>}
  </EmptyWrap>
)

/* ---------- Key/value ---------- */

export const KeyValueList = styled.dl`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 8px 16px;
  margin: 0;

  dt {
    color: var(--color-muted);
    font-family: var(--font-label);
    font-size: var(--fs-label);
    line-height: 20px;
    font-weight: 500;
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    min-width: 0;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    overflow-wrap: anywhere;
  }
`

/** Middle-truncated address in mono with a title holding the full value. */
export const truncateMiddle = (value: string, head = 6, tail = 4): string =>
  value.length > head + tail + 1
    ? `${value.slice(0, head)}…${value.slice(-tail)}`
    : value
