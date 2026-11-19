import React from 'react'
import styled from 'styled-components'
import { CountUpText } from './registry-shared-count'

/*
 * The action card's lead while an entry can be challenged: "Earn 30 xDAI",
 * one line, the verb as big as the amount and to its left (round 5 of the
 * design review: an 11px "EARN" label above the figure read as a caption,
 * not as the offer). One component for the Standard and the Stake card, so
 * the two leads cannot drift apart again (round 4 rebuilt the Standard
 * lead and never reached the Stake one).
 *
 * The verb is a word, so it is Urbanist; the amount is a figure that can
 * animate, so it is Geist with tabular figures (DESIGN.md). The coin stays
 * small and muted after it, as on every other amount on the card.
 *
 * The card is 312px wide beside the clock. "Earn", the coin and five
 * characters of amount ("1,280") fill it at 56px; a longer amount steps the
 * whole line down, verb included, so it never overflows and the verb stays
 * the size of the figure. Should a long coin symbol still not fit, the coin
 * wraps under the line rather than out of the card.
 */

const sizeFor = (amount: string) =>
  amount.length <= 5
    ? 56
    : amount.length <= 7
      ? 44
      : amount.length <= 9
        ? 36
        : 30

const Line = styled.p<{ $size: number }>`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 0.2em;
  min-width: 0;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: ${({ $size }) => $size}px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;

  small {
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0;
  }
`

const Verb = styled.span`
  font-family: var(--font-display);
  letter-spacing: -0.03em;
`

export const BountyFigure = ({
  amount,
  symbol,
  title,
  countUp = false,
}: {
  /** The amount in display units, as it is printed ("30", "1,280.5"). */
  amount: string
  symbol: string
  /** The full amount with its coin, for the tooltip. */
  title?: string
  /** Count the amount up from zero on first paint (the Stake card does). */
  countUp?: boolean
}) => (
  <Line $size={sizeFor(amount)} title={title}>
    <Verb>Earn</Verb>
    <span>{countUp ? <CountUpText value={amount} /> : amount}</span>
    <small>{symbol}</small>
  </Line>
)

export default BountyFigure
