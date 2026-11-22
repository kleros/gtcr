import React from 'react'
import styled from 'styled-components'
import { CurateIcon, type CurateIconName } from 'components/curate/icons'
import { Label, truncateMiddle } from 'components/curate/primitives'
import { SafeImage } from 'components/curate/factory-shared-fields'
import { useCourtSummary } from 'components/curate/factory-shared-kleros'

/*
 * The parts both factory previews (classic and Stake) show the same way:
 * the draft list's card at the top, the outcomes list under what each side
 * pays, and the court at the foot. What each side pays, and over which
 * periods, is each preview's own.
 */

const Identity = styled.div`
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding-bottom: 18px;
`

const Logo = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  color: var(--color-faint);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`

const Name = styled.span<{ $empty?: boolean }>`
  display: block;
  overflow: hidden;
  color: ${({ $empty }) =>
    $empty ? 'var(--color-faint)' : 'var(--color-text)'};
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 26px;
  font-weight: 500;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Description = styled.span<{ $empty?: boolean }>`
  display: -webkit-box;
  margin-top: 2px;
  overflow: hidden;
  color: ${({ $empty }) =>
    $empty ? 'var(--color-faint)' : 'var(--color-muted)'};
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
`

const Meta = styled.span`
  display: block;
  margin-top: 8px;
  overflow: hidden;
  color: var(--color-faint);
  font-size: 13px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
`

/** The draft list's card: its logo, name, description and one meta line. */
export const PreviewIdentity = ({
  logo,
  title,
  description,
  meta,
  icon = 'registry',
}: {
  logo?: string
  title?: string
  description?: string
  /** The meta line's parts ("1 field", "Submit an item"); empty ones are left out. */
  meta: string[]
  /** Shown while there is no logo. */
  icon?: CurateIconName
}) => (
  <Identity>
    <Logo aria-hidden>
      <SafeImage
        src={logo || undefined}
        alt=""
        fallback={<CurateIcon name={icon} size={20} />}
      />
    </Logo>
    <div style={{ minWidth: 0 }}>
      <Name $empty={!title}>{title || 'Untitled list'}</Name>
      <Description $empty={!description}>
        {description || 'No description yet'}
      </Description>
      <Meta>{meta.filter(Boolean).join(' · ')}</Meta>
    </div>
  </Identity>
)

/**
 * What becomes of the money, one line per outcome, on the launch page's
 * bullet: every list in a box takes the same check, in an 18px column 10px
 * from its line, whatever the outcome; the bold lead words name it. The line
 * is as tall as the glyph, so the check sits on the first line's middle.
 */
export const Outcomes = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 10px;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 18px;
    text-wrap: pretty;
  }

  svg {
    color: var(--color-primary);
  }

  li[data-con] svg {
    color: var(--color-faint);
  }

  b {
    color: var(--color-text);
    font-weight: 500;
  }
`

/** The dash of an outcome that costs a side (an `Outcomes` item with `data-con`). */
export const MinusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M7 12h10"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
  </svg>
)

const CourtRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  strong {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

/**
 * Who rules on disputes: the Kleros court by name and jurors when the
 * arbitrator is the chain's Kleros arbitrator, the arbitrator's address
 * otherwise.
 */
export const PreviewCourtRow = ({
  chainId,
  arbitratorAddress,
  extraData,
}: {
  chainId: number | undefined
  arbitratorAddress?: string
  extraData?: string
}) => {
  const court = useCourtSummary(chainId, arbitratorAddress, extraData)
  return (
    <CourtRow>
      <Label $tone="muted">
        {court.isKleros ? 'Kleros court' : 'Arbitrator'}
      </Label>
      <strong
        title={
          court.isKleros ? undefined : arbitratorAddress || 'No arbitrator set'
        }
      >
        {court.isKleros
          ? (court.text ?? '—')
          : arbitratorAddress
            ? truncateMiddle(arbitratorAddress, 8, 6)
            : '—'}
      </strong>
    </CourtRow>
  )
}
