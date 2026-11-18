import React, { useId, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
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
import {
  Empty,
  More,
  OpenRow,
  coinParts,
  formatInt,
  repeatedIds,
  type HappeningFigures,
  type OpenListChip,
} from './board-rows'
import { chainInfo, type DashboardCard } from './view'
import { Avatar as ListLogo } from 'pages/browse/avatar'

/*
 * Open for verification (round 2, item 11): the live money on the page, so
 * it leads a band of its own rather than sharing the board below. These are
 * unresolved requests nobody has challenged whose challenge window is still
 * open; each is collateralised, and whoever shows one breaks its list's
 * rules takes that collateral. The count and the collateral lead, one
 * figure per chain coin (never added across coins, DESIGN.md Data rules),
 * then the rows themselves, closing soonest first. When the challenge
 * periods could not be read, no window is claimed: the band counts the
 * unchallenged requests instead and says so.
 *
 * Why it matters to the reader lives in the tooltips, not in the band: the
 * panel itself is figures, labels and rows.
 *
 * The band owns its own loading state: the heading, the status dot and the
 * figures' labels are there from the first paint, with the figures and rows
 * as skeletons inside it, so the page's headline moment never pops in.
 */

/** Rows the band shows before "+n more": four of each of its two columns. */
const OPEN_LIMIT = 8

const breathe = keyframes`
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
`

/*
 * The band owns its air: the quiet Kleros Verified strip follows at its own
 * 16px, and without this it would read as part of this section rather than
 * as the band it is.
 */
const Section = styled.section`
  margin-bottom: 48px;
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
  display: flex;
  flex-direction: column;
  gap: 14px;
  ${reveal}
`

/* The figures first: how many, how much collateral, how long is left. */
const Lead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 24px 56px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--glass-border);

  @media (max-width: 720px) {
    gap: 20px 32px;
  }
`

const Figure = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

const Count = styled.span`
  display: inline-flex;
  align-items: baseline;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(40px, 2.2vw + 24px, 56px);
  line-height: 0.95;
  font-weight: 500;
  letter-spacing: -0.04em;
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
  gap: 14px 28px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Coin = styled.li`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  b {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: clamp(26px, 1.1vw + 18px, 34px);
    line-height: 1;
    font-weight: 500;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  b small {
    color: var(--color-muted);
    font-size: 14px;
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

/*
 * Two columns, so the band shows twice what the old side panel did without
 * running down the page; under 900px a row needs its full width for the
 * identifier, the bounty and the window rail, so they stack. One row alone
 * takes one column rather than leaving a hole beside itself.
 */
const Rows = styled.ul<{ $columns: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }

  > li {
    display: flex;
    min-width: 0;
    ${reveal}
  }

  > li > a {
    flex: 1;
    min-width: 0;
  }
`

/* Lists holding the open requests: each leads to that list's open ones. */
const Lists = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--glass-border);

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
`

const ListLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  height: 32px;
  padding: 0 12px 0 4px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-decoration: none;
  transition:
    background var(--motion),
    border-color var(--motion);

  > span:nth-child(2) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  b {
    color: var(--color-muted);
    font-family: var(--font-figure);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  &:hover {
    border-color: var(--color-border-strong);
    background: var(--color-raised);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 16px;
  margin-top: auto;
  padding-top: 4px;
`

const StakeLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-decoration: none;

  &:hover {
    color: var(--color-text);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
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
  openLists,
  figures,
  now,
  checking,
  stakeHref,
  unloaded,
}: {
  open: DashboardCard[]
  /** The lists holding the open requests, most first. */
  openLists: OpenListChip[]
  /** Undefined while the load is still running: the band shows skeletons. */
  figures?: HappeningFigures
  now: number
  /** The challenge windows are being read again. */
  checking: boolean
  /** Browse's Stake lists in scope, when there are any. */
  stakeHref?: string
  /**
   * Chains in scope whose indexer did not answer ("Gnosis and Ethereum"): an
   * empty band says their data did not load rather than that nothing is on.
   */
  unloaded?: string
}) => {
  const titleId = useId()
  const [expanded, setExpanded] = useState(false)
  const plus = figures?.unchallengedCapped ? '+' : ''

  const known = !!figures?.windowsKnown
  const total = figures
    ? Math.max(known ? figures.inWindow : figures.unchallenged, open.length)
    : 0
  const shown = expanded ? open : open.slice(0, OPEN_LIMIT)
  const hidden = total - shown.length
  const canExpand = !expanded && open.length > OPEN_LIMIT
  const repeated = repeatedIds(shown)
  const coins = Object.entries(figures?.inWindowDeposits ?? {})
    .filter(([, wei]) => wei > 0n)
    .map(([chainId, wei]) => ({
      chainId: Number(chainId),
      ...coinParts(wei, Number(chainId)),
    }))
  // The soonest window to close, from the rows themselves (closing order).
  const nextClose = known
    ? shown.find((card) => card.windowEnd !== undefined)?.windowEnd
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
          {checking && (
            <Checking role="status">Checking challenge periods…</Checking>
          )}
        </HeadNote>
      </SectionHead>

      <Band $padding="standard" style={{ ['--i' as string]: 0 }}>
        {!figures ? (
          <>
            <Lead>
              <Figure>
                <Label $tone="faint">Open now</Label>
                <SkeletonBlock $height="54px" $width="140px" />
              </Figure>
              <Figure>
                <Label $tone="faint">Bounties</Label>
                <SkeletonBlock $height="34px" $width="200px" />
              </Figure>
            </Lead>
            <Rows $columns={2} aria-hidden>
              {Array.from({ length: OPEN_LIMIT }, (_, index) => (
                <li key={index} style={{ ['--i' as string]: index }}>
                  <SkeletonBlock $height="88px" />
                </li>
              ))}
            </Rows>
          </>
        ) : (
          <>
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

            {shown.length > 0 && (
              <Label $tone="faint">
                {known ? 'Closing soonest first' : 'Newest first'}
              </Label>
            )}
            {shown.length === 0 ? (
              <Empty>
                {unloaded
                  ? `${unloaded} requests did not load`
                  : known
                    ? 'No request in its challenge period'
                    : 'No request waiting for a challenge'}
              </Empty>
            ) : (
              <Rows
                $columns={Math.min(shown.length, 2)}
                aria-label={
                  known
                    ? 'Requests in their challenge window, closing soonest first'
                    : 'Unresolved requests nobody has challenged, newest first'
                }
              >
                {shown.map((card, index) => (
                  <li key={card.id} style={{ ['--i' as string]: index }}>
                    <OpenRow
                      card={card}
                      now={now}
                      withSecond={repeated.has(card.id)}
                    />
                  </li>
                ))}
              </Rows>
            )}
            {canExpand && (
              <More type="button" onClick={() => setExpanded(true)}>
                +{formatInt(hidden)}
                {plus} more
              </More>
            )}
            {!canExpand && hidden > 0 && openLists.length > 0 && (
              <Lists>
                <Label $tone="faint">
                  All {formatInt(total)}
                  {plus} by list
                </Label>
                <ul>
                  {openLists.map((list) => (
                    <li
                      key={list.key}
                      style={{ minWidth: 0, maxWidth: '100%' }}
                    >
                      <ListLink to={list.href} title={list.title}>
                        <ListLogo
                          uri={list.logo}
                          seed={list.key}
                          size={24}
                          radius={12}
                        />
                        <span>{list.title}</span>
                        <b>{formatInt(list.count)}</b>
                      </ListLink>
                    </li>
                  ))}
                </ul>
              </Lists>
            )}
            {expanded && (
              <More type="button" onClick={() => setExpanded(false)}>
                Show fewer
              </More>
            )}
            {((known && figures.pastWindow > 0) || stakeHref) && (
              <Footer>
                {known && figures.pastWindow > 0 && (
                  <Small $faint>
                    {formatInt(figures.pastWindow)}
                    {plus} past their window · waiting to be executed
                  </Small>
                )}
                {stakeHref && (
                  <StakeLink to={stakeHref}>
                    Stake lists stay open to challenge at any time
                    <CurateIcon name="submit" size={12} />
                  </StakeLink>
                )}
              </Footer>
            )}
          </>
        )}
      </Band>
    </Section>
  )
}
