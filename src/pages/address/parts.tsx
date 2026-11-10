import React from 'react'
import styled, { css } from 'styled-components'
import { Link } from 'react-router-dom'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatAbsolute, formatAgo } from 'utils/time'
import { CurateIcon, type CurateIconName } from 'components/curate/icons'
import { Small } from 'components/curate/primitives'
import { VerifiedBadge } from 'components/curate/verified-badge'

/*
 * Small pieces the curator profile shares between its panels: the registry
 * logo, the relative time with its absolute UTC twin on hover, section
 * headings in display type, and the quiet state for empty panels.
 */

export const mediaUrl = (uri?: string | null): string | null => {
  if (!uri) return null
  if (/^https?:\/\//i.test(uri)) return uri
  return parseIpfs(uri)
}

const LogoBox = styled.span<{ $image?: string | null; $size: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border: 1px solid var(--glass-border);
  border-radius: ${({ $size }) => ($size >= 36 ? 12 : 8)}px;
  background: ${({ $image }) =>
    $image ? `url("${$image}") center / cover` : 'var(--color-surface)'};
  color: var(--color-faint);
`

export const RegistryLogo = ({
  uri,
  size = 40,
  ...rest
}: {
  uri?: string | null
  size?: number
} & React.HTMLAttributes<HTMLSpanElement>) => {
  const image = mediaUrl(uri)
  return (
    <LogoBox {...rest} $image={image} $size={size} aria-hidden>
      {!image && <CurateIcon name="registry" size={Math.round(size * 0.42)} />}
    </LogoBox>
  )
}

/** "3h ago", with the absolute UTC time on hover. */
export const When = ({
  timestamp,
  now,
  className,
}: {
  timestamp: number
  now: number
  className?: string
}) =>
  timestamp > 0 ? (
    <time
      className={className}
      dateTime={new Date(timestamp * 1000).toISOString()}
      title={formatAbsolute(timestamp)}
    >
      {formatAgo(timestamp, now)}
    </time>
  ) : (
    <Small $faint className={className}>
      —
    </Small>
  )

export const SectionHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin: 72px 0 20px;

  @media (max-width: 720px) {
    margin-top: 48px;
  }
`

export const SectionTitle = styled.h2`
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 34px;
  font-weight: 500;
  letter-spacing: -0.03em;

  small {
    color: var(--color-faint);
    font-family: var(--font-figure);
    font-size: 16px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 720px) {
    font-size: 26px;
    line-height: 30px;
  }
`

/** Text link in the muted role that brightens on hover. */
export const quietLink = css`
  color: var(--color-text);
  text-decoration: none;
  transition: color var(--motion);

  &:hover {
    color: var(--color-primary);
  }
`

export const RegistryLink = styled(Link)`
  ${quietLink}
  display: block;
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const TitleLine = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  > a {
    flex: 0 1 auto;
    min-width: 0;
  }
`

/**
 * A list's name as a link, then the Kleros Verified seal when the list
 * carries it: 16px in rows, cards and the table, 14px in small feeds.
 * Community lists carry no mark.
 */
export const ListTitle = ({
  to,
  verified,
  title,
  sealSize = 16,
  children,
}: {
  to: string
  verified?: boolean
  /** The full name on hover, where the name may be cut short. */
  title?: string
  sealSize?: 14 | 16
  children: React.ReactNode
}) => (
  <TitleLine data-title>
    <RegistryLink to={to} title={title}>
      {children}
    </RegistryLink>
    {verified && <VerifiedBadge size={sealSize} />}
  </TitleLine>
)

export const PartyLink = styled(Link)`
  ${quietLink}
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 16px;
`

/* ---------- Quiet state ---------- */

const QuietWrap = styled.div<{ $tight?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: ${({ $tight }) => ($tight ? '12px 24px 40px' : '48px 24px')};
  text-align: center;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--color-primary) 14%, transparent),
      transparent
    );
    pointer-events: none;
  }

  h3 {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 22px;
    line-height: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    max-width: 52ch;
    color: var(--color-muted);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }
`

const QuietGlyph = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-bottom: 4px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: var(--color-muted);
`

export const QuietState = ({
  icon = 'activity',
  title,
  children,
  action,
  role,
  tight = false,
}: {
  icon?: CurateIconName
  title: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  role?: string
  /** Less room above: the state leads its panel right under a header. */
  tight?: boolean
}) => (
  <QuietWrap role={role} $tight={tight}>
    <QuietGlyph aria-hidden>
      <CurateIcon name={icon} size={18} />
    </QuietGlyph>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action && <div style={{ marginTop: 8 }}>{action}</div>}
  </QuietWrap>
)
