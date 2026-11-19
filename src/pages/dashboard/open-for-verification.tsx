import React, { useId } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import ChainLogo from 'components/chain-logo'
import { SkeletonBlock, Small, StatusDot } from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import Tooltip from 'components/ui/Tooltip'
import { Odometer } from 'components/curate/motion/odometer'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { reveal } from 'components/curate/motion/reveal'
import { getNativeCurrency } from 'config/chains'
import { Avatar as ListLogo } from 'pages/browse/avatar'
import {
  CoinAmount,
  coinParts,
  formatInt,
  formatUsd,
  usdFormatFor,
  usdOf,
  UsdLead,
  type HappeningFigures,
  type OpenListChip,
} from './board-rows'
import { coinKey, priceSource, type UsdPrice } from './prices'
import { chainInfo, type DashboardCard } from './view'

/*
 * Open for verification: the figure row of "Happening now" (round 4), over
 * the board's two columns. How many requests nobody has challenged are inside
 * their challenge window, how much collateral stands behind them (one figure
 * per chain coin, never added across coins, DESIGN.md Data rules), and where
 * they are: which lists hold them. Each of those requests is collateralised,
 * and whoever shows one breaks its list's rules takes that collateral.
 *
 * Round 4 dropped the "Next window closes" countdown: a countdown to one
 * anonymous request was the one figure here nobody could act on, and the rows
 * below carry their own.
 *
 * Round 6 ("the bar … by list is goofy as hell, find an alternative which
 * can also be centering the numbers and unbox them, but without that bar"):
 * the strip is no longer a box and draws no bar. Under its title, centred on
 * the page, two large figures side by side, parted by a hairline: the count
 * open now, and the bounties, "up for grabs" (round 6: say these are live
 * now and make people want them), dollars first with the coin smaller under
 * them. Under the pair, labelled "Lists with bounties up for grabs" (round
 * 7), the lists holding those requests as tiles of one width in a centred
 * row: the list's logo and name over its count of open requests, a link to
 * them. Most first; past the top four, the rest as one tile.
 *
 * The collateral leads in dollars where a Chainlink feed on the coin's own
 * chain answers (prices.ts), with the exact coin amount and its chain under
 * it; where no price can be read the coin amount is the figure, exactly as it
 * was before dollars existed (board-rows.tsx holds the one rule for both
 * places that carry dollars). The figure waits for the first price read, at
 * most a moment (use-usd-prices.ts), so it never paints the coin large and
 * swaps it for dollars under the reader; a price that answers later fades in.
 * The tooltip on the label names the feeds and how old their answers are.
 *
 * With no bounty up for grabs (nothing open, or no deposit behind what is
 * open) the strip is not drawn at all (round 10); the board below says what
 * is on, and drops its empty submissions column (happening-now.tsx).
 *
 * The strip owns its own loading state: the title and the labels are there
 * from the first paint, with the figures as skeletons, so no heading waits on
 * a load. When the challenge periods could not be read, no window is
 * claimed: the strip counts the unchallenged requests instead and says so,
 * and the lists are the lists holding those. When a chain did not answer at
 * all, the head says so, because "0 open now" would otherwise read as a
 * figure the load never supported.
 */

const breathe = keyframes`
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
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

/*
 * No box (round 6): the strip sits on the stage between the section's
 * heading and the board, its content centred on the page.
 */
const Strip = styled.section`
  ${reveal}
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  margin: 4px 0 32px;
  text-align: center;

  @media (max-width: 720px) {
    gap: 18px;
    margin-bottom: 24px;
  }
`

const StripHead = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`

const TitleRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

const StripTitle = styled.h3`
  margin: 0;
  color: var(--color-muted);
  font-family: var(--font-label);
  font-size: var(--fs-label);
  line-height: var(--lh-label);
  font-weight: 500;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
`

/*
 * The two figures, side by side and centred, a hairline between them. On a
 * phone they keep sharing the line, each half the width.
 */
const Pair = styled.div`
  display: flex;
  justify-content: center;
  align-items: stretch;
  max-width: 100%;

  @media (max-width: 720px) {
    width: 100%;
  }
`

const Figure = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 clamp(24px, 4vw, 64px);

  & + & {
    border-left: 1px solid var(--glass-border);
  }

  /* A tooltip opens over its own text, not over the middle of the column. */
  > .ui-tooltip-trigger {
    align-self: center;
  }

  @media (max-width: 720px) {
    flex: 1 1 0;
    padding: 0 12px;
  }
`

/* The page's lead figure size, larger than the board's (no box around it). */
const leadFigure = css`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(34px, 2.2vw + 20px, 56px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
`

const Count = styled.span`
  display: inline-flex;
  align-items: baseline;
  ${leadFigure}

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
    border-radius: 4px;
  }
`

/* What a figure is, in one line under it; balanced where it wraps. */
const What = styled.span`
  color: var(--color-muted);
  font-size: 15px;
  line-height: 22px;
  text-wrap: balance;
`

/*
 * "Bounties up for grabs": the one label on the strip in the accent, since
 * it is the invitation; the figure above it is what is there to take.
 */
const Grabs = styled.span`
  color: var(--color-primary);
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
`

/* One figure per coin, side by side when the scope holds two. */
const Coins = styled.ul`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 32px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Coin = styled.li`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
`

/*
 * A coin's lead: the dollars where a price was read, the coin amount where
 * not. Keyed by which it is, so a price that answers after the hold fades in
 * as a new figure instead of the digits jumping from coin to dollars.
 */
const CoinLead = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
  ${leadFigure}
  ${reveal}

  small {
    color: var(--color-muted);
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0;
  }
`

const CoinLine = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 2px 10px;
  color: var(--color-muted);
  font-size: 14px;
  line-height: 20px;
`

const Place = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
`

/*
 * Where the bounties are (round 7: "mention that the registries shown with
 * the numbers are the ones with bounties up for grabs … make it more
 * elegant, maybe boxed"): a label, then one tile per list, all the same
 * width, centred as a row and wrapping as one. A tile is the list's logo
 * and name over its count of open requests, and links to them.
 */
const Lists = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 230px));
  justify-content: center;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

const tile = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  height: 100%;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: inherit;
  text-align: left;
  text-decoration: none;
  transition:
    border-color var(--motion),
    translate var(--motion);

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

const TileLink = styled(Link)`
  ${tile}

  &:hover {
    border-color: var(--color-border-strong);
    translate: 0 -2px;
  }

  &:hover [data-name] {
    color: var(--color-primary);
  }
`

const TileStatic = styled.div`
  ${tile}
`

const TileName = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  color: var(--color-muted);
  font-size: 14px;
  line-height: 20px;
  transition: color var(--motion);

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const TileCount = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 26px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;

  small {
    color: var(--color-faint);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    letter-spacing: 0;
  }
`

/* What the tiles are, centred over them. */
const ListsLabel = styled.span`
  margin-bottom: -8px;
  color: var(--color-faint);
  font-size: 13px;
  line-height: 18px;
`

/* The way to the Stake lists when none of them holds an entry to name. */
const StakeLink = styled(Link)`
  color: var(--color-primary);
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  text-decoration: none;
  text-wrap: balance;

  svg {
    margin-left: 6px;
    vertical-align: -1px;
  }

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: 4px;
  }
`

/* The link's last word and its arrow: they wrap together, never apart. */
const NoBreak = styled.span`
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
 * The same sentence, plus where the dollars came from: which feed answered
 * for each coin and how old that answer is. Provenance lives in the tooltip
 * on this page, so the figure line stays a figure line.
 */
const collateralTip = (sources: string[]): string =>
  sources.length === 0
    ? COLLATERAL_TIP
    : `${COLLATERAL_TIP} The dollar values are approximate, from ${sources.join('; ')}.`

const chainName = (chainId: number) =>
  chainInfo(chainId)?.name ?? `Chain ${chainId}`

/** A figure's place while it loads: the lead's height, then its line. */
const FigureSkeleton = ({ width }: { width: string }) => (
  <>
    <SkeletonBlock $height="48px" $width={width} />
    <SkeletonBlock $height="16px" $width="150px" />
  </>
)

/** Lists named before the rest become one entry. */
const NAMED = 4

type Where = {
  key: string
  count: number
  /** A list, by its name and its open requests' page; absent for the rest. */
  list?: OpenListChip
  /** How many lists the rest stands for. */
  lists?: number
}

/**
 * The lists, most first: the top lists by name, then the rest as one entry.
 * A single list past the top four is named rather than called "1 other".
 */
const whereOf = (lists: OpenListChip[]): Where[] => {
  const named = lists.length <= NAMED + 1 ? lists.length : NAMED
  const shown: Where[] = lists
    .slice(0, named)
    .map((list) => ({ key: list.key, count: list.count, list }))
  const rest = lists.slice(named)
  if (rest.length > 0)
    shown.push({
      key: 'rest',
      count: rest.reduce((sum, list) => sum + list.count, 0),
      lists: rest.length,
    })
  return shown.filter((entry) => entry.count > 0)
}

/** The lists' tiles: each list's logo and name over its count. */
const WhereLine = ({
  where,
  label,
  unit,
  restHref,
}: {
  where: Where[]
  label: string
  /** What the count counts, after it: "open", "open to challenge". */
  unit: string
  restHref?: string
}) => (
  <Lists aria-label={label}>
    {where.map((entry) => {
      const body = (
        <>
          <TileName data-name="">
            {entry.list ? (
              <>
                <ListLogo
                  uri={entry.list.logo}
                  seed={entry.list.key}
                  size={22}
                />
                <span>{entry.list.title}</span>
              </>
            ) : (
              <span>{formatInt(entry.lists ?? 0)} other lists</span>
            )}
          </TileName>
          <TileCount>
            {formatInt(entry.count)}
            <small>{unit}</small>
          </TileCount>
        </>
      )
      const href = entry.list?.href ?? restHref
      return (
        <li key={entry.key}>
          {href ? (
            <TileLink to={href} title={entry.list?.title}>
              {body}
            </TileLink>
          ) : (
            <TileStatic>{body}</TileStatic>
          )}
        </li>
      )
    })}
  </Lists>
)

export const OpenForVerification = ({
  open,
  openLists,
  figures,
  prices,
  pricesSettled,
  checking,
  unloaded,
  stakeHref,
  stakeLists,
}: {
  /**
   * The requests the strip counts: the rows themselves are the submissions
   * column of the board below, which carries each one's own deadline.
   */
  open: DashboardCard[]
  /**
   * The lists holding those requests, most first, each with its count and
   * the page of its open requests (view.ts buildBoard).
   */
  openLists: OpenListChip[]
  /** Undefined while the load is still running: the strip shows skeletons. */
  figures?: HappeningFigures
  /**
   * Dollars per whole coin, keyed by coin (use-usd-prices.ts). A coin missing
   * from it, and every coin once the prices never arrive, leads with its
   * amount. A price that has passed its feed's heartbeat leaves that map, so
   * the dollars go rather than age.
   */
  prices?: Record<string, UsdPrice>
  /** False while the first price read is held for: the money stays a skeleton. */
  pricesSettled: boolean
  /** The challenge windows are being read again. */
  checking: boolean
  /**
   * Chains in scope whose indexer did not answer ("Gnosis and Ethereum"):
   * the head says their data did not load rather than that nothing is on.
   */
  unloaded?: string
  /** Browse's Stake lists in scope, when there are any. */
  stakeHref?: string
  /**
   * The Stake lists in scope by the entries anyone can challenge on them now
   * (listed, not in court), most first: the lists' line when nothing else is
   * open.
   */
  stakeLists?: OpenListChip[]
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
  // Only the coins that actually show a dollar value explain themselves.
  const sources = coins
    .filter((coin) => coin.usd !== undefined && coin.price)
    .map((coin) => priceSource(coin.price as UsdPrice))

  // Nothing open, and nothing failed to load: the zero state, the same case
  // in which the board below drops its empty submissions column.
  const nothing = !!figures && total === 0 && !unloaded
  const money = known && coins.length > 0
  const where = figures && total > 0 ? whereOf(openLists) : []
  // With nothing open, the Stake lists take the lists' line where any of
  // them holds an entry; else one link to them.
  const stakeWhere = nothing ? whereOf(stakeLists ?? []) : []
  const stake = nothing && stakeWhere.length === 0 && !!stakeHref
  const pastWindow = figures && known ? figures.pastWindow : 0

  // No bounty up for grabs, nothing drawn (round 10: "when bounties up for
  // grab are 0, just hide everything"): the board below says what is on.
  // Unless requests failed to load: then none is not known, and the strip
  // stays to say which did not load.
  if (figures && !unloaded && (total === 0 || (known && !money))) return null

  return (
    <Strip
      aria-labelledby={titleId}
      aria-busy={!figures || undefined}
      style={{ ['--i' as string]: 6 }}
    >
      <StripHead>
        <TitleRow>
          <StatusDot $tone="window" aria-hidden />
          <StripTitle id={titleId}>Open for verification</StripTitle>
        </TitleRow>
        {unloaded && <Small $muted>{unloaded} requests did not load</Small>}
        {checking && (
          <Checking role="status">Checking challenge periods…</Checking>
        )}
      </StripHead>

      {!figures ? (
        <Pair aria-hidden>
          <Figure>
            <FigureSkeleton width="110px" />
          </Figure>
          <Figure>
            <FigureSkeleton width="170px" />
          </Figure>
        </Pair>
      ) : (
        <Pair>
          <Figure>
            {total > 0 ? (
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
            ) : (
              <Count>
                <Odometer value={0} />
              </Count>
            )}
            {/* A comma parts the zero state's two phrases: a narrow line
                breaks after it, where a middle dot would start the next. */}
            <What>
              {nothing && !known
                ? 'none waiting for a challenge'
                : nothing
                  ? `none in a challenge window${
                      pastWindow > 0
                        ? `, ${formatInt(pastWindow)}${plus} waiting to be executed`
                        : ''
                    }`
                  : known
                    ? 'open now, in their challenge window'
                    : 'requests nobody has challenged yet'}
            </What>
          </Figure>

          {money && (
            <Figure>
              {!pricesSettled ? (
                <FigureSkeleton width="170px" />
              ) : (
                <Coins aria-label="Collateral behind the requests open now, one figure per chain coin">
                  {coins.map((coin) => (
                    <Coin key={coin.chainId}>
                      <CoinLead
                        key={coin.usd !== undefined ? 'usd' : 'coin'}
                        style={{ ['--i' as string]: 0 }}
                      >
                        {coin.usd !== undefined ? (
                          <UsdLead
                            value={
                              <AnimatedNumber
                                value={coin.usd}
                                format={usdFormatFor(coin.usd)}
                              />
                            }
                            bound={plus}
                          />
                        ) : (
                          <>
                            <span>
                              {coin.amount}
                              {plus}
                            </span>
                            <small>{coin.symbol}</small>
                          </>
                        )}
                      </CoinLead>
                      {/* The chain's mark parts the two, so a narrow column
                          wraps the chain under the amount with no separator
                          left hanging at a line's end. */}
                      <CoinLine>
                        {coin.usd !== undefined && (
                          <CoinAmount>
                            {coin.amount}
                            {plus}
                            <small>{coin.symbol}</small>
                          </CoinAmount>
                        )}
                        <Place>
                          <ChainLogo chainId={coin.chainId} size={14} />
                          {chainName(coin.chainId)}
                        </Place>
                      </CoinLine>
                    </Coin>
                  ))}
                </Coins>
              )}
              <Tooltip title={<TipText>{collateralTip(sources)}</TipText>}>
                <TipTarget tabIndex={0}>
                  <Grabs>Bounties up for grabs</Grabs>
                </TipTarget>
              </Tooltip>
            </Figure>
          )}
        </Pair>
      )}

      {where.length > 0 && (
        <>
          <ListsLabel>Lists with bounties up for grabs</ListsLabel>
          <WhereLine
            where={where}
            unit="open"
            label="Lists with bounties up for grabs, most open requests first"
          />
        </>
      )}

      {stakeWhere.length > 0 && (
        <>
          <ListsLabel>Always open to challenge on Stake lists</ListsLabel>
          <WhereLine
            where={stakeWhere}
            unit="to challenge"
            label="Entries anyone can challenge now on the Stake lists, by list, most first"
            restHref={stakeHref}
          />
        </>
      )}

      {stake && stakeHref && (
        <StakeLink to={stakeHref}>
          Stake lists stay open to challenge at any{' '}
          <NoBreak>
            time
            <CurateIcon name="submit" size={12} />
          </NoBreak>
        </StakeLink>
      )}
    </Strip>
  )
}
