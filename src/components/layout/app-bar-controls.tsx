import styled from 'styled-components'
import { Link } from 'react-router-dom'
import {
  ctaButton,
  ctaButtonLit,
  edgeTransition,
} from 'components/ui/kit-styles'

/*
 * App bar controls (round 2, DESIGN.md "Surfaces and controls"). The chain
 * chip and the theme menu are SelectMenus; these are the rest.
 */

/** 38px round ghost button for the app bar (help, menu). */
export const BarIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition:
    background var(--motion),
    color var(--motion),
    border-color var(--motion);

  &:hover {
    color: var(--color-text);
    background: var(--color-raised);
  }

  &[aria-expanded='true'] {
    color: var(--color-text);
    background: var(--color-raised);
    border-color: var(--color-border);
  }
`

/*
 * Connect, while no wallet is connected: the bar's one call to action, so
 * it wears the primary look at rest (the glass pill with the lit edge and
 * its pooled glow), which sets it apart from the hairline chain chip
 * beside it. On top of that a brighter light travels the edge, slowly; on
 * hover and focus the edge sweeps round and the glow blooms, like every
 * primary button. Reduced motion parks the travelling light. Icon only on
 * phones, a 38px circle.
 */
export const BarConnectButton = styled.button`
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px 0 13px;
  border-radius: var(--radius-pill);
  ${ctaButton}
  font-family: var(--font-sans);
  font-size: var(--fs-small);
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    box-shadow 260ms var(--ease-out),
    ${edgeTransition};

  &::after {
    content: '';
    position: absolute;
    inset: calc(-1 * var(--edge-width, 1px));
    padding: var(--edge-width, 1px);
    border-radius: inherit;
    background: conic-gradient(
      from var(--cv-sweep),
      transparent 0deg 300deg,
      color-mix(in srgb, var(--sweep-head) 45%, transparent) 335deg,
      var(--sweep-head) 352deg,
      transparent 360deg
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: cv-sweep 5.5s linear infinite;
    pointer-events: none;
  }

  svg {
    flex: 0 0 auto;
  }

  &:hover,
  &:focus-visible {
    ${ctaButtonLit}
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none !important;
      --cv-sweep: 140deg;
    }
  }

  @media (max-width: 600px) {
    width: 38px;
    padding: 0;
  }
`

/*
 * Connected: one glass pill holding the account avatar (it opens the
 * account menu: balance, notifications, disconnect) and the short address
 * (it opens the profile). Phones keep the avatar only.
 */
export const BarAccountPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 38px;
  padding: 0 4px 0 2px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition: border-color var(--motion);

  &:hover {
    border-color: var(--color-border-strong);
  }

  @media (max-width: 600px) {
    padding: 0 2px;
  }
`

export const BarAccountAddress = styled(Link)`
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 10px 0 8px;
  border-radius: var(--radius-pill);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-decoration: none;
  transition:
    background var(--motion),
    color var(--motion);

  &:hover {
    color: var(--color-text);
    background: var(--color-raised);
  }

  @media (max-width: 600px) {
    display: none;
  }
`
