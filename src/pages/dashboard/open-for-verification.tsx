import React from 'react'
import styled, { keyframes } from 'styled-components'
import {
  Label,
  SkeletonBlock,
  Small,
  StatusDot,
} from 'components/curate/primitives'
import Tooltip from 'components/ui/Tooltip'
import { getNativeCurrency } from 'config/chains'
import { Avatar as ListLogo } from 'pages/browse/avatar'
import {
  Count,
  Tally,
  UsdLead,
  coinParts,
  formatInt,
  formatUsd,
  usdOf,
  type HappeningFigures,
  type OpenListChip,
} from './board-rows'
import { coinKey, priceSource, type UsdPrice } from './prices'
import { SectionHead, SectionTitle } from './section'
import { chainInfo, type DashboardCard } from './view'

/*
 * Open for verification: the board's section, its heading and the figures
 * of what can be challenged right now (happening-now.tsx draws the rows).
 *
 * From round 4 to 25 Nov 2026 this was a strip of its own between the
 * Self-sustaining mechanism and the board: a centred title, the count and
 * the collateral as two large unboxed figures, and the lists holding them as
 * a centred row of tiles. It was the one part of the page that broke the
 * page's grammar: the tiles stopped 140px short of the column the panels
 * share, its figures were captioned under rather than labelled over, and it
 * stood centred over both columns while counting only the left one. On 26 Nov
 * 2026 (option E of the harmony review) it folded into the board, as the
 * Disputes panel already was:
 *
 *  - The section's heading is the page's own (section.ts): "Open for
 *    verification", left-aligned like "Most active", with the blue window
 *    LED, and on its right the state lines the strip used to carry (a chain
 *    whose requests did not load, challenge periods being read again). Its
 *    anchor is what the hero's "Up for grabs now" figure links to.
 *  - The figures sit in the Submissions panel's head, opposite the Disputes
 *    panel's "In court" and "Rulings": "Open now", and "Up for grabs", the
 *    collateral behind them, dollars first per coin (DESIGN.md, Data rules).
 *    The exact coin amounts, their chains and the price feeds are in the
 *    figure's tooltip, where the strip had them under the dollars.
 *  - The lists holding those requests became chips under the panel's head
 *    that filter its rows, most open first, the rest past four as one chip.
 *    The rows are the requests closing soonest (data.ts loads a page of them
 *    per chain), so a list's chip shows its rows among those and links on to
 *    the list's own page for the others.
 *
 * With nothing open (round 10: "when bounties up for grab are 0, just hide
 * everything") there is no heading and no Submissions column: the Disputes
 * panel takes the board's width under the section's 80px opening.
 */

/** The section's anchor: the hero's "Up for grabs now" figure links to it. */
export const OPEN_SECTION_ID = 'open-for-verification'

const breathe = keyframes`
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
`

/* The live LED beside the section's title, sized to it. */
const LiveDot = styled(StatusDot)`
  width: 10px;
  height: 10px;
`

/* The state lines on the heading's right, on the title's baseline. */
const State = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px 16px;
  min-width: 0;
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

/** The section's heading, with its state lines on the right. */
export const OpenHead = ({
  titleId,
  checking,
  unloaded,
}: {
  titleId: string
  /** The challenge windows are being read again. */
  checking: boolean
  /** Chains in scope whose requests did not load ("Gnosis and Ethereum"). */
  unloaded?: string
}) => (
  <SectionHead id={OPEN_SECTION_ID}>
    <SectionTitle id={titleId}>
      <LiveDot $tone="window" aria-hidden />
      Open for verification
    </SectionTitle>
    {(unloaded || checking) && (
      <State>
        {unloaded && <Small $muted>{unloaded} requests did not load</Small>}
        {checking && (
          <Checking role="status">Checking challenge periods…</Checking>
        )}
      </State>
    )}
  </SectionHead>
)

/* ---------- The Submissions panel's figures ---------- */

/** A figure that carries a tooltip: focusable, so it reads on tab. */
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

/* The collateral: one lead per coin, a muted dot between two of them. */
const Money = styled(Count)`
  display: inline-flex;
  align-items: baseline;
  gap: 8px;

  small {
    color: var(--color-muted);
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0;
  }

  > [data-sep] {
    color: var(--color-faint);
    font-size: 20px;
  }
`

/** What anyone reading the count can do about it. */
const COUNT_TIP =
  'Anyone can challenge one of these. Show the entry breaks its list’s rules and jurors agree, and you take its collateral on top of your own deposit back.'
/**
 * What the collateral is, and why each coin is its own figure here (DESIGN.md,
 * Data rules: only the hero's totals add across coins).
 */
const COLLATERAL_TIP =
  'Each request’s collateral is the bounty for whoever challenges it and wins. Here each chain’s coin is its own figure.'

const chainName = (chainId: number) =>
  chainInfo(chainId)?.name ?? `Chain ${chainId}`

/** "5,640 xDAI on Gnosis and 0.05 ETH on Ethereum" */
const conjunction = new Intl.ListFormat('en-GB', { type: 'conjunction' })

/** The collateral per chain coin, with its dollars where a price answers. */
const openCoins = (
  deposits: Record<number, bigint>,
  prices?: Record<string, UsdPrice>,
) =>
  Object.entries(deposits)
    .filter(([, wei]) => wei > 0n)
    .map(([chainId, wei]) => {
      const id = Number(chainId)
      // The coin's own key, built by the one rule that keys them (prices.ts):
      // re-keying a coin by hand is how its data comes back empty.
      const price = prices?.[coinKey(id)]
      const dollars = price
        ? usdOf(wei, getNativeCurrency(id).decimals, price.usd)
        : undefined
      return {
        chainId: id,
        ...coinParts(wei, id),
        price,
        // Dollars lead only where they say something: formatUsd drops a
        // value under half a cent, and then the coin leads.
        usd: dollars !== undefined && formatUsd(dollars) ? dollars : undefined,
      }
    })

type OpenCoin = ReturnType<typeof openCoins>[number]

/**
 * The exact amounts and their chains, why they stay apart, and where the
 * dollars came from: which feed answered for each coin and how old its
 * answer is. Provenance lives in the tooltip, so the figure stays a figure.
 */
const moneyTip = (coins: OpenCoin[], plus: string): string => {
  const amounts = conjunction.format(
    coins.map(
      (coin) =>
        `${coin.amount}${plus} ${coin.symbol} on ${chainName(coin.chainId)}`,
    ),
  )
  const sources = coins
    .filter((coin) => coin.usd !== undefined && coin.price)
    .map((coin) => priceSource(coin.price as UsdPrice))
  return `${amounts}. ${COLLATERAL_TIP}${
    sources.length > 0
      ? ` The dollar values are approximate, from ${sources.join('; ')}.`
      : ''
  }`
}

/**
 * The Submissions panel's tally, opposite the Disputes panel's: the requests
 * open now and the collateral behind them. While the load runs, both are
 * skeletons; the collateral waits for the first price read too
 * (use-usd-prices.ts), so it never paints a coin amount and swaps it for
 * dollars under the reader. When the windows could not be read, no window is
 * claimed: the count is of every request nobody has challenged, and there is
 * no collateral figure. A count that only failed requests could explain is
 * "—", never 0.
 */
export const OpenTally = ({
  open,
  figures,
  prices,
  pricesSettled,
  unloaded,
}: {
  /** The rows the column holds: the count is never below them. */
  open: DashboardCard[]
  figures?: HappeningFigures
  /** Dollars per whole coin, keyed by coin (use-usd-prices.ts). */
  prices?: Record<string, UsdPrice>
  /** False while the first price read is held for. */
  pricesSettled: boolean
  /** Chains in scope whose requests did not load. */
  unloaded?: string
}) => {
  const plus = figures?.unchallengedCapped ? '+' : ''
  const known = !!figures?.windowsKnown
  const total = figures
    ? Math.max(known ? figures.inWindow : figures.unchallenged, open.length)
    : 0
  const coins =
    figures && known ? openCoins(figures.inWindowDeposits, prices) : []
  // While the load runs the collateral's place is held too.
  const money = !figures || coins.length > 0

  return (
    <Tally>
      <span>
        {!figures ? (
          <SkeletonBlock $height="28px" $width="48px" />
        ) : unloaded && total === 0 ? (
          <Count>—</Count>
        ) : (
          <Tooltip title={<TipText>{COUNT_TIP}</TipText>}>
            <TipTarget
              tabIndex={0}
              role="img"
              aria-label={`${formatInt(total)}${plus ? ' or more' : ''} ${
                known
                  ? 'requests open now, in their challenge window'
                  : 'unresolved requests nobody has challenged'
              }`}
            >
              <Count>
                {formatInt(total)}
                {plus}
              </Count>
            </TipTarget>
          </Tooltip>
        )}
        <Label $tone="faint">
          {known || !figures ? 'Open now' : 'Unchallenged'}
        </Label>
      </span>
      {money && (
        <span>
          {!figures || !pricesSettled ? (
            <SkeletonBlock $height="28px" $width="96px" />
          ) : (
            <Tooltip title={<TipText>{moneyTip(coins, plus)}</TipText>}>
              <TipTarget tabIndex={0}>
                <Money>
                  {coins.map((coin, index) => (
                    <React.Fragment key={coin.chainId}>
                      {index > 0 && (
                        <span data-sep="" aria-hidden="true">
                          ·
                        </span>
                      )}
                      {coin.usd !== undefined ? (
                        <UsdLead value={formatUsd(coin.usd)} bound={plus} />
                      ) : (
                        <span>
                          {coin.amount}
                          {plus} <small>{coin.symbol}</small>
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </Money>
              </TipTarget>
            </Tooltip>
          )}
          <Label $tone="faint">Up for grabs</Label>
        </span>
      )}
    </Tally>
  )
}

/* ---------- The lists, as the column's filter ---------- */

/** Lists named before the rest become one chip. */
const NAMED = 4

/** A chip: one list, or the rest of them as one. */
export interface ListEntry {
  key: string
  count: number
  /** The list, by its name, logo and open requests' page; absent for the rest. */
  list?: OpenListChip
  /** The lists the rest stands for. */
  rest?: OpenListChip[]
}

/** The key of the chip standing for every list past the named ones. */
const REST_KEY = 'rest'

/**
 * The lists, most first: the top four by name, then the rest as one chip. A
 * single list past the top four is named rather than called "1 other list".
 */
export const listEntries = (lists: OpenListChip[]): ListEntry[] => {
  const named = lists.length <= NAMED + 1 ? lists.length : NAMED
  const entries: ListEntry[] = lists
    .slice(0, named)
    .map((list) => ({ key: list.key, count: list.count, list }))
  const rest = lists.slice(named)
  // Keyed by the lists it stands for, so a choice of "3 other lists" ends
  // when those lists change rather than filtering a different three.
  if (rest.length > 0)
    entries.push({
      key: `${REST_KEY}:${rest.map((list) => list.key).join(',')}`,
      count: rest.reduce((sum, list) => sum + list.count, 0),
      rest,
    })
  return entries.filter((entry) => entry.count > 0)
}

/*
 * The chips, under the panel's head. They wrap beside the Disputes panel; on
 * a phone, where five of them took four lines over the rows, they are one
 * row that swipes sideways, its right end fading out so the next chip shows
 * there is more (the padding lets the last one clear the fade).
 */
const Chips = styled.div`
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 2px 6px;

  @media (max-width: 520px) {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding: 2px 28px 6px 2px;
    scrollbar-width: none;
    mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);

    &::-webkit-scrollbar {
      display: none;
    }

    > button {
      flex: 0 0 auto;
    }
  }
`

/*
 * A chip: the list's logo, its name (cut with an ellipsis past 16em, its
 * full name on hover) and its count. Pressed, it wears the accent's soft
 * fill: the column shows that list's rows.
 */
const Chip = styled.button<{ $bare?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  height: 32px;
  padding: ${({ $bare }) => ($bare ? '0 12px' : '0 12px 0 4px')};
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: none;
  color: var(--color-muted);
  font-family: inherit;
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  cursor: pointer;
  transition:
    background var(--motion),
    border-color var(--motion),
    color var(--motion);

  > span:not([data-logo]) {
    min-width: 0;
    max-width: 16em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  &:hover {
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }

  &[aria-pressed='true'] {
    border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
    background: var(--color-primary-soft);
    color: var(--color-text);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

/**
 * The column's filter: every request ("All"), or one list's. Only drawn when
 * two or more lists hold requests, where choosing one says something.
 */
export const ListFilter = ({
  entries,
  total,
  plus,
  chosen,
  onChoose,
}: {
  entries: ListEntry[]
  /** Every request the column counts, for the "All" chip. */
  total: number
  plus: string
  /** The chip pressed, or undefined for "All". */
  chosen?: string
  onChoose: (key: string | undefined) => void
}) => (
  <Chips role="group" aria-label="Show one list's requests">
    <Chip
      type="button"
      $bare
      aria-pressed={chosen === undefined}
      onClick={() => onChoose(undefined)}
    >
      <span>All</span>
      <b>
        {formatInt(total)}
        {plus}
      </b>
    </Chip>
    {entries.map((entry) => (
      <Chip
        key={entry.key}
        type="button"
        $bare={!entry.list}
        aria-pressed={chosen === entry.key}
        onClick={() => onChoose(entry.key)}
        title={entry.list?.title}
      >
        {entry.list && (
          <span data-logo="" style={{ display: 'inline-flex' }}>
            <ListLogo
              uri={entry.list.logo}
              seed={entry.list.key}
              size={24}
              radius={12}
            />
          </span>
        )}
        <span>
          {entry.list
            ? entry.list.title
            : `${formatInt(entry.rest?.length ?? 0)} other lists`}
        </span>
        <b>
          {formatInt(entry.count)}
          {plus}
        </b>
      </Chip>
    ))}
  </Chips>
)
