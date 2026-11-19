import React, { useLayoutEffect, useRef } from 'react'
import styled, { css } from 'styled-components'
import { Link } from 'react-router-dom'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ButtonLink,
  ChainChip,
  Data,
  Label,
  Rail,
  SearchField,
  SegmentedControl,
  SkeletonBlock,
  Small,
  Surface,
  truncateMiddle,
} from 'components/curate/primitives'
import { EntryStatus } from 'components/curate/entry-status'
import { reveal } from 'components/curate/motion/reveal'
import { LaneBar } from 'components/curate/lane-bar'
import { CuratorMedal, type MedalKind } from 'components/curate/curator-medal'
import { Pagination } from 'components/ui'
import Tooltip from 'components/ui/Tooltip'
import type { AddressBadge, ProfileActivity } from './data'
import {
  ACTIVITY_LAYOUT_OPTIONS,
  FILTERS,
  PAGE_SIZE,
  activityStatus,
  chainNames,
  filterCount,
  formatInt,
  jurorTip,
  otherParty,
  registryHref,
  registryShares,
  type ActivityFilter,
  type ActivityLayout,
  type JurorBadgeView,
} from './view'
import {
  ListTitle,
  PartyLink,
  QuietState,
  RegistryLogo,
  SectionHead,
  SectionTitle,
  When,
} from './parts'
import { LEVELS, TOP_LEVEL, badgeLevel, type BadgeLevel } from './levels'

/*
 * The address's actions as YMax-style rows (or the remembered cards),
 * filtered by kind through the URL, twenty to a page; beside them its badges
 * and the lists its listed actions touch. Each row leads with the entry the
 * action was about (its name, from its identifying fields) and names its list
 * under it. Rows open the entry; the registry and the other party keep their
 * own links.
 */

/* ---------- Filter tabs with counts ---------- */

/*
 * The kind filter is the app's SegmentedControl (radio group, lit thumb,
 * a count after each label). On a narrow screen its track scrolls, so the
 * chosen option is kept in view: a link to ?show=challenge lands with it
 * off to the right otherwise.
 */
const FilterTabsSlot = styled.div`
  min-width: 0;
  max-width: 100%;
`

const FilterTabs = ({
  value,
  counts,
  onChange,
}: {
  value: ActivityFilter
  counts?: Record<ActivityFilter, number>
  onChange: (value: ActivityFilter) => void
}) => {
  const slot = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = slot.current?.querySelector<HTMLElement>('[role="radiogroup"]')
    const node = box?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!box || !node) return
    if (
      node.offsetLeft < box.scrollLeft ||
      node.offsetLeft + node.offsetWidth > box.scrollLeft + box.clientWidth
    )
      box.scrollLeft = node.offsetLeft - 4
  }, [value, counts])
  return (
    <FilterTabsSlot ref={slot}>
      {/* Small, under the profile's tabs (md): two levels of choice. */}
      <SegmentedControl<ActivityFilter>
        // Counts widen the labels inside a track that may not resize (it
        // scrolls on phones), so the thumb is placed afresh when they change.
        key={
          counts
            ? FILTERS.map((option) => counts[option.value]).join('-')
            : 'loading'
        }
        ariaLabel="Show"
        size="sm"
        value={value}
        onChange={onChange}
        options={FILTERS.map((option) => ({
          value: option.value,
          label: option.label,
          count: counts?.[option.value],
        }))}
      />
    </FilterTabsSlot>
  )
}

/* ---------- Layout ---------- */

/** The list with its rail beside it; under 1100px the rail drops below. */
const Split = styled.div<{ $rail: boolean }>`
  display: grid;
  grid-template-columns: ${({ $rail }) =>
    $rail ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)'};
  gap: 20px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

/* The tab track's 38px: when the governance scan settles and this title
   gives way to the profile's tabs (index.tsx), the list below stays put. */
const ActivityHead = styled(SectionHead)`
  min-height: 38px;
`

/* The kind filter on the left, the search in the middle, the layout (icons
   only, as on Browse) at the right end. Where the three do not fit on one
   line the search takes the next one with the layout; on a phone the
   filter's track scrolls beside the layout and the search fills the line
   under them. */
const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  ${reveal}

  > :last-child {
    flex: 0 0 auto;
  }

  @media (max-width: 720px) {
    > ${FilterTabsSlot} {
      flex: 1 1 0;
    }
  }
`

/* The activity search (round 11): Browse's pill, at the tracks' 38px. */
const Search = styled(SearchField)`
  flex: 1 1 220px;
  min-width: 0;
  height: 38px;
  padding: 0 6px 0 14px;
  border-radius: var(--radius-pill);

  input {
    width: 0;
    font-size: var(--fs-small);
  }

  &:has(input:disabled) {
    opacity: 0.6;
  }

  @media (max-width: 720px) {
    order: 1;
    flex-basis: 100%;
  }
`

const ClearSearch = styled.button`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-faint);
  cursor: pointer;
  transition:
    background var(--motion),
    color var(--motion);

  &:hover {
    background: var(--color-surface);
    color: var(--color-text);
  }
`

const ActivitySearch = ({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) => (
  <Search>
    <CurateIcon name="search" size={16} />
    <input
      aria-label="Search activity"
      placeholder="Search entry, list or address"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="search"
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && value) {
          event.preventDefault()
          onChange('')
        }
      }}
    />
    {value && (
      <ClearSearch
        type="button"
        aria-label="Clear search"
        onClick={() => onChange('')}
      >
        <CurateIcon name="close" size={14} />
      </ClearSearch>
    )}
  </Search>
)

/** One link stretched over the whole row or card; inner links sit above it. */
const Overlay = styled(Link)`
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

const lifted = css`
  a:not([data-overlay]),
  button {
    position: relative;
    z-index: 2;
  }
`

const hoverLift = css`
  transition:
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1);

  &:hover {
    transform: translateY(-1px);
    border-color: var(--color-border-strong);
    box-shadow:
      inset 0 1px 0 var(--glass-highlight),
      var(--shadow-card-hover);
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
    }
  }
`

/* ---------- Rows ---------- */

const RowList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const RowItem = styled.li`
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) minmax(0, 1.15fr) 168px 16px;
  align-items: center;
  gap: 14px;
  min-height: 72px;
  padding: 14px 16px 14px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  ${reveal}
  ${hoverLift}
  ${lifted}

  &:hover [data-chevron] {
    color: var(--color-text);
    transform: translateX(2px);
  }

  /* Narrow: the time moves up beside the registry name, the status and the
     other party (when there is one) follow under the name. */
  @media (max-width: 860px) {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    grid-template-areas:
      'logo name when'
      'logo meta meta'
      '. status status';
    align-items: start;
    gap: 4px 14px;
    padding: 14px;

    > [data-text],
    > [data-side] {
      display: contents;
    }

    > [data-logo] {
      grid-area: logo;
      align-self: center;
    }

    > [data-text] > :first-child {
      grid-area: name;
    }

    > [data-text] > [data-meta] {
      grid-area: meta;
    }

    > [data-status] {
      grid-area: status;
      margin-top: 8px;
    }

    > [data-side] > :first-child {
      grid-area: when;
      align-self: center;
    }

    /* Its own row only when it renders. */
    > [data-side] > [data-party] {
      grid-column: 2 / -1;
      grid-row: 4;
      margin-top: 2px;
    }

    > [data-chevron] {
      display: none;
    }
  }
`

const RowText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  /* A row without an entry name leads with its list. 24px tall: the
     smallest target WCAG 2.2 allows (2.5.8). */
  > [data-title] > a {
    font-size: 15px;
    line-height: 24px;
  }
`

/*
 * The entry's name: plain text, as the row's own link already opens the
 * entry. An address names it in mono, with its network after it; an address
 * that is a list the app knows leads with the list's title, the address
 * after it, small and faint. The overlay
 * link sits above it and takes the hover, so the full identifying fields are
 * that link's title, not this line's.
 *
 * A list's line wraps in a one-line box: the address, never cut, stays
 * beside the title when both fit and drops to the clipped second line when
 * they do not (a phone row), so it is whole or absent, never cut mid-value.
 * The title alone ellipsizes when it is wider than the row.
 */
const EntryLine = styled.span`
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;

  [data-mono] {
    font-family: var(--font-mono);
    font-size: 14px;
  }

  small {
    color: var(--color-faint);
    font-size: 13px;
    font-weight: 400;
  }

  small [data-mono] {
    font-size: 12px;
  }

  &[data-list] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    height: 22px;

    > [data-name] {
      flex: 0 1 auto;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    > small {
      flex: none;
      padding-left: 0.3em;
    }
  }
`

const RowMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;

  /* The list, under the entry's name: a step down, muted. */
  > [data-title] {
    flex: 0 1 auto;
  }

  > [data-title] > a {
    color: var(--color-muted);
    font-size: 13px;
    line-height: 24px;
  }

  > [data-title] > a:hover {
    color: var(--color-primary);
  }
`

/* The entry ID, where no field names the entry. */
const EntryHash = styled.span`
  font-family: var(--font-mono);
`

const RowSide = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 0;
  text-align: right;

  time,
  > span:first-child {
    color: var(--color-text);
    font-size: 15px;
    line-height: 20px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @media (max-width: 860px) {
    time,
    > span:first-child {
      color: var(--color-muted);
      font-size: var(--fs-small);
      line-height: 22px;
    }
  }
`

const Party = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
`

const Chevron = styled.span`
  display: inline-flex;
  color: var(--color-faint);
  transition:
    color 180ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);

  svg {
    transform: rotate(-90deg);
  }
`

/* ---------- Cards ---------- */

const CardGrid = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
`

/* No minimum height: the grid already gives the cards of a row one height,
   and a phone's single column lets each hug its content. */
const CardItem = styled.li`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  ${reveal}
  ${hoverLift}
  ${lifted}
`

const CardTop = styled.div`
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
`

const CardFoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--glass-border);
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/* ---------- Footer ---------- */

const ListFoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  padding: 0 4px;
`

/* ---------- Rail ---------- */

const RailStack = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
`

const RailCard = styled(Surface)`
  ${reveal}
`

const RailHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: 14px;

  h3 {
    margin: 0;
    white-space: nowrap;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 20px;
    line-height: 24px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
`

/*
 * One badge (round 10: "the badge section is SO BASIC"): its medal, then
 * its name and its rule, then how far it is (an LED bar and the figure)
 * or, earned, a lit check. Hairlines part the badges, as rows elsewhere.
 */
const BadgeRow = styled.div<{ $earned?: boolean }>`
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  grid-template-areas:
    'medal name figure'
    'medal measure measure';
  align-items: center;
  gap: 4px 14px;
  padding: 14px 0;
  border-top: 1px solid var(--glass-border);

  &:first-of-type {
    border-top: 0;
    padding-top: 2px;
  }

  &:last-child {
    padding-bottom: 0;
  }

  > [data-medal] {
    grid-area: medal;
    align-self: start;
  }

  > [data-name] {
    grid-area: name;
    min-width: 0;
  }

  > [data-figure] {
    grid-area: figure;
  }

  > [data-measure] {
    grid-area: measure;
    min-width: 0;
  }

  strong {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: ${({ $earned }) =>
      $earned ? 'var(--color-text)' : 'var(--color-muted)'};
    font-family: var(--font-display);
    font-size: 17px;
    line-height: 22px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  strong[data-tip] {
    text-decoration: underline dotted
      color-mix(in srgb, var(--color-text) 40%, transparent);
    text-decoration-thickness: 1.5px;
    text-underline-offset: 5px;
  }
`

const BadgeFigure = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 15px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  small {
    color: var(--color-faint);
    font-size: 12px;
  }
`

/* How many of the badges are earned, beside the card's title. */
const EarnedCount = styled.span`
  color: var(--color-muted);
  font-size: var(--fs-small);
  font-variant-numeric: tabular-nums;
`

/* The juror badge's name carries its explanation (what counts, the Classic
   lists, a capped read) in the shared tooltip; the glyph says one is there. */
const TipTarget = styled.span`
  display: inline-flex;
  align-items: center;
  border-radius: 4px;

  svg {
    color: var(--color-faint);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }
`

/* Balanced lines: a two-line tip never leaves one word on its own line. */
const TipText = styled.span`
  display: block;
  text-wrap: balance;
`

/** A figure that could not be read: said in words, never shown as 0. */
const Unavailable = styled.span`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/* The bar to the next level, and the juror's record under it. */
const Measure = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

/* The name and its level tag on one line, the tag wrapping under a long
   name rather than pushing the figure out. */
const NameLine = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
`

/* "Level 2": the badge's level beside its name, in the accent, the one hue
   the page spends on what is earned. */
const LevelTag = styled.span`
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-text);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
`

const ShareRow = styled.div`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 8px 10px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--glass-border);

  &:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  a {
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  > :nth-child(4) {
    grid-column: 2 / -1;
  }
`

/* ---------- Pieces ---------- */

const EntryId = ({ itemID }: { itemID?: string }) =>
  itemID ? (
    <EntryHash title={itemID}>{truncateMiddle(itemID, 8, 6)}</EntryHash>
  ) : null

/**
 * The two lines of a row or card: the entry's name over its list (with the
 * chain when the rows span chains); or, when no field names the entry, the
 * list over the entry ID, as before names were read.
 */
const ActionText = ({
  activity,
  oneChain,
}: {
  activity: ProfileActivity
  oneChain: boolean
}) => {
  const { entry } = activity
  const list = (
    <ListTitle
      to={registryHref(activity)}
      verified={activity.registryVerified}
      sealSize={entry ? 14 : 16}
    >
      {activity.registryTitle}
    </ListTitle>
  )
  const chain = !oneChain && <ChainChip chainId={activity.chainId} size="sm" />
  if (!entry)
    return (
      <RowText data-text>
        {list}
        <RowMeta data-meta>
          <EntryId itemID={activity.itemID} />
          {chain}
        </RowMeta>
      </RowText>
    )
  return (
    <RowText data-text>
      <EntryLine data-list={entry.list ? '' : undefined}>
        {entry.list ? (
          // A list of lists' entry is a list: its title, the address beside.
          <>
            <span data-name>{entry.list}</span>
            <small>
              {'· '}
              <span data-mono>{entry.text}</span>
              {entry.network && ` · ${entry.network}`}
            </small>
          </>
        ) : entry.address ? (
          <span data-mono>{entry.text}</span>
        ) : (
          entry.text
        )}
        {entry.network && !entry.list && <small> · {entry.network}</small>}
      </EntryLine>
      <RowMeta data-meta>
        {list}
        {chain}
      </RowMeta>
    </RowText>
  )
}

const PartyLine = ({
  activity,
  address,
}: {
  activity: ProfileActivity
  address: string
}) => {
  const party = otherParty(activity, address)
  if (!party) return null
  return (
    <Party data-party>
      {activity.kind === 'challenge' ? 'Requester' : 'Challenger'}
      <PartyLink to={`/address/${party}`} title={party}>
        {truncateMiddle(party)}
      </PartyLink>
    </Party>
  )
}

/**
 * Every identifying field of the entry, one "Label: value" per line: the
 * name in the row is cut to an ellipsis or a shortened address, and this is
 * where it reads in full. On the overlay link, the element the pointer hits.
 */
const entryTitle = (activity: ProfileActivity) =>
  activity.entryFields?.join('\n')

const entryLabel = (activity: ProfileActivity) =>
  activity.entry
    ? `Open ${activity.entry.list ?? activity.entry.text} in ${activity.registryTitle}`
    : activity.itemID
      ? `Open entry ${truncateMiddle(activity.itemID, 8, 6)} in ${activity.registryTitle}`
      : `Open ${activity.registryTitle}`

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ---------- Badges ---------- */

const plural = (count: number, one: string, many: string) =>
  `${formatInt(count)} ${count === 1 ? one : many}`

/**
 * Where a badge stands, for the line under its name: what the next level
 * asks for, or that the top one is reached.
 */
const levelLine = (
  kind: MedalKind,
  level: BadgeLevel,
  one: string,
  many: string,
) =>
  level.next === undefined
    ? `Top level · ${formatInt(LEVELS[kind][TOP_LEVEL - 1])}+ ${many}`
    : `Level ${level.level + 1} at ${plural(level.next, one, many)}`

/**
 * One badge (round 10; levels, round 12): its medal with the level on it,
 * the name with a "Level N" tag, what the next level asks for, then the
 * count against it as an LED bar and "7 / 25"; at the top level, the count
 * alone and a full bar. Hairlines part the badges, as rows elsewhere.
 */
const LevelRow = ({
  kind,
  name,
  level,
  one,
  many,
  tip,
  note,
  figure,
  measured = true,
  caption,
}: {
  kind: MedalKind
  name: string
  level: BadgeLevel
  one: string
  many: string
  /** A tooltip on the name, when the figure needs explaining. */
  tip?: string
  /** Replaces the level line (a figure not read yet). */
  note?: string
  /** Replaces the count (loading, unavailable, a lower bound). */
  figure?: React.ReactNode
  /** False when there is no count to draw a bar for. */
  measured?: boolean
  /** A faint line under the bar. */
  caption?: string
}) => {
  const earned = level.level > 0
  const top = level.next === undefined
  // A name with a tooltip is underlined in dots, not given a help icon: the
  // icon pushed the level tag under a long name.
  const title = <strong data-tip={tip ? '' : undefined}>{name}</strong>
  const bar =
    measured &&
    (level.count > 0 ? (
      <span
        role="img"
        aria-label={
          top
            ? `${name}: top level`
            : `${name}: ${formatInt(level.count)} of ${formatInt(level.next ?? 0)} to level ${level.level + 1}`
        }
      >
        <LaneBar extent={level.share} armed delay={200} />
      </span>
    ) : (
      <Small $faint>Not started</Small>
    ))
  return (
    <BadgeRow $earned={earned}>
      <span data-medal="">
        <CuratorMedal
          kind={kind}
          earned={earned}
          level={level.level}
          progress={level.share}
          size={52}
        />
      </span>
      <div data-name="">
        <NameLine>
          {tip ? (
            <Tooltip title={<TipText>{tip}</TipText>}>
              <TipTarget tabIndex={0}>{title}</TipTarget>
            </Tooltip>
          ) : (
            title
          )}
          {earned && <LevelTag>Level {level.level}</LevelTag>}
        </NameLine>
        <Small $faint style={{ display: 'block' }}>
          {note ?? levelLine(kind, level, one, many)}
        </Small>
      </div>
      <span data-figure="">
        {figure ?? (
          <BadgeFigure
            aria-label={
              top
                ? plural(level.count, one, many)
                : `${formatInt(level.count)} of ${plural(level.next ?? 0, one, many)}`
            }
          >
            {formatInt(level.count)}
            {!top && <small> / {formatInt(level.next ?? 0)}</small>}
          </BadgeFigure>
        )}
      </span>
      {(bar || caption) && (
        <Measure data-measure="">
          {bar}
          {caption && (
            <Small $faint style={{ display: 'block' }}>
              {caption}
            </Small>
          )}
        </Measure>
      )}
    </BadgeRow>
  )
}

/**
 * The juror badge: levels by seats in Curate disputes (levels.ts), with the
 * record under the bar: the disputes drawn in, the seats voted, those still
 * voting. Only what was read is shown: a chain that did not answer makes the
 * seats a lower bound ("+") and is named, votes that could not be read are
 * said so, and nothing read at all is "unavailable", never 0.
 */
const JurorRow = ({ juror }: { juror: JurorBadgeView }) => {
  const ready = juror.state === 'ready'
  const lower = juror.unread.length > 0 || juror.capped.length > 0
  const level = badgeLevel('juror', ready ? juror.seats : 0)
  const top = level.next === undefined
  // By role, so it never reads as the profile's own Disputes figure, which
  // counts the disputes the address was a party to.
  const caption = ready
    ? [
        juror.cases > 0 &&
          `Drawn in ${plural(juror.cases, 'dispute', 'disputes')}`,
        juror.votes !== undefined
          ? juror.seats > 0 && `${formatInt(juror.votes)} voted`
          : `Votes on ${chainNames(juror.votesUnread)} couldn’t be read`,
        juror.votes !== undefined &&
          juror.voting > 0 &&
          `${formatInt(juror.voting)} still voting`,
        juror.unread.length > 0 && `${chainNames(juror.unread)} not read`,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined
  return (
    <LevelRow
      kind="juror"
      name="Juror on Curate"
      level={level}
      one="seat"
      many="seats"
      tip={jurorTip(juror)}
      note={ready ? undefined : 'Seats drawn in Curate disputes'}
      measured={ready}
      caption={caption || undefined}
      figure={
        juror.state === 'loading' ? (
          <SkeletonBlock $width="32px" $height="20px" aria-hidden />
        ) : !ready ? (
          <Unavailable title="The court index did not answer; try again later">
            unavailable
          </Unavailable>
        ) : lower ? (
          <BadgeFigure
            aria-label={`At least ${plural(juror.seats, 'seat', 'seats')}`}
          >
            {formatInt(juror.seats)}+
            {!top && <small> / {formatInt(level.next ?? 0)}</small>}
          </BadgeFigure>
        ) : undefined
      }
    />
  )
}

/**
 * The Badges card, beside the activity: Librarian, Sheriff and Maintainer,
 * then the juror record, each at its level. An address with no action has
 * no activity and no card: its juror record leads the profile panel's
 * figures instead (profile.tsx).
 */
export const BadgesCard = ({
  badges,
  juror,
  scope,
  style,
}: {
  badges?: AddressBadge[]
  juror?: JurorBadgeView
  /** "All chains" or the chain the badges count. */
  scope: string
  style?: React.CSSProperties
}) => {
  const jurorEarned = juror?.state === 'ready' && juror.seats > 0
  const total = (badges?.length ?? 0) + (juror ? 1 : 0)
  const earned =
    (badges?.filter((badge) => badge.earned).length ?? 0) +
    (jurorEarned ? 1 : 0)
  return (
    <RailCard $padding="compact" aria-label="Badges" style={style}>
      <RailHead>
        <h3>Badges</h3>
        <EarnedCount>
          {formatInt(earned)} of {formatInt(total)} earned · {scope}
        </EarnedCount>
      </RailHead>
      {badges?.map((badge) => (
        <LevelRow
          key={badge.id}
          kind={badge.id}
          name={badge.label}
          level={badge}
          one={badge.one}
          many={badge.unit}
        />
      ))}
      {juror && <JurorRow juror={juror} />}
    </RailCard>
  )
}

/* ---------- Section ---------- */

/** What the filter shows, as a noun for "1–20 of 120 …" and empty states. */
const FILTER_NOUN: Record<ActivityFilter, string> = {
  all: 'actions',
  submission: 'submissions',
  removal: 'removals',
  challenge: 'challenges',
  disputed: 'disputed actions',
}

export const ActivitySection = ({
  address,
  loading,
  activities,
  searched,
  shown,
  visible,
  filter,
  onFilter,
  query,
  onQuery,
  page,
  pageSize = PAGE_SIZE,
  onPage,
  layout,
  onLayout,
  badges,
  juror,
  badgeScope,
  truncated,
  chainList,
  now,
  embedded = false,
}: {
  address: string
  loading: boolean
  /** Listed actions in the scope. */
  activities: ProfileActivity[]
  /** Those the search matches, every kind: what the filter counts. */
  searched: ProfileActivity[]
  /** Actions the filter shows. */
  shown: ProfileActivity[]
  /** The current page of them. */
  visible: ProfileActivity[]
  filter: ActivityFilter
  onFilter: (value: ActivityFilter) => void
  /** The activity search, as typed. */
  query: string
  onQuery: (value: string) => void
  page: number
  /** Actions to a page: fewer on a phone. */
  pageSize?: number
  onPage: (page: number) => void
  layout: ActivityLayout
  onLayout: (layout: ActivityLayout) => void
  badges?: AddressBadge[]
  /** The juror record in the scope, read apart from the profile. */
  juror?: JurorBadgeView
  /** "All chains" or the chain the badges count. */
  badgeScope: string
  /** True when the list stops at its limit (older actions not listed). */
  truncated: boolean
  /** "Ethereum, Gnosis, Sepolia" for the empty state. */
  chainList: string
  now: number
  /**
   * Under the profile's tabs, which name the section: no heading of its own
   * (the open tab's name is the section's hidden h2).
   */
  embedded?: boolean
}) => {
  // A new page starts at the top of the list, not at the pager just used
  // (the rows change under it, the viewport stayed at the bottom).
  const sectionRef = useRef<HTMLElement>(null)
  const goToPage = (next: number) => {
    onPage(next)
    sectionRef.current?.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }
  const counts = loading
    ? undefined
    : (Object.fromEntries(
        FILTERS.map((option) => [
          option.value,
          filterCount(searched, option.value),
        ]),
      ) as Record<ActivityFilter, number>)
  const shares = registryShares(activities)
  const showRail = !loading && activities.length > 0
  const filterLabel = FILTER_NOUN[filter]
  const term = query.trim()
  // What the footer and the empty state call the search: “uniswap”.
  const quoted = `\u201C${term}\u201D`
  // A chain chip on every row only helps when the rows span chains; on one
  // chain the identity bar (or the scope control) already names it.
  const oneChain =
    new Set(activities.map((activity) => activity.chainId)).size <= 1

  const list = loading ? (
    <RowList aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonBlock
          key={index}
          $height="72px"
          style={{ borderRadius: 14 }}
        />
      ))}
    </RowList>
  ) : shown.length === 0 ? (
    <Surface $padding="none">
      {activities.length === 0 ? (
        <QuietState
          icon="activity"
          title="No activity indexed"
          action={
            <ButtonLink to="/browse" $variant="secondary" $size="sm">
              Browse lists
            </ButtonLink>
          }
        >
          {`This address has not submitted, removed or challenged an entry on ${chainList}.`}
        </QuietState>
      ) : term && searched.length === 0 ? (
        <QuietState
          icon="search"
          title={`Nothing matches ${quoted}`}
          action={
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              onClick={() => onQuery('')}
            >
              Clear search
            </Button>
          }
        >
          {truncated
            ? `The search reads the ${formatInt(activities.length)} most recent actions: entries, lists, addresses, cases and chains.`
            : 'The search reads entries, lists, addresses, cases and chains.'}
        </QuietState>
      ) : (
        <QuietState
          icon="activity"
          title={
            term
              ? `No ${filterLabel} match ${quoted}`
              : `No ${filterLabel} here`
          }
          action={
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              onClick={() => onFilter('all')}
            >
              Show all actions
            </Button>
          }
        >
          {term
            ? `${plural(searched.length, 'action', 'actions')} of other kinds ${searched.length === 1 ? 'matches' : 'match'} it.`
            : 'Its other actions are one filter away.'}
        </QuietState>
      )}
    </Surface>
  ) : layout === 'cards' ? (
    <CardGrid>
      {visible.map((activity, index) => (
        <CardItem
          key={activity.id}
          style={{ ['--i' as string]: Math.min(index, 12) }}
        >
          <Overlay
            to={activity.href}
            data-overlay
            aria-label={entryLabel(activity)}
            title={entryTitle(activity)}
          />
          <CardTop>
            <RegistryLogo
              uri={activity.registryLogo}
              seed={activity.registryAddress}
              size={36}
            />
            <ActionText activity={activity} oneChain={oneChain} />
          </CardTop>
          <EntryStatus status={activityStatus(activity)} now={now} />
          <CardFoot>
            <When timestamp={activity.timestamp} now={now} />
            <PartyLine activity={activity} address={address} />
          </CardFoot>
        </CardItem>
      ))}
    </CardGrid>
  ) : (
    <RowList>
      {visible.map((activity, index) => (
        <RowItem
          key={activity.id}
          style={{ ['--i' as string]: Math.min(index, 12) }}
        >
          <Overlay
            to={activity.href}
            data-overlay
            aria-label={entryLabel(activity)}
            title={entryTitle(activity)}
          />
          <RegistryLogo
            uri={activity.registryLogo}
            seed={activity.registryAddress}
            data-logo
          />
          <ActionText activity={activity} oneChain={oneChain} />
          <div data-status>
            <EntryStatus status={activityStatus(activity)} now={now} />
          </div>
          <RowSide data-side>
            <When timestamp={activity.timestamp} now={now} />
            <PartyLine activity={activity} address={address} />
          </RowSide>
          <Chevron data-chevron aria-hidden>
            <CurateIcon name="chevron-down" size={16} />
          </Chevron>
        </RowItem>
      ))}
    </RowList>
  )

  return (
    <section aria-label="Activity" ref={sectionRef}>
      {!embedded && (
        <ActivityHead>
          <SectionTitle>
            Activity
            {/* A cut list says so here, beside the filter counts it feeds,
                which then count only these. */}
            {!loading && activities.length > 0 && (
              <small>
                {truncated
                  ? `Latest ${formatInt(activities.length)}`
                  : formatInt(activities.length)}
              </small>
            )}
          </SectionTitle>
        </ActivityHead>
      )}

      <Split $rail={showRail}>
        <div style={{ minWidth: 0 }}>
          <Toolbar style={{ ['--i' as string]: 1 }}>
            <FilterTabs value={filter} counts={counts} onChange={onFilter} />
            {(loading || activities.length > 0) && (
              <ActivitySearch
                value={query}
                disabled={loading}
                onChange={onQuery}
              />
            )}
            <SegmentedControl<ActivityLayout>
              ariaLabel="Layout"
              size="sm"
              value={layout}
              onChange={onLayout}
              options={ACTIVITY_LAYOUT_OPTIONS}
            />
          </Toolbar>
          {/* Keyed so a new filter or page replays the staggered entrance. */}
          <div key={`${filter}-${page}-${layout}`}>{list}</div>
          {!loading && shown.length > 0 && (
            <ListFoot>
              {/* The list is cut by time, so a cut list holds exactly the
                  most recent ones of every kind. */}
              <Small $muted>
                {formatInt((page - 1) * pageSize + 1)}–
                {formatInt(Math.min(page * pageSize, shown.length))} of{' '}
                {truncated ? 'the ' : ''}
                {formatInt(shown.length)}{' '}
                {truncated ? `most recent ${filterLabel}` : filterLabel}
                {term && ` matching ${quoted}`}
              </Small>
              {shown.length > pageSize && (
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={shown.length}
                  onChange={goToPage}
                />
              )}
            </ListFoot>
          )}
        </div>

        {showRail && (
          <RailStack>
            {badges && (
              <BadgesCard
                badges={badges}
                juror={juror}
                scope={badgeScope}
                style={{ ['--i' as string]: 2 }}
              />
            )}

            {shares.length > 0 && (
              <RailCard
                $padding="compact"
                aria-label="Lists acted on"
                style={{ ['--i' as string]: 3 }}
              >
                <RailHead>
                  <h3>Lists acted on</h3>
                  <Label $tone="faint">
                    Of {formatInt(activities.length)} listed actions
                  </Label>
                </RailHead>
                {shares.slice(0, 5).map((share) => (
                  <ShareRow key={share.key}>
                    <RegistryLogo uri={share.logo} seed={share.key} size={24} />
                    <ListTitle
                      to={share.href}
                      verified={share.verified}
                      title={share.title}
                      sealSize={14}
                    >
                      {share.title}
                    </ListTitle>
                    <Data $muted>{formatInt(share.count)}</Data>
                    <Rail
                      $value={share.count / activities.length}
                      $tone="neutral"
                      role="img"
                      aria-label={`${share.title}: ${share.count} of ${activities.length} listed actions`}
                    />
                  </ShareRow>
                ))}
                {shares.length > 5 && (
                  <Small $faint style={{ display: 'block', marginTop: 12 }}>
                    And {formatInt(shares.length - 5)} more{' '}
                    {shares.length - 5 === 1 ? 'list' : 'lists'}
                  </Small>
                )}
              </RailCard>
            )}
          </RailStack>
        )}
      </Split>
    </section>
  )
}

export default ActivitySection
