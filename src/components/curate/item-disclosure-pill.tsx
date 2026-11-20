import React from 'react'
import styled from 'styled-components'
import { CurateIcon, type CurateIconName } from './icons'

/*
 * The quiet way into a detail: a hairline pill that unfolds it, with a
 * chevron that turns while it is open (DESIGN.md: data first, words last —
 * an explainer collapses into a pill, and every control composes the kit's
 * helpers rather than being drawn again).
 *
 * One control, so the jury band and anything that unfolds a detail later
 * read and behave alike (round 3 of the design review took the deposit
 * breakdown off both entry cards; the dialogs that send the transaction
 * carry it instead).
 */

const Pill = styled.button`
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  cursor: pointer;
  transition:
    color var(--motion),
    border-color var(--motion);

  &:hover {
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }

  > svg:last-child {
    transition: transform 360ms var(--ease-spring);
  }

  &[aria-expanded='true'] {
    color: var(--color-text);
  }

  &[aria-expanded='true'] > svg:last-child {
    transform: rotate(180deg);
  }

  @media (prefers-reduced-motion: reduce) {
    > svg:last-child {
      transition: none;
    }
  }
`

export const DisclosurePill = ({
  icon,
  open,
  onToggle,
  controls,
  children,
}: {
  /** The glyph before the label; the chevron is drawn by the pill. */
  icon?: CurateIconName
  open: boolean
  onToggle: () => void
  /** The id of the block it unfolds, when that block has one. */
  controls?: string
  /** The label: it says what unfolds, so the pill needs no other name. */
  children: React.ReactNode
}) => (
  <Pill
    type="button"
    aria-expanded={open}
    aria-controls={controls}
    onClick={onToggle}
  >
    {icon && <CurateIcon name={icon} size={14} />}
    {children}
    <CurateIcon name="chevron-down" size={14} />
  </Pill>
)

export default DisclosurePill
