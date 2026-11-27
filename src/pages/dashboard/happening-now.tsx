import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import {
  ChainChip,
  Chip,
  Label,
  Mono,
  SkeletonBlock,
  Small,
  StatusDot,
  Surface,
  VisuallyHidden,
} from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import { reveal } from 'components/curate/motion/reveal'
import useStickyTop from 'hooks/use-sticky-top'
import { useMediaQuery } from 'pages/guide/hooks'
import { formatAbsolute } from 'utils/time'
import {
  formatAgoLong,
  isOwnCase,
  ownCasesFirst,
  type DashboardCard,
} from './view'
import {
  Avatar,
  Count,
  Empty,
  Identifier,
  Meta,
  More,
  OpenRow,
  Registry,
  RowTop,
  Tally,
  formatInt,
  moreStyles,
  repeatedIds,
  rowBase,
  type HappeningFigures,
  type OpenListChip,
} from './board-rows'
import {
  ListFilter,
  OpenHead,
  OpenTally,
  listEntries,
} from './open-for-verification'
import type { UsdPrice } from './prices'
import { Avatar as ListLogo } from 'pages/browse/avatar'

/*
 * Happening now, as two columns side by side (round 3), under the section's
 * heading, "Open for verification" (open-for-verification.tsx): the recent
 * submissions on the left — unresolved requests nobody has challenged, with
 * their count and collateral in the panel's head and their lists as chips
 * that filter them — and on the right what is in court
 * now, outlined and with a slow pulse, over every ruling the court has
 * issued, all time, newest first and quieter. A ruling for the challenger
 * shows the bounty they won.
 *
 * The Disputes panel's "Rulings" tally counts the rulings this column can
 * list, Standard and Stake, so "show more" can always reach it, and the
 * self-sustaining panel above takes its share of disputes won by the
 * challenger from the same count. The retired Classic lists count there only
 * in the bounties and the entries ever curated (round 4: "only for this"),
 * which its own line names; their rulings have no page to open, so here they
 * would only be a number no row could ever explain.
 *
 * Round 2 gave the open requests a full-width band of their own and left
 * the disputes alone on this board; round 3 puts them back beside each
 * other, because a reader comparing what can still be challenged with what
 * is already being argued reads both at once. Since 26 Nov 2026 each panel
 * carries its own figures in its head, the submissions' opposite the
 * disputes', where a strip above the board used to hold them.
 *
 * The one rule the layout has to hold is that neither column may end above
 * the other and leave a band of dead page under it. So: the grid stretches
 * (never align-items: start), each panel's surface is height: 100%, and the
 * cap is on the panel (PANEL_CAP) rather than on the lists inside it. Each
 * column then has exactly one growing region — the submissions list on the
 * left, the rulings list on the right — and nothing clamps it below the
 * height its panel has, so the shorter column's slack lands inside that
 * region instead of hanging under its footnotes as blank panel. Both panels
 * carry the same cap, so the taller column sets the row and the shorter one
 * fills it exactly.
 *
 * What those rules do not promise is that the slack disappears. Equal
 * columns over unequal content leaves air somewhere, and air inside the
 * shorter panel reads better than a hole in the page under it: a scope with
 * three rulings beside eight open requests has nothing more to put in the
 * right column, so the rulings sit at the top of their region and the rest
 * of it is empty. With nothing in court a longer first page of rulings
 * (RULINGS_FIRST_QUIET in index.tsx) fills that height with rows as far as
 * the scope has rulings to fill it with.
 *
 * The submissions region draws only whole rows (round 5). It used to scroll
 * inside its capped panel, which cut its last visible card through the
 * middle of its bar and hid two more in a scroll nothing pointed to. Now it
 * clips, and the column measures how many of its rows fit whole in the height
 * it has (the panel's cap, or its neighbour's height) and draws exactly those;
 * "+n more" counts from the rows actually on screen.
 *
 * The cap itself snaps to those rows. A fixed 760px left the submissions five
 * whole rows and a ~72px blank band before "+n more" at 1440, beside a
 * Disputes column that ran tight to its footer; the base drew six rows with
 * the link right under them. So the column takes the whole-row height nearest
 * to PANEL_CAP (six rows, 776px, on / at 1440) and hands it to the board, which caps
 * both panels at it (--panel-cap): the submissions end on their last row. The
 * rulings beside them draw the whole rows that fit that height too, and when
 * some are left out the drawn ones share the remainder (less than one row),
 * so neither column ends in a hollow band. Index.tsx hands this column more
 * rulings than fit, for it to choose from.
 *
 * Once the reader expands either column ("+n more", "Show more rulings"),
 * both caps come off and the page grows, as it did before the columns were
 * capped: "show more" shows more on the page instead of scrolling new rows
 * into a box a few rows tall. The other column does not become a hollow box
 * the height of the one that grew: beside more rulings the submissions take
 * the new height and fill it with as many whole rows as they have loaded,
 * and once every loaded row is drawn with room to spare they keep their own
 * height and ride along instead; beside every submission the Disputes panel
 * keeps its own height and rides along the list (sticky under the app bar),
 * so it stays in view.
 *
 * When nothing at all is open (no request in its window, and nothing failed
 * to load), the submissions column is not drawn: it would be a full-height
 * box around one line saying so (round 3: when one side is empty, the other
 * takes the space), and the section has no heading (round 10: with no bounty
 * up for grabs, hide everything). The Disputes panel takes the board's width
 * and lays its rows in two columns.
 *
 * Below 900px there is one column: the cap comes off, neither list is a
 * scroller, each panel sizes to its own content, the submissions show their
 * first OPEN_LIMIT_STACKED rows, and a drag over the rows scrolls the page.
 *
 * The board owns its loading state: both heads, titles and labels are there
 * from the first paint with skeletons where the rows and tallies go, so the
 * two columns are the same height while the load runs and the gap cannot
 * flash in. The rows the board's two columns use come from board-rows.tsx,
 * so they stay the same rows.
 */

/** Disputes in court shown before "+n more". */
const LIVE_LIMIT = 3
/**
 * The same when the Disputes panel has the board to itself and, above the
 * one-column width, lays its rows in court two to a line: an even first page,
 * so no line is half empty while more rows wait under "+n more".
 */
const LIVE_LIMIT_WIDE = 4
/**
 * Open requests the submissions column tries before "+n more", beside the
 * Disputes panel: as many of them as fit whole are drawn.
 */
const OPEN_LIMIT = 8
/**
 * The same in one column, where there is no neighbour to stay level with and
 * every extra row only lengthens the page before the disputes: the base's 6.
 */
const OPEN_LIMIT_STACKED = 6
/** The width below which the board is one column (Board's own media query). */
const STACKED = '(max-width: 900px)'
/**
 * The height both panels aim for, their chrome included, so neither column
 * outruns the other and the growing list inside the shorter one can take
 * every bit of the slack. 760px is about the height the board reached when
 * each list capped at 540px of its own, so it keeps the proportions it had.
 * The cap the panels actually carry is the whole-row height of the
 * submissions nearest to it (Submissions measures it; LiveBoard sets it as
 * --panel-cap). It holds only until the reader expands a column.
 */
const PANEL_CAP = 760
/**
 * An expanded list of disputes in court is unbounded and those rows cannot
 * shrink, so past this share of the panel they scroll inside the column
 * rather than push the panel past its cap and the rulings out of it. A
 * little over half leaves the four or five rows a reader usually expands to
 * whole and the ledger under them two rulings; the first LIVE_LIMIT rows are
 * never capped at all, so nothing scrolls until the reader asks for more.
 */
const LIVE_SHARE = '55%'

const beat = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-contested) 60%, transparent); }
  70% { box-shadow: 0 0 0 7px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

/*
 * Two columns of equal width, and no `align-items: start`: the grid items
 * stretch so both panels get the full row height and neither column can end
 * above the other. One column of the full width when the submissions column
 * has nothing to show (`$single`).
 */
const Board = styled.div<{ $single?: boolean }>`
  display: grid;
  grid-template-columns: ${({ $single }) =>
    $single ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))'};
  gap: 16px;
  /* The section break under the board: the Kleros Verified strip that
     follows has no heading of its own to carry it (verified-lists.tsx). */
  margin-bottom: 48px;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Panel = styled(Surface)<{ $uncapped?: boolean; $float?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  max-height: ${({ $uncapped }) =>
    $uncapped ? 'none' : `var(--panel-cap, ${PANEL_CAP}px)`};
  ${reveal}

  /*
   * Beside a column the reader has expanded, with nothing more of its own to
   * fill that height (the disputes beside every submission, or the
   * submissions once every loaded row is drawn): as tall as its own content,
   * kept in view while the long column scrolls past it (useStickyTop keeps
   * its foot in view too when it is taller than the window), rather than
   * stretched into a hollow box the height of the list.
   */
  ${({ $float }) =>
    $float &&
    css`
      align-self: start;
      height: auto;

      @media (min-width: 901px) {
        position: sticky;
        top: var(--stick, calc(var(--app-bar-height) + 16px));
      }
    `}

  /* One column: no neighbour to hold level, so the panel is as tall as it
     is and nothing inside it has to scroll. */
  @media (max-width: 900px) {
    max-height: none;
  }
`

const PanelHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 2px 2px 12px;
`

const Heading = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const TitleRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

const PanelTitle = styled.h3`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-label);
  font-size: var(--fs-label);
  line-height: var(--lh-label);
  font-weight: 500;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
`

/*
 * The submissions column's one growing region: it takes whatever height the
 * panel has left over the column's chrome. It never scrolls: it clips, and
 * the column draws only the rows that fit in it whole (Submissions measures
 * them), so no card is ever cut and none hides in a scroll nothing points
 * to. It is the rows' offset parent, which is what the measure reads. Focus
 * rings sit inside its clip.
 *
 * `$fill`: the Disputes column was expanded and sets the height. The rows'
 * own height is then left out of the panel's (size containment), so the
 * panel takes its neighbour's height and the column fills it with as many
 * whole rows as fit, rather than standing beside a longer column with a
 * hollow under its first few.
 */
const Rows = styled.ul<{ $fill?: boolean }>`
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  contain: ${({ $fill }) => ($fill ? 'size' : 'none')};

  > li {
    display: flex;
    flex: 0 0 auto;
    min-width: 0;
  }

  > li > a {
    flex: 1;
    min-width: 0;
  }

  > li > a:focus-visible {
    outline-offset: -2px;
  }

  /* One column: the panel is uncapped, so the rows are a plain stacked
     list and a touch drag over them scrolls the page. */
  @media (max-width: 900px) {
    overflow: visible;
    contain: none;
  }
`

/*
 * Nothing to list: the column still stretches to its neighbour's height, so
 * the message takes the space the rows would have had and sits in the middle
 * of it rather than leaving a hollow panel under one line.
 */
const NoRows = styled(Empty)`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  min-height: 0;
`

/* The rows' shape while they load: they fill the column, they never scroll. */
const SkeletonRows = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  min-height: 0;

  > * {
    flex: 1 1 auto;
  }
`

/* Lists holding the open requests: each leads to that list's open ones. */
const Lists = styled.div`
  display: flex;
  flex: 0 0 auto;
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

/* The two facts the strip above used to carry in its own footer. */
const Footnotes = styled.div`
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
`

/* One list's link under its filtered rows: "All 47 in Address Tags". */
const MoreLink = styled(Link)`
  ${moreStyles}
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
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

/*
 * The rows in court, as one block, so the panel's own gap still spaces them.
 * Collapsed it is nothing but a wrapper — LIVE_LIMIT rows (LIVE_LIMIT_WIDE
 * when wide) fit inside the cap. Once the reader expands the rest it takes at
 * most LIVE_SHARE of the column and scrolls, so the panel keeps its height,
 * the rulings keep their room, and no row spills out of the surface.
 *
 * Alone on the board (`$wide`) the rows lie two to a line. An odd count can
 * then only be all of them (the first page is even), and its last row takes
 * the whole line rather than leave a blank cell beside it.
 */
const LiveGroup = styled.div<{ $capped?: boolean; $wide?: boolean }>`
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 8px;
  min-height: 0;

  /* Alone on the board: two columns, as the rulings under them. */
  ${({ $wide }) =>
    $wide &&
    css`
      @media (min-width: 901px) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 16px;

        > :last-child:nth-child(odd) {
          grid-column: 1 / -1;
        }
      }
    `}

  ${({ $capped }) =>
    $capped &&
    css`
      max-height: ${LIVE_SHARE};
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: var(--color-border-strong) transparent;

      /* Focus rings sit inside the clip, as in the lists. */
      > a:focus-visible {
        outline-offset: -2px;
      }
    `}

  /* One column: the panel is uncapped, so the rows stack and the page
     scrolls them. */
  @media (max-width: 900px) {
    max-height: none;
    overflow-y: visible;
  }
`

/* A dispute in court now: a contested-tone outline, held on hover. */
const LiveRow = styled(Link)`
  ${rowBase}
  flex: 0 0 auto;
  background: color-mix(
    in srgb,
    var(--color-raised),
    var(--status-contested) 5%
  );
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--status-contested) 48%, transparent),
    0 0 22px -10px color-mix(in srgb, var(--status-contested) 70%, transparent);

  &:hover {
    background: color-mix(
      in srgb,
      var(--color-raised),
      var(--status-contested) 9%
    );
    box-shadow:
      inset 0 0 0 1px
        color-mix(in srgb, var(--status-contested) 70%, transparent),
      0 0 26px -10px
        color-mix(in srgb, var(--status-contested) 80%, transparent);
  }
`

/* A row's chips on the right of its top line: "Your case", then the chain. */
const RowChips = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
`

const LiveTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
`

/* Slow pulse on a live dispute; a still halo under reduced motion. */
const Pulse = styled(StatusDot).attrs({ $tone: 'contested' as const })`
  animation: ${beat} 2.6s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const NoLive = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius);
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const GroupHead = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 0 2px 4px;
`

/* Rulings: quieter rows on hairlines, no fill of their own. */
const DecidedRow = styled(Link)`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-top: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: inherit;
  text-decoration: none;
  transition: background var(--motion);

  &:hover {
    background: var(--color-raised);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

const Ruling = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;
  text-align: right;

  > span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
    white-space: nowrap;
  }
`

/*
 * The disputes column's one growing region, the twin of Rows: it takes the
 * height left under the rows in court. Beside the submissions and capped
 * (`$fit`) it clips like Rows and draws only the rulings that fit whole
 * (DisputesPanel measures them, over more than fit: RULINGS_FIRST in
 * index.tsx); when some are left out (`$share`), the drawn rows grow to
 * share the remainder, less than one row, so the column ends on a row
 * rather than on a blank band. `data-measuring` holds them at their own
 * height while they are measured. Otherwise it scrolls only should a scope's
 * rows in court leave it shorter than its rows; "show more" lifts the cap,
 * so new rulings lengthen the page rather than scroll in a box. Focus rings
 * sit inside its clip.
 *
 * Alone on the board (`$wide`, nothing open beside it) the rulings take two
 * columns, so each row keeps its usual width instead of stretching across
 * the page.
 */
const RulingList = styled.div<{
  $wide?: boolean
  $fit?: boolean
  $share?: boolean
}>`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;

  > a:focus-visible {
    outline-offset: -2px;
  }

  ${({ $fit }) =>
    $fit &&
    css`
      display: flex;
      flex-direction: column;
      overflow: hidden;

      > a {
        flex: 0 0 auto;
      }
    `}

  ${({ $share }) =>
    $share &&
    css`
      &:not([data-measuring]) > a {
        flex-grow: 1;
      }
    `}

  ${({ $wide }) =>
    $wide &&
    css`
      @media (min-width: 901px) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-content: start;
        column-gap: 24px;
      }
    `}

  /* One column: a plain ledger, scrolled by the page. */
  @media (max-width: 900px) {
    overflow-y: visible;
  }
`

/* A loading block that fills its column, so the two load the same height. */
const LoadingFill = styled(SkeletonBlock)`
  flex: 1 1 auto;
  min-width: 0;
`

const RulingName = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const shimmer = keyframes`
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.9; }
`

/* The identifier line while the entry's card loads. */
const IdPending = styled.span`
  display: block;
  width: min(160px, 70%);
  height: 10px;
  margin: 3px 0;
  border-radius: 999px;
  background: var(--color-raised);
  animation: ${shimmer} 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

/* What the challenger won, before the ruling's age. */
const WonBounty = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-muted);
  font-family: var(--font-figure);
  font-variant-numeric: tabular-nums;

  svg {
    color: var(--status-window);
  }
`

const RulingsFooter = styled.div`
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;

  > :last-child {
    margin-left: auto;
    font-family: var(--font-figure);
    font-variant-numeric: tabular-nums;
  }
`

/** Every ruling in scope, all time, and the rows shown of them. */
export interface RulingsView {
  /** The rows shown, newest first. */
  cards: DashboardCard[]
  /** Rows whose entry identifiers are still loading. */
  pending: Set<string>
  /**
   * Every ruling in scope this panel can list (a refusal included), on the
   * Standard and Stake lists: the rows "show more" reaches, all of them in
   * the end, and the count the self-sustaining panel's share of disputes is
   * taken on. The retired Classic lists' rulings are not in it (their
   * bounties count in that panel, which names them).
   */
  total: number
  /** The ledger stopped at its page limit: total is a lower bound. */
  capped: boolean
  /** The ledger did not load on some chain in scope. */
  partial: boolean
  /**
   * Shows more rows: present until the reader has expanded the column and
   * every row shows. Beside the submissions the column may draw fewer rows
   * than `cards` (the whole rows that fit), so the button is drawn while any
   * row is left out of the column, drawn or not.
   */
  onMore?: () => void
  /** Back to the first rows (absent when only those show). */
  onFewer?: () => void
}

/** The open requests, closing soonest first: the board's left column. */
const Submissions = ({
  open,
  openLists,
  figures,
  tally,
  filter,
  scopeTotal,
  scopeNote,
  now,
  stakeHref,
  unloaded,
  expanded,
  onExpand,
  uncapped,
  fill,
  neighbour,
  onCap,
}: {
  /** The rows: every open request loaded, or one list's when filtered. */
  open: DashboardCard[]
  /** The lists those rows' requests are in, for the "All n" links. */
  openLists: OpenListChip[]
  figures?: HappeningFigures
  /** The head's figures, opposite the title (OpenTally). */
  tally: React.ReactNode
  /** The list chips under the head (ListFilter), when two lists hold requests. */
  filter?: React.ReactNode
  /** Filtered: the requests the chosen chip counts, loaded or not. */
  scopeTotal?: number
  /** Filtered, with none of the chosen list's rows loaded: why. */
  scopeNote?: string
  now: number
  stakeHref?: string
  unloaded?: string
  /** The reader asked for every row ("+n more"). */
  expanded: boolean
  onExpand: (expanded: boolean) => void
  /** A column was expanded: the panels are as tall as their content. */
  uncapped: boolean
  /** The Disputes column was expanded: take its height and fill it with rows. */
  fill: boolean
  /** What the Disputes column holds, which sets this column's height. */
  neighbour: string
  /**
   * The cap both panels carry, in px: the whole-row height nearest to
   * PANEL_CAP, or undefined for PANEL_CAP itself (every row fits under it).
   */
  onCap: (cap: number | undefined) => void
}) => {
  const titleId = useId()
  const plus = figures?.unchallengedCapped ? '+' : ''

  const known = !!figures?.windowsKnown
  const total = figures
    ? Math.max(
        scopeTotal ?? (known ? figures.inWindow : figures.unchallenged),
        open.length,
      )
    : 0

  /*
   * Whole rows only. Beside the Disputes panel the column tries up to
   * OPEN_LIMIT rows, and a layout effect counts how many of them fit whole in
   * the height the panel gives the list; the column then draws that many.
   * Every pass happens before the browser paints, so a cut row is never
   * seen. The count is kept against what it was measured for — the rows
   * tried, the column's width, whether the panels are capped, and what the
   * neighbour holds — and measured again when any of those change. Fewer
   * rows can only make the column shorter, never give it less room than it
   * measured, so the count cannot flip back and forth. Beside an expanded
   * Disputes column (`fill`) every loaded row is tried, since that column now
   * sets the height and may have room for all of them. In one column there
   * is nothing to measure against: the first OPEN_LIMIT_STACKED rows show.
   *
   * The rows are measured over the chrome the column will draw under them,
   * or the count comes out short and leaves a hollow above it. While a count
   * is pending the column draws "+n more", which it keeps whenever a row is
   * left out. Should every row fit, the column draws no button, and when
   * more requests exist than were loaded it draws the taller "All n by list"
   * block in its place; so it measures once more with that block in, and if
   * the last row no longer fits whole it draws one row fewer over "+1 more",
   * which the first pass showed has room for it.
   *
   * While the panels are capped the room is not the list's height under the
   * cap of the moment but what PANEL_CAP leaves under the column's chrome, so
   * a cap this column set itself never feeds back into its count. When rows
   * are left out, the count is the whole rows whose end lies nearest to that
   * room (one more than fit whole, when the next row's end is nearer), and
   * the cap becomes the chrome plus those rows: the list then ends exactly on
   * its last row and the board carries that height (onCap).
   */
  const stacked = useMediaQuery(STACKED)
  const measured = !expanded && !stacked
  const tried =
    expanded || (measured && fill)
      ? open
      : open.slice(0, stacked ? OPEN_LIMIT_STACKED : OPEN_LIMIT)
  const panelRef = useRef<HTMLElement | null>(null)
  const stickyRef = useStickyTop(16)
  const setPanel = useCallback(
    (node: HTMLElement | null) => {
      panelRef.current = node
      stickyRef(node)
    },
    [stickyRef],
  )
  const rowsRef = useRef<HTMLUListElement>(null)
  const [width, setWidth] = useState(0)
  const [fontsReady, setFontsReady] = useState(false)
  const [fit, setFit] = useState<{
    key: string
    count: number
    /** False until the second pass has checked it under the lists block. */
    settled: boolean
    /** One row fewer than fit over "+n more", to leave the lists room. */
    lowered?: boolean
  }>()
  // Bumped when the count no longer holds on screen (see the observer below).
  const [recheck, setRecheck] = useState(0)
  const fitKey = [
    tried.map((card) => card.id).join(' '),
    width,
    uncapped,
    neighbour,
    fontsReady,
    recheck,
  ].join('|')
  // The list is drawn once the figures are in and there is a row to draw.
  const drawn = !!figures && tried.length > 0
  const current = measured && drawn && fit?.key === fitKey ? fit : undefined
  const pending = measured && drawn && !current
  const shown = current ? tried.slice(0, current.count) : tried

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    )
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  // Webfonts change the rows' height: measure once more when they are in.
  useEffect(() => {
    let live = true
    document.fonts?.ready
      .then(() => live && setFontsReady(true))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  useLayoutEffect(() => {
    if (!measured || (fit?.key === fitKey && fit.settled)) return
    const list = rowsRef.current
    const panel = panelRef.current
    if (!list || !panel) return
    // Capped: the room PANEL_CAP leaves under this column's own chrome.
    // Beside an expanded column: the height the panel has.
    const chrome = panel.offsetHeight - list.clientHeight
    const room = uncapped ? list.clientHeight : PANEL_CAP - chrome
    const ends = ([...list.children] as HTMLElement[]).map(
      (row) => row.offsetTop + row.offsetHeight,
    )
    let count = 0
    while (count < ends.length && ends[count] <= room + 1) count += 1
    const every = count >= tried.length
    // First pass, over "+n more". It stands unless every row fit and none
    // is left to expand to, when the button gives way to the lists block.
    // Second pass: every row over that block (or over nothing).
    const first = fit?.key !== fitKey
    const lowered = !first && !every
    /*
     * Rows left out under the cap: snap it to whole rows. The next row joins
     * when its end lies nearer the room than the last whole row's does, so
     * the cap moves by less than half a row either way.
     */
    let cap: number | undefined
    if (!uncapped && first && !every) {
      const last = count > 0 ? ends[count - 1] : 0
      if (count < ends.length && ends[count] - room < room - last) count += 1
      cap = Math.round(chrome + ends[Math.max(1, count) - 1])
    }
    setFit({
      key: fitKey,
      count: Math.max(1, lowered ? tried.length - 1 : count),
      settled: !first || !every || open.length > tried.length,
      lowered,
    })
    if (first && !uncapped) onCap(cap)
  }, [measured, fit, fitKey, tried.length, open.length, uncapped, onCap])

  /*
   * What a count was measured against can still move once it is taken: the
   * Stake footnote arrives with the lists, a row's identifier loads, the
   * Disputes panel beside the column changes height. A resize observer on the
   * list and its rows checks that the count still holds, the last row whole
   * and no room under it for the next one left out, and asks for a fresh
   * measure when it does not. A fresh measure that comes out the same
   * changes no size, so the observer has nothing more to report.
   */
  const shownKey = shown.map((card) => card.id).join(' ')
  const holds = useRef({ tried: 0, lowered: false })
  const askedRef = useRef('')
  holds.current = { tried: tried.length, lowered: !!current?.lowered }
  useEffect(() => {
    const list = rowsRef.current
    if (!measured || !drawn || !list || typeof ResizeObserver === 'undefined')
      return undefined
    const observer = new ResizeObserver(() => {
      const rows = [...list.children] as HTMLElement[]
      const last = rows[rows.length - 1]
      if (!last) return
      const room = list.clientHeight
      const end = last.offsetTop + last.offsetHeight
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0
      const cut = rows.length > 1 && end > room + 1
      const roomForNext =
        rows.length < holds.current.tried &&
        !holds.current.lowered &&
        end + gap + last.offsetHeight <= room + 1
      if (!cut && !roomForNext) return
      // The room is estimated from the last row's height, and the row left
      // out can be taller: a fresh measure then keeps the same count. Asking
      // again for the same rows at the same sizes would measure forever.
      const asked = `${shownKey}|${rows.length}|${room}|${end}`
      if (askedRef.current === asked) return
      askedRef.current = asked
      setRecheck((n) => n + 1)
    })
    observer.observe(list)
    for (const row of list.children) observer.observe(row)
    return () => observer.disconnect()
  }, [measured, drawn, shownKey])

  const hidden = total - shown.length
  // While a count is pending, "+n more" is drawn so the rows are measured
  // over it (see above); it is never painted with the wrong count.
  const canExpand = !expanded && (pending || open.length > shown.length)
  /*
   * One list chosen: its own page always closes the column ("All 10 in
   * Address Tags"), under "+n more" when that is drawn too, since its rows
   * here are only the ones closing soonest. It is drawn in every pass, so
   * the rows are always measured over it.
   */
  const chosenList =
    scopeTotal !== undefined && openLists.length === 1
      ? openLists[0]
      : undefined
  // A list's own page under its rows: the chosen one, or the only list
  // holding requests once every loaded row is drawn and more exist.
  const listLink =
    chosenList ??
    (!canExpand && hidden > 0 && openLists.length === 1
      ? openLists[0]
      : undefined)
  const repeated = repeatedIds(shown)
  /*
   * Beside an expanded Disputes column with room left once every loaded row
   * is drawn: nothing more can fill that height, so the column stops
   * stretching to it and rides along the rulings at its own height, as the
   * Disputes panel does beside every submission, rather than end in a hollow.
   */
  const float =
    measured && fill && !!current?.settled && shown.length === open.length

  return (
    <Panel
      ref={setPanel}
      as="section"
      $padding="compact"
      $uncapped={uncapped}
      $float={float}
      aria-labelledby={titleId}
      style={{ ['--i' as string]: 7 }}
    >
      <PanelHead>
        <Heading>
          <TitleRow>
            <StatusDot $tone="window" aria-hidden />
            <PanelTitle id={titleId}>Recent submissions</PanelTitle>
          </TitleRow>
          {/* "In their challenge window" is said once, in the count's tip. */}
          <Small $faint>
            {known ? 'Closing soonest first' : 'Newest first'}
          </Small>
        </Heading>
        {tally}
      </PanelHead>
      {figures && filter}

      {!figures ? (
        <SkeletonRows aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonBlock key={index} $height="88px" />
          ))}
        </SkeletonRows>
      ) : shown.length === 0 ? (
        <NoRows>
          {scopeNote ??
            (unloaded
              ? `${unloaded} requests did not load`
              : known
                ? 'No request in its challenge period'
                : 'No request waiting for a challenge')}
        </NoRows>
      ) : (
        <Rows
          ref={rowsRef}
          $fill={measured && fill && !float}
          aria-label={
            known
              ? 'Requests in their challenge window, closing soonest first'
              : 'Unresolved requests nobody has challenged, newest first'
          }
        >
          {shown.map((card) => (
            <li key={card.id}>
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
        <More type="button" onClick={() => onExpand(true)}>
          +{formatInt(hidden)}
          {plus} more
        </More>
      )}
      {listLink && (
        <MoreLink to={listLink.href}>
          All {formatInt(total)}
          {plus} in {listLink.title}
          <CurateIcon name="submit" size={12} />
        </MoreLink>
      )}
      {!chosenList && !canExpand && hidden > 0 && openLists.length > 1 && (
        <Lists>
          <Label $tone="faint">
            All {formatInt(total)}
            {plus} by list
          </Label>
          <ul>
            {openLists.map((list) => (
              <li key={list.key} style={{ minWidth: 0, maxWidth: '100%' }}>
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
        <More type="button" onClick={() => onExpand(false)}>
          Show fewer
        </More>
      )}
      {figures && ((known && figures.pastWindow > 0) || stakeHref) && (
        <Footnotes>
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
        </Footnotes>
      )}
    </Panel>
  )
}

/** In court now over every ruling, all time: the board's right column. */
const DisputesPanel = ({
  live,
  rulings,
  figures,
  now,
  unloaded,
  uncapped,
  float,
  wide,
  cap,
}: {
  live: DashboardCard[]
  rulings: RulingsView
  figures?: HappeningFigures
  now: number
  unloaded?: string
  /** A column was expanded: the panels are as tall as their content. */
  uncapped: boolean
  /** The submissions were expanded to every row: ride beside them. */
  float: boolean
  /** Alone on the board: the rows go in two columns. */
  wide: boolean
  /** The cap the board carries (Submissions' whole-row height), in px. */
  cap?: number
}) => {
  const titleId = useId()
  const stickyRef = useStickyTop(16)
  const panelRef = useRef<HTMLElement | null>(null)
  const setPanel = useCallback(
    (node: HTMLElement | null) => {
      panelRef.current = node
      stickyRef(node)
    },
    [stickyRef],
  )
  const [liveExpanded, setLiveExpanded] = useState(false)
  const plus = (capped: boolean) => (capped ? '+' : '')

  // A connected wallet's own cases come first, marked (view.ts).
  const { address: connected, isConnected } = useAccount()
  const account = isConnected ? connected : undefined
  const ordered = useMemo(() => ownCasesFirst(live, account), [live, account])

  // Two to a line only beside nothing and above the one-column width.
  const stacked = useMediaQuery(STACKED)
  const liveLimit = wide && !stacked ? LIVE_LIMIT_WIDE : LIVE_LIMIT
  const liveShown = liveExpanded ? ordered : ordered.slice(0, liveLimit)

  /*
   * Whole rulings only, beside the submissions while the panels are capped:
   * the twin of the submissions' count. Every ruling handed in is drawn for
   * one pass, at its own height, and a layout effect counts how many end
   * inside the region the panel leaves them; the column then draws that
   * many, and they share what is left (less than a row). Before paint, so a
   * cut row is never seen. The count is kept against what it was measured
   * for (the rows, the width, the cap, the rows in court, the fonts) and a
   * resize observer asks for it again should a row come to be cut, or room
   * open for one more. Alone on the board, expanded or in one column, every
   * row handed in is drawn, as before.
   */
  const fitRulings =
    !uncapped && !stacked && !wide && !!figures && rulings.cards.length > 0
  const rulingsRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [fontsReady, setFontsReady] = useState(false)
  const [recheck, setRecheck] = useState(0)
  const [fit, setFit] = useState<{ key: string; count: number }>()
  const fitKey = [
    rulings.cards.map((card) => card.id).join(' '),
    width,
    cap ?? 0,
    liveShown.length,
    liveExpanded,
    fontsReady,
    recheck,
  ].join('|')
  const current = fitRulings && fit?.key === fitKey ? fit : undefined
  const drawn = current ? rulings.cards.slice(0, current.count) : rulings.cards
  const share = !!current && drawn.length < rulings.cards.length

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    )
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    document.fonts?.ready
      .then(() => active && setFontsReady(true))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useLayoutEffect(() => {
    if (!fitRulings || fit?.key === fitKey) return
    const list = rulingsRef.current
    if (!list) return
    list.setAttribute('data-measuring', '')
    const room = list.clientHeight
    let count = 0
    for (const row of [...list.children] as HTMLElement[]) {
      if (row.offsetTop + row.offsetHeight > room + 1) break
      count += 1
    }
    list.removeAttribute('data-measuring')
    setFit({ key: fitKey, count: Math.max(1, count) })
  }, [fitRulings, fit, fitKey])

  // Still right once drawn? Read at the rows' own height, as measured.
  const drawnKey = drawn.map((card) => card.id).join(' ')
  const handed = useRef(0)
  const askedRef = useRef('')
  handed.current = rulings.cards.length
  useEffect(() => {
    const list = rulingsRef.current
    if (!current || !list || typeof ResizeObserver === 'undefined')
      return undefined
    const observer = new ResizeObserver(() => {
      list.setAttribute('data-measuring', '')
      const rows = [...list.children] as HTMLElement[]
      const last = rows[rows.length - 1]
      const room = list.clientHeight
      const end = last ? last.offsetTop + last.offsetHeight : 0
      const next = last ? last.offsetHeight : 0
      list.removeAttribute('data-measuring')
      if (!last) return
      const cut = rows.length > 1 && end > room + 1
      const roomForNext = rows.length < handed.current && end + next <= room + 1
      if (!cut && !roomForNext) return
      // As in the Submissions column: one fresh measure per set of rows and
      // sizes, since the ruling left out can be taller than the last one.
      const asked = `${drawnKey}|${rows.length}|${room}|${end}`
      if (askedRef.current === asked) return
      askedRef.current = asked
      setRecheck((n) => n + 1)
    })
    observer.observe(list)
    for (const row of list.children) observer.observe(row)
    return () => observer.disconnect()
  }, [current, drawnKey])

  // A ledger that did not load on some chain: what loaded is a lower bound.
  const rulingsTotal =
    rulings.partial && rulings.total === 0 ? '—' : formatInt(rulings.total)
  const rulingsPlus =
    rulings.total > 0 ? plus(rulings.capped || rulings.partial) : ''

  // More to show: a ruling handed in but not drawn, or one not handed in.
  const more =
    !!rulings.onMore &&
    (drawn.length < rulings.cards.length ||
      rulings.cards.length < rulings.total)

  return (
    <Panel
      ref={setPanel}
      as="section"
      $padding="compact"
      $uncapped={uncapped}
      $float={float}
      aria-labelledby={titleId}
      style={{ ['--i' as string]: 8 }}
    >
      <PanelHead>
        <Heading>
          <TitleRow>
            <StatusDot $tone="contested" aria-hidden />
            <PanelTitle id={titleId}>Disputes</PanelTitle>
          </TitleRow>
          <Small $faint>In court now, then every ruling, all time</Small>
        </Heading>
        <Tally>
          <span>
            {figures ? (
              <Count>
                {formatInt(Math.max(figures.inCourt, live.length))}
                {plus(figures.inCourtCapped)}
              </Count>
            ) : (
              <SkeletonBlock $height="28px" $width="48px" />
            )}
            <Label $tone="faint">In court</Label>
          </span>
          <span
            title={
              rulings.partial
                ? 'Some chains’ rulings did not load: at least this many'
                : undefined
            }
          >
            {figures ? (
              <Count $quiet>
                {rulingsTotal}
                {rulingsPlus}
              </Count>
            ) : (
              <SkeletonBlock $height="20px" $width="48px" />
            )}
            <Label $tone="faint">Rulings</Label>
          </span>
        </Tally>
      </PanelHead>

      {!figures ? (
        <>
          <GroupHead>
            <Label $tone="faint">Rulings</Label>
            <Label $tone="faint">Newest first</Label>
          </GroupHead>
          <LoadingFill $height="360px" aria-hidden />
        </>
      ) : (
        <>
          {live.length === 0 ? (
            <NoLive>
              <StatusDot $tone="neutral" aria-hidden />
              {unloaded
                ? `${unloaded} disputes did not load`
                : 'No live disputes'}
            </NoLive>
          ) : (
            <LiveGroup $capped={liveExpanded} $wide={wide}>
              {liveShown.map((card) => (
                <LiveRow
                  key={card.id}
                  to={card.href}
                  title={card.actor ? `by ${card.actor}` : undefined}
                >
                  <Avatar logo={card.logo} seed={card.registryAddress} />
                  <RowTop>
                    <Registry card={card} />
                    <RowChips>
                      {isOwnCase(card, account) && (
                        <Chip $selected title="The connected wallet is a party">
                          <CurateIcon name="user" size={12} />
                          Your case
                        </Chip>
                      )}
                      <ChainChip chainId={card.chainId} size="sm" />
                    </RowChips>
                  </RowTop>
                  <Identifier card={card} />
                  <Meta>
                    <LiveTag>
                      <Pulse aria-hidden />
                      In court
                      {card.detailId && <Mono>{card.detailId}</Mono>}
                    </LiveTag>
                    <Small $muted>{card.when}</Small>
                  </Meta>
                </LiveRow>
              ))}
            </LiveGroup>
          )}
          {live.length > liveShown.length && (
            <More type="button" onClick={() => setLiveExpanded(true)}>
              +{formatInt(live.length - liveShown.length)} more in court
            </More>
          )}
          {liveExpanded && live.length > liveLimit && (
            <More type="button" onClick={() => setLiveExpanded(false)}>
              Show fewer
            </More>
          )}

          <GroupHead>
            <Label $tone="faint">Rulings</Label>
            <Label $tone="faint">Newest first</Label>
          </GroupHead>
          {rulings.cards.length === 0 ? (
            <NoRows>
              {rulings.partial
                ? 'The rulings did not load'
                : 'No dispute has been ruled on yet'}
            </NoRows>
          ) : (
            <RulingList
              ref={rulingsRef}
              $wide={wide}
              $fit={fitRulings}
              $share={share}
            >
              {drawn.map((card) => (
                <DecidedRow key={card.id} to={card.href}>
                  <Avatar logo={card.logo} seed={card.registryAddress} small />
                  <RulingName>
                    <Registry card={card} quiet />
                    {rulings.pending.has(card.id) ? (
                      <IdPending aria-hidden />
                    ) : (
                      <Identifier card={card} />
                    )}
                  </RulingName>
                  <Ruling>
                    <span>
                      <StatusDot $tone={card.tone} aria-hidden />
                      {card.detail}
                    </span>
                    <Small $faint>
                      {card.bounty && (
                        <>
                          <WonBounty title="The bounty the challenger won, on top of their own deposit back">
                            <CurateIcon name="bounty" size={12} />
                            {card.bounty}
                            <VisuallyHidden> bounty won</VisuallyHidden>
                          </WonBounty>
                          {' · '}
                        </>
                      )}
                      <time
                        dateTime={new Date(card.at * 1000).toISOString()}
                        title={formatAbsolute(card.at)}
                      >
                        {formatAgoLong(card.at, now)}
                      </time>
                    </Small>
                  </Ruling>
                </DecidedRow>
              ))}
            </RulingList>
          )}
          {(more || rulings.onFewer) && (
            <RulingsFooter>
              {more && (
                <More type="button" onClick={rulings.onMore}>
                  Show more rulings
                </More>
              )}
              {rulings.onFewer && (
                <More type="button" onClick={rulings.onFewer}>
                  Show fewer
                </More>
              )}
              <Small $faint role="status">
                {formatInt(drawn.length)} of {rulingsTotal}
                {rulingsPlus}
              </Small>
            </RulingsFooter>
          )}
        </>
      )}
    </Panel>
  )
}

/*
 * The 80px a section heading carries (section.ts), for the board's section
 * when it has no heading: nothing is open, so there is no "Open for
 * verification" to title it.
 */
const Opening = styled.div`
  margin-top: 80px;
`

/** A row's list, keyed as the chips key theirs (`OpenListChip.key`). */
const listOf = (card: DashboardCard) =>
  `${card.chainId}:${card.registryAddress}`

export const LiveBoard = ({
  open,
  openLists,
  live,
  rulings,
  figures,
  prices,
  pricesSettled,
  checking,
  now,
  stakeHref,
  unloaded,
}: {
  /** Unresolved requests nobody has challenged, closing soonest first. */
  open: DashboardCard[]
  /** The lists holding those requests, most first. */
  openLists: OpenListChip[]
  live: DashboardCard[]
  rulings: RulingsView
  /** Undefined while the load is still running: both columns show skeletons. */
  figures?: HappeningFigures
  /** Dollars per whole coin, keyed by coin (use-usd-prices.ts). */
  prices?: Record<string, UsdPrice>
  /** False while the first price read is held for. */
  pricesSettled: boolean
  /** The challenge windows are being read again. */
  checking: boolean
  now: number
  /** Browse's Stake lists in scope, when there are any. */
  stakeHref?: string
  /**
   * Chains in scope whose indexer did not answer ("Gnosis and Ethereum"): an
   * empty column says their data did not load rather than that nothing is on.
   */
  unloaded?: string
}) => {
  const titleId = useId()
  const [openExpanded, setOpenExpanded] = useState(false)
  // The panels' cap, snapped to the submissions' whole rows (Submissions).
  const [cap, setCap] = useState<number>()
  // The list chip pressed (ListFilter); undefined for every list.
  const [listKey, setListKey] = useState<string>()
  // Either column expanded: both caps come off, and the page grows. The
  // other column then either fills the new height with whole rows (the
  // submissions, beside more rulings) or rides beside the long list (the
  // disputes, beside every submission), so neither becomes a hollow box.
  const rulingsExpanded = !!rulings.onFewer
  const uncapped = openExpanded || rulingsExpanded
  /*
   * Nothing is open and nothing failed to load (round 10: "when bounties up
   * for grab are 0, just hide everything"): no heading, no Submissions
   * column, and the disputes take the board's width.
   */
  const known = !!figures?.windowsKnown
  const nothingOpen =
    !!figures &&
    !unloaded &&
    open.length === 0 &&
    (known ? figures.inWindow : figures.unchallenged) === 0
  const snapped = nothingOpen ? undefined : cap

  /*
   * The lists as the column's filter. A chip shows that list's rows among
   * the ones loaded (the requests closing soonest) and counts all of its
   * requests, so "+n more" and the link under the rows lead on to the rest.
   * A list whose last request closed while it was chosen drops out of the
   * chips, and the column shows every list again.
   */
  const entries = useMemo(() => listEntries(openLists), [openLists])
  // Only chips on screen filter: with one list left there are none, and a
  // choice they no longer offer (its list's last request closed, the rest
  // became other lists) is dropped rather than kept for when it returns.
  const chosen =
    entries.length > 1
      ? entries.find((entry) => entry.key === listKey)
      : undefined
  useEffect(() => {
    if (listKey !== undefined && !chosen) setListKey(undefined)
  }, [listKey, chosen])
  const scope = useMemo(() => {
    if (!chosen) return { open, lists: openLists }
    const lists = chosen.list ? [chosen.list] : (chosen.rest ?? [])
    const keys = new Set(lists.map((list) => list.key))
    return {
      open: open.filter((card) => keys.has(listOf(card))),
      lists,
      total: chosen.count,
      note: `${chosen.list ? 'Its' : 'Their'} requests close later than the ones loaded here`,
    }
  }, [chosen, open, openLists])
  const choose = useCallback((key: string | undefined) => {
    setListKey(key)
    setOpenExpanded(false)
  }, [])
  const allTotal = figures
    ? Math.max(known ? figures.inWindow : figures.unchallenged, open.length)
    : 0

  return (
    <section aria-labelledby={nothingOpen ? undefined : titleId}>
      {nothingOpen ? (
        <Opening />
      ) : (
        <OpenHead titleId={titleId} checking={checking} unloaded={unloaded} />
      )}
      <Board
        $single={nothingOpen}
        style={
          snapped
            ? ({
                ['--panel-cap' as string]: `${snapped}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {!nothingOpen && (
          <Submissions
            open={scope.open}
            openLists={scope.lists}
            figures={figures}
            tally={
              <OpenTally
                open={open}
                figures={figures}
                prices={prices}
                pricesSettled={pricesSettled}
                unloaded={unloaded}
              />
            }
            filter={
              entries.length > 1 ? (
                <ListFilter
                  entries={entries}
                  total={allTotal}
                  plus={figures?.unchallengedCapped ? '+' : ''}
                  chosen={chosen?.key}
                  onChoose={choose}
                />
              ) : undefined
            }
            scopeTotal={scope.total}
            scopeNote={scope.note}
            now={now}
            stakeHref={stakeHref}
            unloaded={unloaded}
            expanded={openExpanded}
            onExpand={setOpenExpanded}
            uncapped={uncapped}
            fill={rulingsExpanded && !openExpanded}
            neighbour={`${live.length}|${rulings.cards.length}`}
            onCap={setCap}
          />
        )}
        <DisputesPanel
          live={live}
          rulings={rulings}
          figures={figures}
          now={now}
          unloaded={unloaded}
          uncapped={uncapped}
          float={openExpanded && !nothingOpen}
          wide={nothingOpen}
          cap={snapped}
        />
      </Board>
    </section>
  )
}
