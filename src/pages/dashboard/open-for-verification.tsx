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
import { formatAbsolute, formatTimeLeft } from 'utils/time'
import { SectionHead, SectionTitle } from './section'
import { coinParts, formatInt, type HappeningFigures } from './board-rows'
import { chainInfo, type DashboardCard } from './view'

/*
 * Open for verification (round 3): three figures and nothing else. How many
 * requests nobody has challenged are inside their challenge window, how much
 * collateral stands behind them (one figure per chain coin, never added
 * across coins, DESIGN.md Data rules), and how long the soonest window has
 * left. Each of those requests is collateralised, and whoever shows one
 * breaks its list's rules takes that collateral.
 *
 * Round 2 made this a hero band with the requests themselves listed under
 * the figures; that is what round 3 undoes. The rows now lead the
 * submissions column of the board below (happening-now.tsx), where they sit
 * beside the disputes, so this is a strip the reader passes through rather
 * than the page's centre of gravity: compact padding, panel-head figure
 * sizes, and 16px of air before the board it introduces.
 *
 * Why it matters to the reader lives in the tooltips, not in the strip.
 *
 * The strip owns its own loading state: the heading, the status dot and the
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
 * The strip leads straight into the board it introduces, so it keeps only
 * enough air to read as its own box. The 48px that used to separate this
 * section from what follows now sits under the board (happening-now.tsx).
 */
const Section = styled.section`
  margin-bottom: 16px;
`

const HeadNote = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding-bottom: 4px;

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

const Band = styled(Surface)`
  ${reveal}
`

/* One tight band: how many, how much collateral, how long is left. */
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

/* The soonest deadline: relative, absolute UTC on hover. */
const Soon = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 20px;
  line-height: 24px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
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

const chainName = (chainId: number) =>
  chainInfo(chainId)?.name ?? `Chain ${chainId}`

export const OpenForVerification = ({
  open,
  figures,
  now,
  checking,
  unloaded,
}: {
  /**
   * The requests the strip counts, closing soonest first when the windows
   * are known: the strip reads the soonest deadline off them. The rows
   * themselves are the submissions column of the board below.
   */
  open: DashboardCard[]
  /** Undefined while the load is still running: the strip shows skeletons. */
  figures?: HappeningFigures
  now: number
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
    .map(([chainId, wei]) => ({
      chainId: Number(chainId),
      ...coinParts(wei, Number(chainId)),
    }))
  // The soonest window to close, from the requests themselves: buildBoard
  // hands them over in closing order whenever the windows are known.
  const nextClose = known
    ? open.find((card) => card.windowEnd !== undefined)?.windowEnd
    : undefined

  return (
    <Section aria-labelledby={titleId}>
      <SectionHead>
        <SectionTitle id={titleId}>
          <StatusDot $tone="window" aria-hidden />
          Open for verification
        </SectionTitle>
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
      </SectionHead>

      <Band $padding="compact" style={{ ['--i' as string]: 6 }}>
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
            <Figure>
              <Label $tone="faint">Next window closes</Label>
              <SkeletonBlock $height="28px" $width="110px" />
            </Figure>
          </Lead>
        ) : (
          <Lead>
            <Figure>
              <Label $tone="faint">
                {known ? 'Open now' : 'Not challenged'}
              </Label>
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
                <Tooltip title={<TipText>{COLLATERAL_TIP}</TipText>}>
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
            {nextClose !== undefined && (
              <Figure>
                <Label $tone="faint">Next window closes</Label>
                <Soon>
                  <time
                    dateTime={new Date(nextClose * 1000).toISOString()}
                    title={formatAbsolute(nextClose)}
                  >
                    {formatTimeLeft(nextClose, now)}
                  </time>
                </Soon>
              </Figure>
            )}
          </Lead>
        )}
      </Band>
    </Section>
  )
}
