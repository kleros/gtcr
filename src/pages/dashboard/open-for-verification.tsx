import React, { useId } from 'react'
import styled, { css, keyframes } from 'styled-components'
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
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { reveal } from 'components/curate/motion/reveal'
import { getNativeCurrency } from 'config/chains'
import { LaneBar } from 'components/curate/lane-bar'
import { useInView } from 'pages/launch-list/use-in-view'
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
 * Round 5 ("too small, half of the box is empty, make it less goofy"): two
 * figures, however large, left each half of the strip about three-quarters
 * empty. So the strip is one row of data across its whole width: the count,
 * the bounties, and then the lists holding the open requests as one LaneBar
 * across the rest of the row, most first. The top four lists are runs in the
 * one accent at full strength (status-window, the window that is open), told
 * apart by the bar's own gaps and by their order, and the rest one run in the
 * faint ink "other" takes. A legend under the bar names each run in the same
 * order, numbered left to right, its list's name a link to that list's open
 * requests. Stepped strengths of the accent were tried first and read as
 * pastel tints on the light theme and as a greyed violet on the Kleros one
 * (the owner has refused pastel twice), so no run is a tint. With one list
 * the bar is one run with its name; a fifth list is named rather than called
 * "1 other". The bar is the app's one bar (components/curate/lane-bar.tsx):
 * it arms once the strip is in view, as the launch page's does, and reduced
 * motion shows it drawn. Below 900px the two figures sit side by side and the
 * lists take the full width under them.
 *
 * The three parts share their rows (a subgrid): the labels on one line, the
 * bar level with the figures, the legend level with the muted line under
 * each figure. The figures take the page's second-tier size (the hero
 * strip's, index.tsx Big), and each says what it is in one muted line under
 * it: "in their challenge window" is said there and nowhere else on the
 * board.
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
 * With nothing open the count says so and how many requests only wait to be
 * executed, and beside it the Stake lists, which never close to challenge:
 * the board below then drops its empty submissions column (happening-now.tsx),
 * so these are the lines that column carried. They take the same bar, of the
 * Stake lists in scope by the entries anyone can challenge on them right now
 * (listed, not in court), with the same legend; the rest's entry leads to
 * Browse's Stake lists. A scope with no Stake entry to draw (Ethereum's one
 * Stake list holds none) says the count in one line, with the link to the
 * Stake lists at its far end, so the strip is a line of data rather than a
 * box with a blank half.
 *
 * The strip owns its own loading state: the title, the status dot and the
 * labels are there from the first paint, with the figures and the bar as
 * skeletons inside it, so no heading waits on a load. When the challenge
 * periods could not be read, no window is claimed: the strip counts the
 * unchallenged requests instead and says so, and the lists are the lists
 * holding those. When a chain did not answer at all, the head says so,
 * because "Open now 0" would otherwise read as a figure the load never
 * supported.
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

/* What is passing: a chain that did not load, or windows being read again. */
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

/*
 * One row of three parts on a grid of three shared rows: labels, figures,
 * muted lines. Each part is a subgrid of those rows, so a label, a figure
 * and its line sit level with their neighbours' whatever their widths, and
 * the bar sits in the figures' row, centred on them. The figures take the
 * width they need and the lists take the rest of the row.
 *
 * Below 900px the two figures share the first rows half and half, and the
 * lists take a row of their own under them, the full width. A count alone
 * ($line) is one line and the row is just that line.
 */
const Row = styled.div<{ $template: string; $line?: boolean }>`
  display: grid;
  grid-template-columns: ${({ $template }) => $template};
  grid-template-rows: auto auto auto;
  column-gap: clamp(32px, 3.4vw, 56px);
  row-gap: 10px;
  padding-top: 4px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto auto auto auto;
    column-gap: 16px;
  }

  ${({ $line }) =>
    $line &&
    css`
      &&& {
        display: block;
      }
    `}
`

/*
 * A figure's column: its label, the figure, its muted line. Alone in the
 * row ($line) the three sit on one line, so the strip is a line of data
 * rather than a figure in the corner of an empty box.
 */
const Part = styled.div<{ $wide?: boolean; $line?: boolean }>`
  display: grid;
  grid-row: 1 / span 3;
  grid-template-rows: subgrid;
  align-items: start;
  justify-items: start;
  min-width: 0;

  /* A tooltip opens over its own text, not over the middle of the part. */
  > .ui-tooltip-trigger {
    justify-self: start;
  }

  ${({ $line }) =>
    $line &&
    css`
      display: flex;
      flex-wrap: wrap;
      grid-row: auto;
      align-items: baseline;
      gap: 6px 16px;
    `}

  @media (max-width: 900px) {
    ${({ $wide }) =>
      $wide &&
      css`
        grid-column: 1 / -1;
      `}
  }
`

/*
 * The lists: label, bar, legend. On a phone a row of its own under the
 * figures, where the bar keeps its own height and the legend follows it.
 */
const Where = styled.div`
  display: grid;
  grid-row: 1 / span 3;
  grid-template-rows: subgrid;
  min-width: 0;

  @media (max-width: 900px) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    grid-column: 1 / -1;
    grid-row: 4;
    margin-top: 14px;
  }
`

/* The bar, centred on the figures beside it. */
const BarRow = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`

/* Under the bar: one entry per run, wrapping, at most five. */
const Legend = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px 22px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
`

const LegendItem = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  font-size: 14px;
  line-height: 20px;

  b {
    flex: 0 0 auto;
    color: var(--color-muted);
    font-family: var(--font-figure);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

/*
 * A named run's place in the bar, left to right: every named run is the same
 * accent, so the legend says which is which by order, not by a tint.
 */
const Rank = styled.span`
  flex: 0 0 auto;
  min-width: 1ch;
  color: var(--status-window);
  font-family: var(--font-figure);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

const ListName = styled(Link)`
  min-width: 0;
  max-width: 40ch;
  overflow: hidden;
  color: var(--color-text);
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: 4px;
  }
`

const othersText = css`
  min-width: 0;
  color: var(--color-muted);
  white-space: nowrap;
`

const Others = styled.span`
  ${othersText}
`

/* The rest's entry, where it leads somewhere (Browse's Stake lists). */
const OthersLink = styled(Link)`
  ${othersText}
  text-decoration: none;

  &:hover {
    color: var(--color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: 4px;
  }
`

/* The page's second-tier figure: the size of the hero strip's (index.tsx). */
const leadFigure = css`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(30px, 1.6vw + 20px, 44px);
  line-height: 0.95;
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

/*
 * What the figure above it is, in one muted line; balanced where it wraps,
 * so a narrow column never leaves one word alone on the second line.
 */
const Sub = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 12px;
  min-width: 0;
  color: var(--color-muted);
  font-size: 14px;
  line-height: 20px;
  text-wrap: balance;
`

/*
 * One figure per coin: amounts stay in their chain's own coin. The coins sit
 * side by side in the figure's two rows, each coin a subgrid of them, so
 * every coin's line stays level with the count's.
 */
const Coins = styled.ul`
  display: grid;
  grid-row: 2 / span 2;
  grid-template-rows: subgrid;
  grid-auto-flow: column;
  column-gap: 40px;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: 900px) {
    column-gap: 24px;
  }
`

const Coin = styled.li`
  display: grid;
  grid-row: 1 / span 2;
  grid-template-rows: subgrid;
  align-items: start;
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
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0;
  }
`

const Place = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
`

/*
 * Where a reader goes when nothing has a window and no Stake list holds an
 * entry to draw: the lists that never close. It ends the count's line, at
 * the row's far end, so the line runs the strip's width; on a phone it wraps
 * under the count, from the left.
 */
const StakeLink = styled(Link)`
  display: inline;
  margin-left: auto;
  text-wrap: balance;
  color: var(--color-primary);
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  text-decoration: none;

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

  @media (max-width: 900px) {
    margin-left: 0;
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
    <SkeletonBlock $height="42px" $width={width} />
    <SkeletonBlock $height="14px" $width="150px" style={{ margin: '3px 0' }} />
  </>
)

/** Lists named in the bar before the rest become one run. */
const NAMED = 4

/**
 * Every named run is the one accent at full strength: the bar is one
 * quantity split by list, not categories to tell apart (DESIGN.md keeps the
 * viz set for chart series), and a tint of the accent reads as pastel on the
 * light theme. The bar's gaps part the runs; the legend's order names them.
 */
const NAMED_HUE = 'var(--status-window)'

/**
 * The rest: the faint ink DESIGN.md gives "other" in a composition, at a
 * strength that still reads as a run of requests on the surface rather than
 * as a track behind the bar (the jury tally's 30% is for seats with no vote,
 * which should look empty; these are not).
 */
const REST_HUE = 'color-mix(in srgb, var(--color-faint) 60%, transparent)'

type Run = {
  key: string
  hue: string
  count: number
  /** A list, by its name and its open requests' page; absent for the rest. */
  list?: OpenListChip
  /** How many lists the rest run stands for. */
  lists?: number
}

/**
 * The bar's runs, most first: the top lists by name, then the rest as one
 * run. A single list past the top four is named rather than called "1 other
 * list".
 */
const runsOf = (lists: OpenListChip[]): Run[] => {
  const named = lists.length <= NAMED + 1 ? lists.length : NAMED
  const runs: Run[] = lists.slice(0, named).map((list) => ({
    key: list.key,
    hue: NAMED_HUE,
    count: list.count,
    list,
  }))
  const rest = lists.slice(named)
  if (rest.length > 0)
    runs.push({
      key: 'rest',
      hue: REST_HUE,
      count: rest.reduce((sum, list) => sum + list.count, 0),
      lists: rest.length,
    })
  return runs.filter((run) => run.count > 0)
}

/**
 * The legend under a bar: one entry per run, in the bar's order. The named
 * runs are numbered left to right when there is more than one of them, since
 * they share a hue; the rest's entry is muted, as its run is faint, and leads
 * to `restHref` where there is one.
 */
const RunLegend = ({
  runs,
  label,
  restHref,
}: {
  runs: Run[]
  label: string
  restHref?: string
}) => {
  const ranked = runs.filter((run) => run.list).length > 1
  return (
    <Legend aria-label={label}>
      {runs.map((run, index) => (
        <LegendItem key={run.key}>
          {run.list ? (
            <>
              {ranked && <Rank aria-hidden>{index + 1}</Rank>}
              <ListName to={run.list.href} title={run.list.title}>
                {run.list.title}
              </ListName>
            </>
          ) : restHref ? (
            <OthersLink to={restHref}>
              {formatInt(run.lists ?? 0)} other lists
            </OthersLink>
          ) : (
            <Others>{formatInt(run.lists ?? 0)} other lists</Others>
          )}
          <b>{formatInt(run.count)}</b>
        </LegendItem>
      ))}
    </Legend>
  )
}

const toLane = (runs: Run[]) =>
  runs.map((run) => ({ key: run.key, weight: run.count, hue: run.hue }))

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
   * the page of its open requests (view.ts buildBoard): the bar's runs.
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
   * (listed, not in court), most first: the bar when nothing else is open.
   */
  stakeLists?: OpenListChip[]
}) => {
  const titleId = useId()
  // The bar draws once the strip is in view (the launch page's arming). The
  // strip is always mounted, skeletons included, so it holds the observer.
  const [bandRef, inView] = useInView<HTMLElement>(0.35)
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
  // in which the board below drops its submissions column.
  const nothing = !!figures && total === 0 && !unloaded
  const money = known && coins.length > 0
  const runs = figures && total > 0 ? runsOf(openLists) : []
  const where = runs.length > 0
  // With nothing open, the Stake lists take the lists' place: as a bar where
  // any of them holds an entry, else as a link at the end of the count's line.
  const stakeRuns = nothing ? runsOf(stakeLists ?? []) : []
  const always = stakeRuns.length > 0
  const stake = nothing && !always && !!stakeHref
  const pastWindow = figures && known ? figures.pastWindow : 0
  // The count with no figure or bar beside it says itself in one line.
  const line = !!figures && !money && !where && !always

  /*
   * The row's columns: each figure as wide as it is, and the lists (or, with
   * nothing open, the Stake lists) the rest. A count with nothing beside it
   * takes the row.
   */
  const template = !figures
    ? 'max-content max-content minmax(0, 1fr)'
    : line
      ? 'minmax(0, 1fr)'
      : [
          'max-content',
          ...(money ? ['max-content'] : []),
          ...(where || always ? ['minmax(0, 1fr)'] : []),
        ].join(' ')
  // Below 900px the count shares its line only with the bounties; a bar
  // always takes a row of its own under it.
  const countWide = !!figures && !money

  return (
    <Band
      ref={bandRef}
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
        {(unloaded || checking) && (
          <HeadNote>
            {unloaded && <Small $muted>{unloaded} requests did not load</Small>}
            {checking && (
              <Checking role="status">Checking challenge periods…</Checking>
            )}
          </HeadNote>
        )}
      </StripHead>

      {!figures ? (
        <Row $template={template} aria-hidden>
          <Part>
            <Label $tone="faint">Open now</Label>
            <FigureSkeleton width="96px" />
          </Part>
          <Part>
            <Label $tone="faint">Bounties</Label>
            <FigureSkeleton width="150px" />
          </Part>
          <Where>
            <Label $tone="faint">By list</Label>
            <BarRow>
              <SkeletonBlock $height="10px" $width="100%" />
            </BarRow>
            <SkeletonBlock $height="14px" $width="min(420px, 80%)" />
          </Where>
        </Row>
      ) : (
        <Row $template={template} $line={line}>
          <Part $wide={countWide} $line={line}>
            <Label $tone="faint">{known ? 'Open now' : 'Not challenged'}</Label>
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
            <Sub>
              {nothing && !known
                ? 'none waiting for a challenge'
                : nothing
                  ? `none in a challenge window${
                      pastWindow > 0
                        ? `, ${formatInt(pastWindow)}${plus} waiting to be executed`
                        : ''
                    }`
                  : known
                    ? 'in their challenge window'
                    : 'requests nobody has challenged yet'}
            </Sub>
            {stake && stakeHref && (
              <StakeLink to={stakeHref}>
                Stake lists stay open to challenge at any{' '}
                <NoBreak>
                  time
                  <CurateIcon name="submit" size={12} />
                </NoBreak>
              </StakeLink>
            )}
          </Part>

          {money && (
            <Part>
              <Tooltip title={<TipText>{collateralTip(sources)}</TipText>}>
                <TipTarget tabIndex={0}>
                  <Label $tone="faint">Bounties</Label>
                </TipTarget>
              </Tooltip>
              {!pricesSettled ? (
                <FigureSkeleton width="150px" />
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
                          can wrap the chain under the amount with no
                          separator left hanging at a line's end. */}
                      <Sub>
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
                      </Sub>
                    </Coin>
                  ))}
                </Coins>
              )}
            </Part>
          )}

          {where && (
            <Where>
              <Label $tone="faint">By list</Label>
              <BarRow>
                <LaneBar runs={toLane(runs)} armed={inView} delay={160} />
              </BarRow>
              <RunLegend
                runs={runs}
                label="Where those requests are, by list, most first"
              />
            </Where>
          )}

          {always && (
            <Where>
              <Label $tone="faint">Always open on Stake lists</Label>
              <BarRow>
                <LaneBar runs={toLane(stakeRuns)} armed={inView} delay={160} />
              </BarRow>
              <RunLegend
                runs={stakeRuns}
                label="Entries anyone can challenge now on the Stake lists, by list, most first"
                restHref={stakeHref}
              />
            </Where>
          )}
        </Row>
      )}
    </Band>
  )
}
