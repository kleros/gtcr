import React from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import { CurateIcon } from 'components/curate/icons'
import { reveal } from 'components/curate/motion/reveal'

/*
 * Layout for the Stake list factory, composed with the shared wizard
 * (v2-factory-shell, which holds the stepper and the step panel): the page
 * head, the transaction stepper of the deploy step and the rows of lists
 * deployed from this browser. Colors, type and radii come only from the
 * tokens; every entrance respects reduced motion.
 */

/* ---------- Page head ---------- */

export const StakeHead = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px 32px;

  > * {
    ${reveal}
  }
`

export const StakeHeadCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
`

export const StakeLede = styled.p`
  margin: 0;
  max-width: 58ch;
  color: var(--color-muted);
  font-size: 16px;
  line-height: 24px;
`

export const StakeLift = styled.div`
  ${reveal}
`

/* ---------- Transaction stepper ---------- */

export type TxStatus = 'upcoming' | 'active' | 'done' | 'failed'

const spin = keyframes`
  to { transform: rotate(360deg); }
`

export const TxList = styled.ol`
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`

const TxItem = styled.li<{ $status: TxStatus; $last?: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 14px;
  padding-bottom: ${({ $last }) => ($last ? 0 : '22px')};
  ${reveal}

  /* The connector to the next step fills once this one is done. */
  &::before,
  &::after {
    content: ${({ $last }) => ($last ? 'none' : "''")};
    position: absolute;
    top: 36px;
    bottom: 4px;
    left: 15px;
    width: 2px;
    border-radius: var(--radius-pill);
  }

  &::before {
    background: var(--glass-border);
  }

  &::after {
    background: linear-gradient(var(--color-primary), var(--aurora-b));
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--color-primary) 60%, transparent);
    transform-origin: top;
    transform: scaleY(${({ $status }) => ($status === 'done' ? 1 : 0)});
    transition: transform 700ms var(--ease-out);
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      transition: none;
    }
  }
`

const txMarker = {
  upcoming: css`
    border-color: var(--glass-border);
    background: var(--color-surface);
    color: var(--color-faint);
  `,
  active: css`
    border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
    background: var(--color-primary-soft);
    color: var(--color-primary);
    box-shadow: 0 0 0 5px
      color-mix(in srgb, var(--color-primary) 10%, transparent);
  `,
  done: css`
    border-color: color-mix(in srgb, var(--color-primary) 60%, transparent);
    background: var(--color-primary-fill);
    color: var(--color-on-primary);
    box-shadow: 0 6px 18px -8px var(--color-primary);
  `,
  failed: css`
    border-color: color-mix(in srgb, var(--color-danger) 60%, transparent);
    background: var(--color-danger-soft);
    color: var(--color-danger);
  `,
}

const TxMarker = styled.span<{ $status: TxStatus }>`
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition:
    background 320ms var(--ease-out),
    border-color 320ms var(--ease-out),
    box-shadow 320ms var(--ease-out),
    color 320ms var(--ease-out);
  ${({ $status }) => txMarker[$status]}
`

const Spinner = styled.i`
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-pill);
  animation: ${spin} 800ms linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2400ms;
  }
`

const TxBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-top: 5px;
`

const TxTitle = styled.span<{ $status: TxStatus }>`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  color: ${({ $status }) =>
    $status === 'upcoming' ? 'var(--color-muted)' : 'var(--color-text)'};
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);
  font-weight: 500;
`

const TxTag = styled.span`
  color: var(--color-faint);
  font-size: var(--fs-small);
  font-weight: 400;
`

const TxNote = styled.span`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/** Chips under a transaction step: hashes, paths, addresses. */
export const TxData = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 6px;
`

const pill = css`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  span {
    color: var(--color-muted);
    font-family: var(--font-sans);
  }
`

export const TxLink = styled.a`
  ${pill}
  color: var(--color-primary);
  text-decoration: none;
  transition:
    border-color var(--motion),
    background var(--motion);

  &:hover {
    border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
    background: var(--color-primary-soft);
  }
`

export const TxPill = styled.span`
  ${pill}
  color: var(--color-text);
`

/**
 * One step of a transaction: a numbered marker (a spinner while it runs, a
 * check once done, a cross if it failed), the title with a quiet tag, the
 * note while it runs or after it failed, and its evidence as chips.
 */
export const TxStep = ({
  number,
  status,
  title,
  tag,
  note,
  last,
  index,
  children,
}: {
  number: number
  status: TxStatus
  title: React.ReactNode
  tag?: React.ReactNode
  note?: React.ReactNode
  last?: boolean
  index: number
  children?: React.ReactNode
}) => (
  <TxItem
    $status={status}
    $last={last}
    style={{ ['--i' as string]: index }}
    aria-current={status === 'active' ? 'step' : undefined}
  >
    <TxMarker $status={status} aria-hidden>
      {status === 'done' ? (
        <CurateIcon name="check" size={15} />
      ) : status === 'active' ? (
        <Spinner />
      ) : status === 'failed' ? (
        <CurateIcon name="close" size={14} />
      ) : (
        number
      )}
    </TxMarker>
    <TxBody>
      <TxTitle $status={status}>
        {title}
        {tag && <TxTag>{tag}</TxTag>}
      </TxTitle>
      {note && (status === 'active' || status === 'failed') && (
        <TxNote>{note}</TxNote>
      )}
      {children}
    </TxBody>
  </TxItem>
)

/* ---------- Deployed lists ---------- */

export const StakeSectionHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 72px 0 18px;

  h2 {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 30px;
    line-height: 34px;
    font-weight: 500;
    letter-spacing: -0.03em;
  }

  @media (max-width: 720px) {
    margin-top: 48px;

    h2 {
      font-size: 24px;
      line-height: 28px;
    }
  }
`

export const StakeDeploymentRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const StakeDeploymentLink = styled(Link)`
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  padding: 12px 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  text-decoration: none;
  transition:
    border-color var(--motion),
    translate var(--motion),
    box-shadow var(--motion);
  ${reveal}

  /* translate, not transform: the entrance animation owns transform. */
  &:hover {
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-card-hover);
    translate: 0 -1px;
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover {
      translate: none;
    }
  }

  &:hover strong {
    color: var(--color-primary);
  }

  strong {
    display: block;
    overflow: hidden;
    color: var(--color-text);
    font-size: var(--fs-body-lg);
    line-height: var(--lh-body-lg);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color var(--motion);
  }
`

export const StakeDeploymentLogo = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--color-raised);
  color: var(--color-faint);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`

export const StakeOpenHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  font-weight: 500;
`
