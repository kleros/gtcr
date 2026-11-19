import React, { useId } from 'react'
import styled, { keyframes } from 'styled-components'
import ChainLogo from 'components/chain-logo'
import {
  Label,
  SkeletonBlock,
  Small,
  StatusDot,
  Surface,
} from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import Tooltip from 'components/ui/Tooltip'
import { Odometer } from 'components/curate/motion/odometer'
import { reveal } from 'components/curate/motion/reveal'
import { getNativeCurrency } from 'config/chains'
import {
  coinParts,
  formatInt,
  formatUsd,
  usdOf,
  UsdValue,
  type HappeningFigures,
} from './board-rows'
import { coinKey, priceSource, type UsdPrice } from './prices'
import { chainInfo, type DashboardCard } from './view'

/*
 * Open for verification: two figures, inside "Happening now" (round 4). How
 * many requests nobody has challenged are inside their challenge window,
 * and how much collateral stands behind them (one figure per chain coin,
 * never added across coins, DESIGN.md Data rules). Each of those requests
 * is collateralised, and whoever shows one breaks its list's rules takes
 * that collateral.
 *
 * Round 3 gave this a section of its own — a 30px heading over three
 * figures, between the self-sustaining panel and the board — and it read as
 * dropped into the page, because the figures belong to neither of them.
 * Round 4 folds it into the board's own section: it is now the figure row
 * directly under "Happening now" and directly over the two columns, which
 * is where the submissions column it counts begins. So the strip heads
 * itself the way the two panels below it do (a label-sized title and its
 * status dot), not with a section title of its own.
 *
 * Round 4 also drops the "Next window closes" figure. A countdown to one
 * anonymous request was the one figure here nobody could act on: the rows
 * below carry their own deadlines, each next to the request it belongs to.
 *
 * Each coin amount carries what it is worth in dollars, when that can be read
 * from a Chainlink feed on the coin's own chain (prices.ts): this figure and
 * the bounties won are the only two on the site that do. The dollars are an
 * aside on the amount, never the amount — and when no price can be read, or
 * the feed's answer is past its heartbeat, the line is simply the coin figure,
 * which is what it was before. The tooltip on the label names the feeds and
 * how old their answers are.
 *
 * Why it matters to the reader lives in the tooltips, not in the strip.
 *
 * The strip owns its own loading state: the title, the status dot and the
 * figures' labels are there from the first paint, with the figures as
 * skeletons inside it, so no heading waits on a load. When the challenge
 * periods could not be read, no window is claimed: the strip counts the
 * unchallenged requests instead and says so. When a chain did not answer at
 * all, the head says so, because "Open now 0" would otherwise read as a
 * figure the load never supported.
 */

const breathe = keyframes`
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
`

/*
 * The strip leads straight into the board's two columns, which are its own
 * section's rows: 16px, the gap the board's grid itself uses, so the three
 * boxes read as one band under the heading they share.
 */
const Band = styled(Surface)`
  ${reveal}
  margin-bottom: 16px;
`

/* The strip's own head, on the two panels' pattern (happening-now.tsx). */
const StripHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 0 0 12px;
`

const TitleRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

const StripTitle = styled.h3`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-label);
  font-size: var(--fs-label);
  line-height: var(--lh-label);
  font-weight: 500;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
`

const HeadNote = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;

  @media (max-width: 720px) {
    align-items: flex-start;
  }
`

/* A neutral line while the challenge windows are read again. */
const Checking = styled(Small).attrs({ $muted: true })`
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--status-window);
    animation: ${breathe} 1.4s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation: none;
    }
  }
`

/* One tight band: how many, and how much collateral. */
const Lead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 32px;

  @media (max-width: 720px) {
    gap: 12px 24px;
  }
`

const Figure = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`

const Count = styled.span`
  display: inline-flex;
  align-items: baseline;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 28px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: var(--tracking-display);
  font-variant-numeric: tabular-nums;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
    border-radius: 4px;
  }
`

/* One figure per coin: amounts stay in their chain's own coin. */
const Coins = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Coin = styled.li`
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;

  b {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 20px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: var(--tracking-display);
    font-variant-numeric: tabular-nums;
  }

  b small {
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
  }

  b svg {
    align-self: center;
    color: var(--status-window);
  }
`

const CoinPlace = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  white-space: nowrap;
`

/** A figure or label that carries a tooltip: focusable, so it reads on tab. */
const TipTarget = styled.span`
  display: inline-flex;
  align-items: center;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
    border-radius: 4px;
  }
`

/* Balanced lines: a two-line tip never leaves one word on its own line. */
const TipText = styled.span`
  display: block;
  text-wrap: balance;
`

/** What anyone reading the count can do about it. */
const COUNT_TIP =
  'Anyone can challenge one of these. Show the entry breaks its list’s rules and jurors agree, and you take its collateral on top of your own deposit back.'
/** Why the amounts stay apart (DESIGN.md: never added across coins). */
const COLLATERAL_TIP =
  'Each request’s collateral is the bounty for whoever challenges it and wins. Amounts stay in each chain’s own coin and are never added together.'

/**
 * The same sentence, plus where the dollar asides came from: which feed
 * answered for each coin and how old that answer is. Provenance lives in the
 * tooltip on this page, so the figure line stays a figure line.
 */
const collateralTip = (sources: string[]): string =>
  sources.length === 0
    ? COLLATERAL_TIP
    : `${COLLATERAL_TIP} The dollar values are approximate, from ${sources.join('; ')}.`

const chainName = (chainId: number) =>
  chainInfo(chainId)?.name ?? `Chain ${chainId}`

export const OpenForVerification = ({
  open,
  figures,
  prices,
  checking,
  unloaded,
}: {
  /**
   * The requests the strip counts: the rows themselves are the submissions
   * column of the board below, which carries each one's own deadline.
   */
  open: DashboardCard[]
  /** Undefined while the load is still running: the strip shows skeletons. */
  figures?: HappeningFigures
  /**
   * Dollars per whole coin, keyed by coin (use-usd-prices.ts). A coin missing
   * from it, and every coin while the prices have not arrived or never do,
   * shows its amount alone. A price that has passed its feed's heartbeat
   * leaves that map, so the aside goes rather than ages.
   */
  prices?: Record<string, UsdPrice>
  /** The challenge windows are being read again. */
  checking: boolean
  /**
   * Chains in scope whose indexer did not answer ("Gnosis and Ethereum"):
   * the head says their data did not load rather than that nothing is on.
   */
  unloaded?: string
}) => {
  const titleId = useId()
  const plus = figures?.unchallengedCapped ? '+' : ''

  const known = !!figures?.windowsKnown
  const total = figures
    ? Math.max(known ? figures.inWindow : figures.unchallenged, open.length)
    : 0
  const coins = Object.entries(figures?.inWindowDeposits ?? {})
    .filter(([, wei]) => wei > 0n)
    .map(([chainId, wei]) => {
      const id = Number(chainId)
      // The coin's own key, built by the one rule that keys them (prices.ts):
      // re-keying a coin by hand is how its data comes back empty.
      const price = prices?.[coinKey(id)]
      return {
        chainId: id,
        ...coinParts(wei, id),
        price,
        usd: price
          ? formatUsd(usdOf(wei, getNativeCurrency(id).decimals, price.usd))
          : undefined,
      }
    })
  // Only the coins that actually show a dollar value explain themselves.
  const sources = coins
    .filter((coin) => coin.usd && coin.price)
    .map((coin) => priceSource(coin.price as UsdPrice))

  return (
    <Band
      as="section"
      aria-labelledby={titleId}
      $padding="compact"
      style={{ ['--i' as string]: 6 }}
    >
      <StripHead>
        <TitleRow>
          <StatusDot $tone="window" aria-hidden />
          <StripTitle id={titleId}>Open for verification</StripTitle>
        </TitleRow>
        <HeadNote>
          {figures && (
            <Label $tone="faint">
              {known ? 'In their challenge window' : 'Not challenged yet'}
            </Label>
          )}
          {unloaded && <Small $muted>{unloaded} requests did not load</Small>}
          {checking && (
            <Checking role="status">Checking challenge periods…</Checking>
          )}
        </HeadNote>
      </StripHead>

      {!figures ? (
        <Lead>
          <Figure>
            <Label $tone="faint">Open now</Label>
            <SkeletonBlock $height="28px" $width="96px" />
          </Figure>
          <Figure>
            <Label $tone="faint">Bounties</Label>
            <SkeletonBlock $height="28px" $width="200px" />
          </Figure>
        </Lead>
      ) : (
        <Lead>
          <Figure>
            <Label $tone="faint">{known ? 'Open now' : 'Not challenged'}</Label>
            <Tooltip title={<TipText>{COUNT_TIP}</TipText>}>
              <Count
                tabIndex={0}
                role="img"
                aria-label={`${formatInt(total)}${plus ? ' or more' : ''} ${
                  known
                    ? 'requests in their challenge window now'
                    : 'unresolved requests nobody has challenged'
                }`}
              >
                <Odometer value={total} />
                {plus}
              </Count>
            </Tooltip>
          </Figure>
          {known && coins.length > 0 && (
            <Figure>
              <Tooltip title={<TipText>{collateralTip(sources)}</TipText>}>
                <TipTarget tabIndex={0}>
                  <Label $tone="faint">Bounties</Label>
                </TipTarget>
              </Tooltip>
              <Coins aria-label="Collateral behind the requests open now, one figure per chain coin">
                {coins.map((coin) => (
                  <Coin key={coin.chainId}>
                    <b>
                      <CurateIcon name="bounty" size={16} />
                      {coin.amount}
                      {plus}
                      <small>{coin.symbol}</small>
                      {coin.usd && <UsdValue value={coin.usd} bound={plus} />}
                    </b>
                    <CoinPlace>
                      <ChainLogo chainId={coin.chainId} size={14} />
                      {chainName(coin.chainId)}
                    </CoinPlace>
                  </Coin>
                ))}
              </Coins>
            </Figure>
          )}
        </Lead>
      )}
    </Band>
  )
}
