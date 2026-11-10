import React, { useLayoutEffect, useRef } from 'react'
import styled, { css } from 'styled-components'
import { Link, useNavigate } from 'react-router-dom'
import type { ListLayout } from 'hooks/use-stored-layout'
import { LAYOUT_OPTIONS } from 'hooks/use-stored-layout'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ButtonLink,
  ChainChip,
  Data,
  Label,
  Rail,
  SegmentedControl,
  SkeletonBlock,
  Small,
  StatusDot,
  Surface,
  Table,
  TableScroller,
  truncateMiddle,
} from 'components/curate/primitives'
import { EntryStatus } from 'components/curate/entry-status'
import { reveal } from 'components/curate/motion/reveal'
import { Pagination } from 'components/ui'
import type { AddressBadge, ProfileActivity } from './data'
import {
  FILTERS,
  PAGE_SIZE,
  activityStatus,
  filterCount,
  formatInt,
  otherParty,
  registryHref,
  registryShares,
  type ActivityFilter,
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

/*
 * The address's actions as YMax-style rows (or the remembered table / cards),
 * filtered by kind through the URL, twenty to a page; beside them its badge
 * progress and the lists its listed actions touch. Rows open the entry; the
 * registry and the other party keep their own links.
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
      <SegmentedControl<ActivityFilter>
        // Counts widen the labels inside a track that may not resize (it
        // scrolls on phones), so the thumb is placed afresh when they change.
        key={
          counts
            ? FILTERS.map((option) => counts[option.value]).join('-')
            : 'loading'
        }
        ariaLabel="Show"
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

/** The list with its rail beside it; the table is too wide for a rail, so it
 * takes the full width and the rail drops below it. */
const Split = styled.div<{ $rail: boolean; $stack: boolean }>`
  display: grid;
  grid-template-columns: ${({ $rail, $stack }) =>
    $rail && !$stack ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)'};
  gap: 20px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
  ${reveal}
`

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
  gap: 4px;
  min-width: 0;

  > [data-title] > a {
    font-size: 15px;
    line-height: 22px;
  }
`

const RowMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
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

const CardItem = styled.li`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 176px;
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

/* ---------- Table ---------- */

const TableName = styled.div`
  min-width: 0;
  max-width: 300px;

  small {
    display: block;
    color: var(--color-faint);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 16px;
  }
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

const RailStack = styled.div<{ $row: boolean }>`
  display: grid;
  grid-template-columns: ${({ $row }) =>
    $row
      ? 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))'
      : 'minmax(0, 1fr)'};
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

const BadgeRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 12px;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid var(--glass-border);

  &:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }

  strong {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
  }

  > :nth-child(3) {
    grid-column: 1 / -1;
  }
`

const BadgeFigure = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 15px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;

  small {
    color: var(--color-faint);
    font-size: 12px;
  }
`

const Earned = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
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
  itemID ? <span title={itemID}>{truncateMiddle(itemID, 8, 6)}</span> : null

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

/** Click anywhere on a table row opens the entry; inner links keep their own target. */
const openUnlessLink = (
  event: React.MouseEvent<HTMLElement>,
  open: () => void,
) => {
  if ((event.target as HTMLElement).closest('a, button')) return
  open()
}

const entryLabel = (activity: ProfileActivity) =>
  activity.itemID
    ? `Open entry ${truncateMiddle(activity.itemID, 8, 6)} in ${activity.registryTitle}`
    : `Open ${activity.registryTitle}`

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
  shown,
  visible,
  filter,
  onFilter,
  page,
  onPage,
  layout,
  onLayout,
  badges,
  badgeScope,
  truncated,
  chainList,
  now,
}: {
  address: string
  loading: boolean
  /** Listed actions in the scope. */
  activities: ProfileActivity[]
  /** Actions the filter shows. */
  shown: ProfileActivity[]
  /** The current page of them. */
  visible: ProfileActivity[]
  filter: ActivityFilter
  onFilter: (value: ActivityFilter) => void
  page: number
  onPage: (page: number) => void
  layout: ListLayout
  onLayout: (layout: ListLayout) => void
  badges?: AddressBadge[]
  /** "All chains" or the chain the badges count. */
  badgeScope: string
  /** True when the list stops at its limit (older actions not listed). */
  truncated: boolean
  /** "Ethereum, Gnosis, Sepolia" for the empty state. */
  chainList: string
  now: number
}) => {
  const navigate = useNavigate()
  const counts = loading
    ? undefined
    : (Object.fromEntries(
        FILTERS.map((option) => [
          option.value,
          filterCount(activities, option.value),
        ]),
      ) as Record<ActivityFilter, number>)
  const shares = registryShares(activities)
  const showRail = !loading && activities.length > 0
  const filterLabel = FILTER_NOUN[filter]
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
      <QuietState
        icon="activity"
        title={
          activities.length === 0
            ? 'No activity indexed'
            : `No ${filterLabel} here`
        }
        action={
          activities.length === 0 ? (
            <ButtonLink to="/browse" $variant="secondary" $size="sm">
              Browse registries
            </ButtonLink>
          ) : (
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              onClick={() => onFilter('all')}
            >
              Show all actions
            </Button>
          )
        }
      >
        {activities.length === 0
          ? `This address has not submitted, removed or challenged an entry on ${chainList}.`
          : 'Its other actions are one filter away.'}
      </QuietState>
    </Surface>
  ) : layout === 'table' ? (
    <TableScroller>
      <Table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Registry</th>
            <th>Entry</th>
            {!oneChain && <th>Chain</th>}
            <th>Other party</th>
            <th className="num">When</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {visible.map((activity) => {
            const party = otherParty(activity, address)
            return (
              <tr
                key={activity.id}
                data-href={activity.href}
                onClick={(event) =>
                  openUnlessLink(event, () => navigate(activity.href))
                }
              >
                <td>
                  <EntryStatus status={activityStatus(activity)} now={now} />
                </td>
                <td>
                  <TableName>
                    <ListTitle
                      to={registryHref(activity)}
                      verified={activity.registryVerified}
                    >
                      {activity.registryTitle}
                    </ListTitle>
                    <small>{truncateMiddle(activity.registryAddress)}</small>
                  </TableName>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {activity.itemID ? (
                    <Data $mono $weight={400} title={activity.itemID}>
                      {truncateMiddle(activity.itemID, 8, 6)}
                    </Data>
                  ) : (
                    <Small $faint>—</Small>
                  )}
                </td>
                {!oneChain && (
                  <td>
                    <ChainChip chainId={activity.chainId} size="sm" />
                  </td>
                )}
                <td>
                  {party ? (
                    <PartyLink to={`/address/${party}`} title={party}>
                      {truncateMiddle(party)}
                    </PartyLink>
                  ) : (
                    <Small $faint>—</Small>
                  )}
                </td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  <When timestamp={activity.timestamp} now={now} />
                </td>
                <td className="num">
                  <Link to={activity.href} aria-label={entryLabel(activity)}>
                    <CurateIcon name="external" size={14} />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </TableScroller>
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
          />
          <CardTop>
            <RegistryLogo uri={activity.registryLogo} size={36} />
            <RowText>
              <ListTitle
                to={registryHref(activity)}
                verified={activity.registryVerified}
              >
                {activity.registryTitle}
              </ListTitle>
              <RowMeta>
                <EntryId itemID={activity.itemID} />
              </RowMeta>
            </RowText>
          </CardTop>
          <EntryStatus status={activityStatus(activity)} now={now} />
          {!oneChain && (
            <div>
              <ChainChip chainId={activity.chainId} size="sm" />
            </div>
          )}
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
          />
          <RegistryLogo uri={activity.registryLogo} data-logo />
          <RowText data-text>
            <ListTitle
              to={registryHref(activity)}
              verified={activity.registryVerified}
            >
              {activity.registryTitle}
            </ListTitle>
            <RowMeta data-meta>
              <EntryId itemID={activity.itemID} />
              {!oneChain && <ChainChip chainId={activity.chainId} size="sm" />}
            </RowMeta>
          </RowText>
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
    <section aria-label="Activity">
      <SectionHead>
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
        <SegmentedControl
          ariaLabel="Layout"
          value={layout}
          onChange={onLayout}
          options={LAYOUT_OPTIONS}
        />
      </SectionHead>

      <Split $rail={showRail} $stack={layout === 'table'}>
        <div style={{ minWidth: 0 }}>
          <Toolbar style={{ ['--i' as string]: 1 }}>
            <FilterTabs value={filter} counts={counts} onChange={onFilter} />
          </Toolbar>
          {/* Keyed so a new filter or page replays the staggered entrance. */}
          <div key={`${filter}-${page}-${layout}`}>{list}</div>
          {!loading && shown.length > 0 && (
            <ListFoot>
              {/* The list is cut by time, so a cut list holds exactly the
                  most recent ones of every kind. */}
              <Small $muted>
                {formatInt((page - 1) * PAGE_SIZE + 1)}–
                {formatInt(Math.min(page * PAGE_SIZE, shown.length))} of{' '}
                {truncated ? 'the ' : ''}
                {formatInt(shown.length)}{' '}
                {truncated ? `most recent ${filterLabel}` : filterLabel}
              </Small>
              {shown.length > PAGE_SIZE && (
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={shown.length}
                  onChange={onPage}
                />
              )}
            </ListFoot>
          )}
        </div>

        {showRail && (
          <RailStack $row={layout === 'table'}>
            {badges && (
              <RailCard
                $padding="compact"
                aria-label="Badges"
                style={{ ['--i' as string]: 2 }}
              >
                <RailHead>
                  <h3>Badges</h3>
                  <Label $tone="faint">{badgeScope}</Label>
                </RailHead>
                {badges.map((badge) => (
                  <BadgeRow key={badge.id}>
                    <div style={{ minWidth: 0 }}>
                      <strong>{badge.label}</strong>
                      <Small $faint style={{ display: 'block' }}>
                        {badge.description}
                      </Small>
                    </div>
                    {/* Progress only while unearned: a capped "100 / 100"
                        would read as a count and contradict the figures. */}
                    {badge.earned ? (
                      <Earned>
                        <StatusDot $tone="registered" aria-hidden />
                        Earned
                      </Earned>
                    ) : (
                      <BadgeFigure
                        aria-label={`${badge.progress} of ${badge.goal}`}
                      >
                        {formatInt(badge.progress)}
                        <small> / {formatInt(badge.goal)}</small>
                      </BadgeFigure>
                    )}
                    <Rail
                      $value={
                        badge.earned
                          ? 1
                          : badge.goal
                            ? badge.progress / badge.goal
                            : 0
                      }
                      $tone={badge.earned ? 'registered' : 'window'}
                      role="img"
                      aria-label={
                        badge.earned
                          ? `${badge.label}: earned`
                          : `${badge.label}: ${badge.progress} of ${badge.goal}`
                      }
                    />
                  </BadgeRow>
                ))}
              </RailCard>
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
                    <RegistryLogo uri={share.logo} size={24} />
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
