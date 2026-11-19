import React, { useEffect, useId, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import {
  ChainChip,
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
import { formatAbsolute } from 'utils/time'
import { formatAgoLong, type DashboardCard } from './view'
import {
  Avatar,
  Empty,
  Identifier,
  Meta,
  More,
  OpenRow,
  Registry,
  RowTop,
  formatInt,
  repeatedIds,
  rowBase,
  type HappeningFigures,
  type OpenListChip,
} from './board-rows'
import { Avatar as ListLogo } from 'pages/browse/avatar'

/*
 * Happening now, as two columns side by side (round 3): the recent
 * submissions on the left — unresolved requests nobody has challenged, the
 * rows the figures strip above counts — and on the right what is in court
 * now, outlined and with a slow pulse, over every ruling the court has
 * issued, all time, newest first and quieter. A ruling for the challenger
 * shows the bounty they won.
 *
 * Round 2 gave the open requests a full-width band of their own and left
 * the disputes alone on this board; round 3 puts them back beside each
 * other, because a reader comparing what can still be challenged with what
 * is already being argued reads both at once. The strip above keeps the
 * figures (open-for-verification.tsx); this board keeps the rows.
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
 * the scope has rulings to fill it with. Below 900px there is one column:
 * the cap comes off, neither list is a scroller, each panel sizes to its own
 * content and a drag over the rows scrolls the page.
 *
 * The board owns its loading state: both heads, titles and labels are there
 * from the first paint with skeletons where the rows and tallies go, so the
 * two columns are the same height while the load runs and the gap cannot
 * flash in. The rows the board's two columns use come from board-rows.tsx,
 * so they stay the same rows.
 */

/** Disputes in court shown before "+n more". */
const LIVE_LIMIT = 3
/** Open requests the submissions column shows before "+n more". */
const OPEN_LIMIT = 8
/**
 * The cap both panels share, their chrome included, so neither column
 * outruns the other and the growing list inside the shorter one can take
 * every bit of the slack. 760px is about the height the board reached when
 * each list capped at 540px of its own, so it keeps the proportions it had.
 */
const PANEL_CAP = '760px'
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
 * above the other.
 */
const Board = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  /* The section break under the board: the Kleros Verified strip that
     follows has no heading of its own to carry it (verified-lists.tsx). */
  margin-bottom: 48px;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  max-height: ${PANEL_CAP};
  ${reveal}

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

const Count = styled.span<{ $quiet?: boolean }>`
  color: ${({ $quiet }) =>
    $quiet ? 'var(--color-muted)' : 'var(--color-text)'};
  font-family: var(--font-figure);
  font-size: ${({ $quiet }) => ($quiet ? '20px' : '28px')};
  line-height: 1;
  font-weight: 500;
  letter-spacing: var(--tracking-display);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Tally = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 18px;
  flex: 0 0 auto;

  > span {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  /* Phones: the tally wraps under the title and reads from the left. */
  @media (max-width: 520px) {
    > span {
      align-items: flex-start;
    }
  }
`

/*
 * The submissions column's one growing region: it takes whatever height the
 * panel has left over the column's chrome, and it scrolls only where the
 * panel's cap leaves it shorter than its rows, so "+n more" never stretches
 * the page. Focus rings sit inside its clip.
 */
const Rows = styled.ul`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;
  list-style: none;

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
    overflow-y: visible;
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
 * Collapsed it is nothing but a wrapper — LIVE_LIMIT rows fit inside the
 * cap. Once the reader expands the rest it takes at most LIVE_SHARE of the
 * column and scrolls, so the panel keeps its height, the rulings keep their
 * room, and no row spills out of the surface.
 */
const LiveGroup = styled.div<{ $capped?: boolean }>`
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 8px;
  min-height: 0;

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
 * height left under the rows in court and scrolls only where the panel's cap
 * leaves it shorter than its rulings, so "show more" never stretches the
 * page. Focus rings sit inside its clip.
 */
const RulingList = styled.div`
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
  /** Every ruling the court has issued in scope (a refusal included). */
  total: number
  /** The ledger stopped at its page limit: total is a lower bound. */
  capped: boolean
  /** The ledger did not load on some chain in scope. */
  partial: boolean
  /** Shows more rows (absent when every row shows). */
  onMore?: () => void
  /** Back to the first rows (absent when only those show). */
  onFewer?: () => void
}

/** The open requests, closing soonest first: the board's left column. */
const Submissions = ({
  open,
  openLists,
  figures,
  now,
  stakeHref,
  unloaded,
}: {
  open: DashboardCard[]
  openLists: OpenListChip[]
  figures?: HappeningFigures
  now: number
  stakeHref?: string
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

  return (
    <Panel
      as="section"
      $padding="compact"
      aria-labelledby={titleId}
      style={{ ['--i' as string]: 7 }}
    >
      <PanelHead>
        <Heading>
          <TitleRow>
            <StatusDot $tone="window" aria-hidden />
            <PanelTitle id={titleId}>Recent submissions</PanelTitle>
          </TitleRow>
          <Small $faint>
            {known
              ? 'In their challenge window, closing soonest first'
              : 'Nobody has challenged these yet, newest first'}
          </Small>
        </Heading>
      </PanelHead>

      {!figures ? (
        <SkeletonRows aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonBlock key={index} $height="88px" />
          ))}
        </SkeletonRows>
      ) : shown.length === 0 ? (
        <NoRows>
          {unloaded
            ? `${unloaded} requests did not load`
            : known
              ? 'No request in its challenge period'
              : 'No request waiting for a challenge'}
        </NoRows>
      ) : (
        <Rows
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
        <More type="button" onClick={() => setExpanded(false)}>
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
}: {
  live: DashboardCard[]
  rulings: RulingsView
  figures?: HappeningFigures
  now: number
  unloaded?: string
}) => {
  const titleId = useId()
  const [liveExpanded, setLiveExpanded] = useState(false)
  const plus = (capped: boolean) => (capped ? '+' : '')

  const liveShown = liveExpanded ? live : live.slice(0, LIVE_LIMIT)

  // A ledger that did not load on some chain: what loaded is a lower bound.
  const rulingsTotal =
    rulings.partial && rulings.total === 0 ? '—' : formatInt(rulings.total)
  const rulingsPlus =
    rulings.total > 0 ? plus(rulings.capped || rulings.partial) : ''

  // "Show more" brings the first new ruling into view inside the list.
  const rulingList = useRef<HTMLDivElement>(null)
  const shownBefore = useRef(rulings.cards.length)
  useEffect(() => {
    const list = rulingList.current
    const before = shownBefore.current
    shownBefore.current = rulings.cards.length
    if (!list || rulings.cards.length <= before || before === 0) return
    const first = list.children[before] as HTMLElement | undefined
    if (!first || list.scrollHeight <= list.clientHeight) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({
      top: first.offsetTop - 4,
      behavior: still ? 'auto' : 'smooth',
    })
  }, [rulings.cards.length])

  return (
    <Panel
      as="section"
      $padding="compact"
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
            <LiveGroup $capped={liveExpanded}>
              {liveShown.map((card) => (
                <LiveRow
                  key={card.id}
                  to={card.href}
                  title={card.actor ? `by ${card.actor}` : undefined}
                >
                  <Avatar logo={card.logo} seed={card.registryAddress} />
                  <RowTop>
                    <Registry card={card} />
                    <ChainChip chainId={card.chainId} size="sm" />
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
          {liveExpanded && live.length > LIVE_LIMIT && (
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
            <RulingList ref={rulingList}>
              {rulings.cards.map((card) => (
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
          {(rulings.onMore || rulings.onFewer) && (
            <RulingsFooter>
              {rulings.onMore && (
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
                {formatInt(rulings.cards.length)} of {rulingsTotal}
                {rulingsPlus}
              </Small>
            </RulingsFooter>
          )}
        </>
      )}
    </Panel>
  )
}

export const LiveBoard = ({
  open,
  openLists,
  live,
  rulings,
  figures,
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
  now: number
  /** Browse's Stake lists in scope, when there are any. */
  stakeHref?: string
  /**
   * Chains in scope whose indexer did not answer ("Gnosis and Ethereum"): an
   * empty column says their data did not load rather than that nothing is on.
   */
  unloaded?: string
}) => (
  <Board>
    <Submissions
      open={open}
      openLists={openLists}
      figures={figures}
      now={now}
      stakeHref={stakeHref}
      unloaded={unloaded}
    />
    <DisputesPanel
      live={live}
      rulings={rulings}
      figures={figures}
      now={now}
      unloaded={unloaded}
    />
  </Board>
)
