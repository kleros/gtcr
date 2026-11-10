import React from 'react'
import styled, { css, keyframes } from 'styled-components'
import { type StatusTone } from './primitives'
import { reveal } from './motion/reveal'
import { formatAbsolute } from 'utils/time'

/*
 * Vertical timeline for an entry's history. A glowing line joins the
 * events; each marker carries its status color with a halo, and the latest
 * event of an open request pulses. Every event shows its absolute UTC time,
 * linked to its transaction.
 */

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cv-tone) 55%, transparent); }
  70% { box-shadow: 0 0 0 9px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

export const Timeline = styled.ol`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Event = styled.li<{ $tone: StatusTone }>`
  --cv-tone: var(--status-${({ $tone }) => $tone});
  position: relative;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 16px;
  padding-bottom: 22px;
  ${reveal}

  &:last-child {
    padding-bottom: 0;
  }

  /* The line to the next event: lit at this event, fading toward the next. */
  &:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 20px;
    bottom: -2px;
    left: 9px;
    width: 2px;
    border-radius: var(--radius-pill);
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--cv-tone) 70%, transparent),
      var(--glass-border)
    );
    box-shadow: 0 0 10px color-mix(in srgb, var(--cv-tone) 35%, transparent);
  }
`

const Marker = styled.span<{ $current?: boolean }>`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;

  i {
    width: 10px;
    height: 10px;
    border: 2px solid var(--cv-tone);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--cv-tone) 16%, transparent),
      0 0 14px color-mix(in srgb, var(--cv-tone) 50%, transparent);
  }

  ${({ $current }) =>
    $current &&
    css`
      i {
        background: var(--cv-tone);
        animation: ${pulse} 2.4s ease-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        i {
          animation: none;
        }
      }
    `}
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-top: 1px;
`

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 16px;
  min-width: 0;
`

const Title = styled.span`
  color: var(--color-text);
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);
  font-weight: 500;
`

const whenStyles = css`
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const When = styled.a`
  ${whenStyles}
  text-decoration: none;
  transition: color var(--motion);

  &:hover {
    color: var(--color-primary);
    text-decoration: underline;
  }
`

const WhenText = styled.span`
  ${whenStyles}
`

const Detail = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-primary);
    font-weight: 500;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`

/** Evidence text under an event: a quiet quote, not another box. */
export const TimelineQuote = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-top: 6px;
  padding: 2px 0 2px 14px;
  border-left: 2px solid var(--glass-border);

  p {
    margin: 0;
    max-width: 68ch;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: 22px;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
`

export const TimelineEvent = ({
  tone,
  title,
  /** Unix seconds. */
  timestamp,
  /** Explorer page of the transaction; the date links to it. */
  href,
  detail,
  /** The latest event of an open request: its marker pulses. */
  current,
  /** Stagger index for the entrance. */
  index = 0,
  children,
}: {
  tone: StatusTone
  title: React.ReactNode
  timestamp?: number | null
  href?: string
  detail?: React.ReactNode
  current?: boolean
  index?: number
  children?: React.ReactNode
}) => (
  <Event $tone={tone} style={{ ['--i' as string]: Math.min(index, 12) }}>
    <Marker $current={current} aria-hidden>
      <i />
    </Marker>
    <Content>
      <Head>
        <Title>{title}</Title>
        {timestamp ? (
          href ? (
            <When
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title="Open the transaction"
            >
              {formatAbsolute(timestamp)}
            </When>
          ) : (
            <WhenText>{formatAbsolute(timestamp)}</WhenText>
          )
        ) : null}
      </Head>
      {detail && <Detail>{detail}</Detail>}
      {children}
    </Content>
  </Event>
)

export default Timeline
