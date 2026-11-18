import React, { useEffect, useId, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import {
  ChainChip,
  Label,
  Mono,
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
  Registry,
  RowTop,
  formatInt,
  rowBase,
  type HappeningFigures,
} from './board-rows'

/*
 * Disputes, in the page's scope: the ones in court now first, outlined and
 * with a slow pulse, then every ruling the court has issued, all time,
 * newest first, quieter. A ruling for the challenger shows the bounty they
 * won. It is all of "Happening now" — the one panel on the page whose
 * figures are live.
 *
 * The open requests this panel used to sit beside are a band of their own
 * now (open-for-verification.tsx, item 11): live claimable money earns the
 * page's width rather than half a board. The verification record it shared
 * that board with heads its own section below (bounties.tsx), since nothing
 * in it is happening now. The rows all three use come from board-rows.tsx,
 * so they stay the same rows.
 */

/** Disputes in court shown before "+n more". */
const LIVE_LIMIT = 3

const beat = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-contested) 60%, transparent); }
  70% { box-shadow: 0 0 0 7px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 8px;
  ${reveal}
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

/* A dispute in court now: a contested-tone outline, held on hover. */
const LiveRow = styled(Link)`
  ${rowBase}
  background: color-mix(in srgb, var(--color-raised), var(--status-contested) 5%);
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
 * The rulings shown: past about nine rows the list scrolls inside the box,
 * so "show more" never stretches the page. Focus rings sit inside its clip.
 */
const RulingList = styled.div`
  position: relative;
  max-height: 540px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;

  > a:focus-visible {
    outline-offset: -2px;
  }
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

export const Disputes = ({
  live,
  rulings,
  figures,
  now,
  unloaded,
}: {
  live: DashboardCard[]
  rulings: RulingsView
  figures: HappeningFigures
  now: number
  /**
   * Chains in scope whose indexer did not answer ("Gnosis and Ethereum"): an
   * empty panel says their data did not load rather than that nothing is on.
   */
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
      style={{ ['--i' as string]: 0 }}
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
            <Count>
              {formatInt(Math.max(figures.inCourt, live.length))}
              {plus(figures.inCourtCapped)}
            </Count>
            <Label $tone="faint">In court</Label>
          </span>
          <span
            title={
              rulings.partial
                ? 'Some chains’ rulings did not load: at least this many'
                : undefined
            }
          >
            <Count $quiet>
              {rulingsTotal}
              {rulingsPlus}
            </Count>
            <Label $tone="faint">Rulings</Label>
          </span>
        </Tally>
      </PanelHead>

      {live.length === 0 ? (
        <NoLive>
          <StatusDot $tone="neutral" aria-hidden />
          {unloaded ? `${unloaded} disputes did not load` : 'No live disputes'}
        </NoLive>
      ) : (
        liveShown.map((card) => (
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
        ))
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
        <Empty>
          {rulings.partial
            ? 'The rulings did not load'
            : 'No dispute has been ruled on yet'}
        </Empty>
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
    </Panel>
  )
}
