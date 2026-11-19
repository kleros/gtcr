import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import styled, { css } from 'styled-components'
import { inkPlate, PlatedImg } from 'components/curate/logo-ink'
import { Link, useNavigate } from 'react-router-dom'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { displayableValue } from 'utils/display-value'
import DisplaySelector from 'components/display-selector'
import { parseIpfs } from 'utils/ipfs-parse'
import { isSafeNavigationUrl } from 'utils/url-validation'
import { edgeTransition, litEdgeBackground } from 'components/ui/kit-styles'
import {
  Button,
  EmptyState,
  Grid,
  Label,
  Small,
  StatusDot,
  Surface,
  Table,
  VisuallyHidden,
} from './primitives'
import { CurateIcon } from './icons'
import { reveal } from './motion/reveal'
import type { V2Field } from './v2'
import { V2FieldDisplay } from './v2'
import { EntryStatus, type EntryStatusView } from './entry-status'
import type { RegistryLayout } from './registry-shared-layout'
import { VerifiedBadge } from './verified-badge'

/*
 * Entries of a registry in the user's chosen layout: a table on its own
 * glass panel (the identifying column, then the status, so the time left is
 * always in view; its heading row sticks under the app bar while the table
 * fits, and once it is too wide the identifying column pins instead while
 * the rest scrolls sideways), or cards with
 * the image field as a cover and the house lit edge on hover. Fields render
 * by type through DisplaySelector; the status is a dot, a label, the time
 * left and, while a window runs, a track of that window with now and the
 * deadline on it. A card is one big link with the field links lifted above
 * it, so nothing nests.
 */

/** A page elsewhere that a value stands for, opened in a new tab. */
export interface EntryOutLink {
  href: string
  /** The link's own short text, shown after the value ("Seer"). */
  label: string
  /** What it does, for its tooltip and screen readers ("Go to Seer"). */
  title: string
}

export interface EntryRow {
  id: string
  href: string
  fields: V2Field[]
  status?: EntryStatusView
  /** For lists of lists: the registry this entry points to. */
  openListTo?: string
  /**
   * On the Kleros list of lists: the registry this entry points to is
   * Kleros Verified, so its name carries the seal.
   */
  verified?: boolean
  /** Potentially offensive content hidden behind a reveal. */
  hidden?: boolean
  onReveal?: () => void
  /**
   * Pages elsewhere that a value stands for, by column label (a Seer market
   * beside its name). Set by the page, never taken from list data, and
   * shown only for https links.
   */
  outLinks?: Record<string, EntryOutLink>
  /**
   * Why the entry's fields could not be read (its data did not decode with
   * the list's columns): said in place of the fields, which would only be
   * dashes. The entry still opens, and its page says the same.
   */
  problem?: string
}

// A column type or a value from an entry's file may be anything: neither is
// passed to String() unless it is text, a number or a boolean.
const normalizeType = (type?: unknown) =>
  typeof type === 'string' ? type.toLowerCase() : ''
const isImage = (field: V2Field) =>
  normalizeType(field.type) === normalizeType(ItemTypes.IMAGE)
const isGtcrAddress = (field: V2Field) =>
  normalizeType(field.type) === normalizeType(ItemTypes.GTCR_ADDRESS)
const isBareAddress = (field: V2Field) =>
  [ItemTypes.ADDRESS, ItemTypes.RICH_ADDRESS]
    .map(normalizeType)
    .includes(normalizeType(field.type))
const isNumber = (field: V2Field) =>
  normalizeType(field.type) === normalizeType(ItemTypes.NUMBER)
const isPlainText = (field: V2Field) =>
  [ItemTypes.TEXT, ItemTypes.LONG_TEXT, 'text', 'long text']
    .map(normalizeType)
    .includes(normalizeType(field.type) || 'text')
const hasValue = (field: V2Field) => {
  const value = displayableValue(field.value)
  return value !== undefined && value !== null && String(value) !== ''
}

/**
 * The columns an entry shows in a list: the list's identifiers, at most 4.
 * Images take none of those places, as every layout shows the entry's image
 * on its own (the table's thumbnail, the row's avatar, the card's cover). A
 * list whose only identifiers are images shows those, and one with neither
 * identifiers nor images its first columns.
 */
export const tableColumns = (fields: V2Field[]): V2Field[] => {
  const identifiers = fields.filter((field) => field.isIdentifier)
  const named = identifiers.filter((field) => !isImage(field))
  if (named.length > 0) return named.slice(0, 4)
  const images = [
    ...identifiers,
    ...fields.filter((field) => isImage(field) && !field.isIdentifier),
  ]
  return (images.length > 0 ? images : fields).slice(0, 4)
}

/** The entry's own value for a column, falling back to the column itself. */
const fieldFor = (entry: EntryRow, column: V2Field) =>
  entry.fields.find((f) => f.label === column.label) ?? column

/** The page's link for a column's value, if it is a safe (https) one. */
const outLinkFor = (
  entry: EntryRow,
  column?: V2Field,
): EntryOutLink | undefined => {
  const link = column?.label ? entry.outLinks?.[column.label] : undefined
  return link && isSafeNavigationUrl(link.href) ? link : undefined
}

/** The overlay link's name; a hidden entry never gives its content away. */
const openLabel = (entry: EntryRow, itemName: string, name?: string) =>
  entry.hidden
    ? `Open hidden ${itemName}`
    : name
      ? `Open ${itemName}: ${name}`
      : `Open ${itemName}`

/**
 * The row/card title: the first plain-text column (a name reads better than
 * an address), else the first column that is not an image.
 */
const splitColumns = (columns: V2Field[]) => {
  const textual = columns.filter((column) => !isImage(column))
  const title = textual.find(isPlainText) ?? textual[0]
  return { title, meta: textual.filter((column) => column !== title) }
}

/**
 * The table's first column: the list's own first one, unless that is a bare
 * address and one of the list's text identifiers names the entry (a token's
 * name, a contract's tag), which then leads, as in the cards. Any other
 * first column (a link, a number, a list) stays, as a text column after it
 * may hold a hash or a key, and so do columns a page adds (a Seer market's
 * question, a Stake entry's stake).
 */
const leadColumn = (columns: V2Field[]): V2Field | undefined => {
  const [first] = columns
  if (!first || !isBareAddress(first)) return first
  return (
    columns.find((column) => column.isIdentifier && isPlainText(column)) ??
    first
  )
}

const OPTIONAL_HINT = '(optional)'

/**
 * A column's name as a heading: the form's "(optional)" hint dropped. The
 * label comes from the list's own file (or, on a Stake list, from an entry
 * standing in for it), so anything but text reads as none, and it is cut
 * without a regex: a pattern with \s* around the hint backtracks
 * quadratically over a long run of spaces and froze the page.
 */
const columnLabel = (column: V2Field): string => {
  const label = typeof column.label === 'string' ? column.label : ''
  const trimmed = label.trimEnd()
  return trimmed.slice(-OPTIONAL_HINT.length).toLowerCase() === OPTIONAL_HINT
    ? trimmed.slice(0, -OPTIONAL_HINT.length).trimEnd()
    : label
}

/** Each column's heading, worked out once per set of columns, not per tick. */
const useColumnLabels = (columns: V2Field[]) => {
  const labels = useMemo(
    () => new Map(columns.map((column) => [column, columnLabel(column)])),
    [columns],
  )
  return (column: V2Field) => labels.get(column) ?? columnLabel(column)
}

const textOf = (field?: V2Field): string | undefined =>
  field && hasValue(field) && typeof field.value !== 'object'
    ? String(field.value)
    : undefined

/* Values sit in boxes that clip their overflow (for the ellipsis), so a
   link's focus ring is drawn inside it, as Segment and NavLink draw theirs. */
const insetFocus = css`
  a:focus-visible {
    outline-offset: -2px;
  }
`

/* An entry's picture on its own tile; a plate when its ink is lost. */
const Thumb = styled(PlatedImg)<{ $size?: number }>`
  display: block;
  flex: 0 0 auto;
  width: ${({ $size }) => $size ?? 32}px;
  height: ${({ $size }) => $size ?? 32}px;
  border: 1px solid var(--glass-border);
  border-radius: ${({ $size }) => (($size ?? 32) >= 40 ? 12 : 8)}px;
  object-fit: cover;
  background: var(--color-raised);
  ${inkPlate}
`

const ThumbSlot = styled.span<{ $size?: number }>`
  display: block;
  flex: 0 0 auto;
  width: ${({ $size }) => $size ?? 44}px;
  height: ${({ $size }) => $size ?? 44}px;
  border: 1px solid var(--glass-border);
  border-radius: ${({ $size }) => (($size ?? 44) >= 40 ? 12 : 8)}px;
  background: var(--color-surface);
`

const TypedValue = ({ field }: { field: V2Field }) => {
  if (isImage(field))
    return (
      <Thumb src={parseIpfs(String(field.value))} alt={field.label || ''} />
    )
  if (isGtcrAddress(field))
    return <V2FieldDisplay field={field} showStakeBadge={false} />
  return (
    <DisplaySelector
      type={field.type || ItemTypes.TEXT}
      value={field.value as string}
      allowedFileTypes={field.allowedFileTypes as string}
      truncateLinks
      linkImage
    />
  )
}

/* A value with its page elsewhere beside it: the value gives way first, so
   the link stays whole in a narrow cell. */
const WithOutLink = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;

  > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

/* At least 24px tall: a target of its own beside the value it stands for. */
const OutLinkAnchor = styled.a`
  && {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;
    min-height: 24px;
    color: var(--color-primary);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
    white-space: nowrap;
    text-decoration: none;
  }

  &&:hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }
`

const FieldValue = ({
  field,
  link,
}: {
  field: V2Field
  link?: EntryOutLink
}) => {
  if (!hasValue(field)) return <Small $faint>—</Small>
  if (!link) return <TypedValue field={field} />
  const name = textOf(field)
  return (
    <WithOutLink>
      <span>
        <TypedValue field={field} />
      </span>
      <OutLinkAnchor
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        title={link.title}
        aria-label={name ? `${link.title}: ${name}` : link.title}
      >
        {link.label}
        <CurateIcon name="external" size={12} />
      </OutLinkAnchor>
    </WithOutLink>
  )
}

/* A Kleros Verified entry's name, then the seal on its first line (a list's
   name sits over its address); the name is the part that truncates. */
const Sealed = styled.span`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;

  > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

/* As tall as the name's first line, with the seal centred in it. */
const SealLine = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 1lh;
`

const TitleValue = ({
  entry,
  field,
  link,
}: {
  entry: EntryRow
  field?: V2Field
  link?: EntryOutLink
}) => {
  const value = field ? <FieldValue field={field} link={link} /> : '—'
  return entry.verified ? (
    <Sealed>
      <span>{value}</span>
      <SealLine>
        <VerifiedBadge size={16} />
      </SealLine>
    </Sealed>
  ) : (
    <>{value}</>
  )
}

const Hidden = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const HiddenNotice = ({ entry }: { entry: EntryRow }) => (
  <Hidden data-hidden-notice>
    <span>Hidden: potentially offensive content.</span>
    {entry.onReveal && (
      <Button
        type="button"
        $variant="secondary"
        $size="sm"
        onClick={entry.onReveal}
      >
        Show entry
      </Button>
    )}
  </Hidden>
)

/* Nothing in it can be clicked, so it stays under the row's own link. */
const Problem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const ProblemNotice = ({ problem }: { problem: string }) => (
  <Problem data-problem-notice>
    <StatusDot $tone="contested" aria-hidden />
    <span title={problem}>{problem}</span>
  </Problem>
)

/** What stands in for an entry's fields: the reveal, or why they are missing. */
const FieldsNotice = ({ entry }: { entry: EntryRow }) =>
  entry.hidden ? (
    <HiddenNotice entry={entry} />
  ) : entry.problem ? (
    <ProblemNotice problem={entry.problem} />
  ) : null

/**
 * One link stretched over the whole row or card; inner links sit above it.
 * Its focus ring is drawn inside the edge: a card clips what lies outside.
 */
const Overlay = styled(Link).attrs({ 'data-overlay': true })`
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
`

const lifted = css`
  a:not([data-overlay]),
  button {
    position: relative;
    z-index: 2;
  }
`

const StatusSlot = ({ entry, now }: { entry: EntryRow; now: number }) =>
  entry.status ? (
    <EntryStatus status={entry.status} now={now} />
  ) : (
    <Small $faint>Loading status</Small>
  )

const OpenList = styled(Link)`
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  white-space: nowrap;
  text-decoration: none;
  transition: border-color var(--motion);

  &:hover {
    border-color: var(--color-border-strong);
  }
`

/*
 * The hover neon on a row or a card's open control: the accent, the colour
 * every link and focus ring already carries, rather than a hue of its own.
 * The owner liked the neon and asked for it in a colour the page already
 * uses (round 3); the lit edge round a hovered card keeps the house's edge
 * hues, because that edge is the control idiom every action shares.
 */
const neonGlow = css`
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
  box-shadow: 0 0 14px -3px
    color-mix(in srgb, var(--color-primary) 70%, transparent);
`

/* The open affordance a card carries in its footer: it slides and lights
   when the card does. */
const Chevron = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  color: var(--color-faint);
  transition:
    color var(--motion),
    border-color var(--motion),
    box-shadow var(--motion),
    transform var(--motion);

  svg {
    transform: rotate(-90deg);
  }
`

/* ---------- Table ---------- */

/* Column widths: the identifying column keeps room for a chain label and a
   middle-truncated address, the status keeps its countdown, the rest share. */
const LEAD_WIDTH = 260
const LEAD_IMAGE_WIDTH = 88
/** The entry's 32px image and its 10px gap, beside the identifying value. */
const THUMB_ROOM = 42
const STATUS_WIDTH = 272
const FIELD_WIDTH = 170
const LIST_WIDTH = 124
const OPEN_WIDTH = 52

/* The table's own panel: the surface, the hairline, the 1px top highlight
   and the card shadow every other surface on the page carries. */
const TableShell = styled.div`
  position: relative;
  width: 100%;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-card);
`

const TableBox = styled.div`
  width: 100%;
  border-radius: inherit;
  overflow-x: auto;
  overscroll-behavior-x: contain;

  /* A table that fits must not be a scrollport, or its heading row cannot
     stick against the page: overflow-x auto makes overflow-y compute to
     auto, and this box never scrolls down. The consequence is deliberate
     and not a bug to "fix": a table too wide for its column keeps the
     scroller, so its heading travels with the table rather than parking
     under the app bar, and the pinned identifying column is what carries
     the reader instead. Both behaviours at once would mean a second
     heading element outside the scroller, mirroring every column width. */
  &[data-fits] {
    overflow-x: visible;
  }
`

/**
 * Whether the table fits its column, and whether it has been scrolled
 * sideways. While it fits, the heading row sticks under the app bar; once it
 * does not, the identifying column pins instead and lights its edge as soon
 * as something has scrolled under it.
 */
const useTableFit = (minWidth: number) => {
  const box = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  useLayoutEffect(() => {
    const node = box.current
    if (!node) return undefined
    const measure = () => setFits(node.clientWidth >= minWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [minWidth])
  // One rAF-coalesced listener: hundreds of rows must not pay for a scroll.
  useEffect(() => {
    const node = box.current
    if (!node) return undefined
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setScrolled(node.scrollLeft > 0)
      })
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      node.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return { box, fits, scrolled }
}

const EntryTableEl = styled(Table)`
  /* Fixed layout: field columns share the room, so Status always fits. */
  table-layout: fixed;

  /* Doubled, so they beat the table primitive's own declarations: sticky
     cells need separated borders, and separating them is what carries the
     heading's hairline with it as the rows pass under. */
  && {
    border-collapse: separate;
    border-spacing: 0;
  }

  && thead th {
    /* On glass the rows cannot show through: the raised tint and a top
       sheen over the panel's own surface. Parking it under the app bar is
       the next rule's job, since only one of the two scrollports can
       carry it. */
    z-index: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--glass-highlight) 40%, transparent),
        transparent 70%
      ),
      linear-gradient(var(--color-raised), var(--color-raised)),
      var(--color-surface);
  }

  /*
   * The heading parks under the app bar only where the table fits, and the
   * page is what scrolls. Inside the sideways scroller the box is the
   * nearest scrollport and never scrolls down, so the same offset would
   * push the heading down over the first rows instead of pinning it: there
   * it keeps the primitive's own top of 0 and travels with the table.
   */
  [data-fits] > && thead th {
    top: var(--app-bar-height);
  }

  /* The panel's corners stay round: no cell paints over them. */
  thead th:first-child {
    border-top-left-radius: var(--radius-lg);
  }

  thead th:last-child {
    border-top-right-radius: var(--radius-lg);
  }

  tbody tr:last-child td:first-child {
    border-bottom-left-radius: var(--radius-lg);
  }

  tbody tr:last-child td:last-child {
    border-bottom-right-radius: var(--radius-lg);
  }

  tbody td {
    overflow: hidden;
  }

  th.lead {
    width: ${LEAD_WIDTH}px;
  }

  th.lead.image {
    width: ${LEAD_IMAGE_WIDTH}px;
  }

  th.lead.thumbs {
    width: ${LEAD_WIDTH + THUMB_ROOM}px;
  }

  /* One identifying column and nothing else: it takes the spare room, so
     the status sits at the right beside the open chevron. */
  @media (min-width: 721px) {
    th.lead.solo {
      width: auto;
    }
  }

  /* Phones: a narrower identifying column (the chain label gives way first,
     then the name beside an image) so the status and its countdown start
     inside the screen. */
  @media (max-width: 720px) {
    th.lead:not(.image) {
      width: 184px;
    }
  }

  th.status {
    width: ${STATUS_WIDTH}px;
  }

  td.status > span {
    width: 100%;
  }

  /* A hidden entry's notice reads on one line: text, then the button. */
  td [data-hidden-notice] {
    flex-wrap: nowrap;
    justify-content: flex-start;
    white-space: nowrap;
  }

  td [data-hidden-notice] > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  th.list {
    width: ${LIST_WIDTH}px;
  }

  td.list {
    text-align: right;
  }

  th.open {
    width: ${OPEN_WIDTH}px;
  }

  tbody tr {
    ${reveal}
  }

  tbody td:first-child {
    font-weight: 500;
  }

  /* Amounts and counts line up down their column. */
  tbody td {
    font-variant-numeric: tabular-nums;
    transition:
      background var(--motion),
      box-shadow var(--motion);
  }

  /* Hover lights the row's leading edge in the accent, and the open
     chevron at its other end with it; the raised tint behind the row comes
     from the table itself. */
  tbody tr[data-href]:hover td:first-child {
    box-shadow:
      inset 2px 0 0 var(--color-primary),
      inset 14px 0 20px -16px var(--color-primary);
  }

  tbody tr[data-href]:hover td:last-child a {
    ${neonGlow}
    transform: translateX(2px);
  }

  /* Sideways: the identifying column stays put over the panel's surface, so
     the columns passing under it never show through, and draws its edge
     once something has. */
  @media (min-width: 721px) {
    &[data-pinned] thead th:first-child,
    &[data-pinned] tbody td:first-child {
      position: sticky;
      left: 0;
      border-right: 1px solid transparent;
    }

    &[data-pinned] tbody td:first-child {
      z-index: 1;
      background: var(--color-surface);
    }

    &[data-pinned] thead th:first-child {
      z-index: 3;
    }

    &[data-pinned] tbody tr[data-href]:hover td:first-child {
      background:
        linear-gradient(var(--color-raised), var(--color-raised)),
        var(--color-surface);
    }

    &[data-pinned][data-scrolled] thead th:first-child,
    &[data-pinned][data-scrolled] tbody td:first-child {
      border-right-color: var(--glass-border);
    }
  }

  td.open {
    width: 48px;
    text-align: right;
  }

  td.open a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    color: var(--color-faint);
    transition:
      color var(--motion),
      border-color var(--motion),
      box-shadow var(--motion),
      transform var(--motion);
  }

  td.open svg {
    transform: rotate(-90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    tbody td {
      transition: none;
    }

    tbody tr[data-href]:hover td:last-child a {
      transform: none;
    }
  }
`

const CellValue = styled.div`
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  ${insetFocus}

  a {
    color: var(--color-primary);
  }
`

/* The entry's image, then its identifying value, which is what truncates. */
const WithThumb = styled.div`
  display: flex;
  align-items: center;
  gap: ${THUMB_ROOM - 32}px;
  min-width: 0;

  > :last-child {
    flex: 1 1 auto;
    min-width: 0;
  }
`

const EntryTable = ({
  entries,
  columns,
  now,
  itemName,
}: {
  entries: EntryRow[]
  columns: V2Field[]
  now: number
  itemName: string
}) => {
  const navigate = useNavigate()
  const labelOf = useColumnLabels(columns)

  // Each row's open link carries its entry's name, so a links list tells
  // the rows apart (a hidden entry stays generic).
  const { title } = splitColumns(columns)
  // The identifying column first, then the status, then the other fields.
  const lead = leadColumn(columns)
  const leadIsImage = !!lead && isImage(lead)
  // The entry's image sits beside the identifying value, as the rows' avatar
  // does, unless the image is that value.
  const thumbs =
    !!lead &&
    !leadIsImage &&
    entries.some((entry) =>
      entry.fields.some((field) => isImage(field) && hasValue(field)),
    )
  const others = columns.filter(
    (column) => column !== lead && !(thumbs && isImage(column)),
  )
  // Lists of lists open the registry each entry points to from a column of
  // its own, beside the entry's chevron, as the cards offer it.
  const opensLists = entries.some((entry) => !!entry.openListTo)
  const minWidth =
    (lead
      ? leadIsImage
        ? LEAD_IMAGE_WIDTH
        : LEAD_WIDTH + (thumbs ? THUMB_ROOM : 0)
      : 0) +
    STATUS_WIDTH +
    others.length * FIELD_WIDTH +
    (opensLists ? LIST_WIDTH : 0) +
    OPEN_WIDTH
  const { box, fits, scrolled } = useTableFit(minWidth)
  // A hidden or unreadable entry's notice goes in the field cells it blanks
  // out; only a list with no other field puts it in the identifying cell.
  const noticeInLead = !!lead && others.length === 0
  const leadClass = [
    'lead',
    leadIsImage ? 'image' : '',
    thumbs ? 'thumbs' : '',
    others.length === 0 ? 'solo' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const cell = (entry: EntryRow, column: V2Field) => (
    <td key={column.label} className={isNumber(column) ? 'num' : undefined}>
      <CellValue>
        <FieldValue
          field={fieldFor(entry, column)}
          link={outLinkFor(entry, column)}
        />
      </CellValue>
    </td>
  )
  // The identifying cell carries a Kleros Verified entry's seal, and the
  // entry's image when the list has images (never a hidden entry's).
  const leadCell = (entry: EntryRow, blank: boolean) => {
    if (!lead) return null
    const value = blank ? (
      noticeInLead ? (
        <FieldsNotice entry={entry} />
      ) : (
        <Small $faint aria-hidden>
          —
        </Small>
      )
    ) : (
      <CellValue>
        <TitleValue
          entry={entry}
          field={fieldFor(entry, lead)}
          link={outLinkFor(entry, lead)}
        />
      </CellValue>
    )
    if (!thumbs) return <td>{value}</td>
    const image = entry.hidden
      ? undefined
      : entry.fields.find((field) => isImage(field) && hasValue(field))
    return (
      <td>
        <WithThumb>
          {image ? (
            <Thumb src={parseIpfs(String(image.value))} alt="" loading="lazy" />
          ) : (
            <ThumbSlot $size={32} aria-hidden />
          )}
          {value}
        </WithThumb>
      </td>
    )
  }
  return (
    <TableShell>
      <TableBox ref={box} data-fits={fits ? '' : undefined}>
        <EntryTableEl
          style={{ minWidth }}
          data-pinned={fits ? undefined : ''}
          data-scrolled={scrolled ? '' : undefined}
        >
          <thead>
            <tr>
              {lead && (
                <th className={leadClass} title={labelOf(lead)}>
                  {labelOf(lead)}
                </th>
              )}
              <th className="status">Status</th>
              {others.map((column) => (
                <th
                  key={column.label}
                  className={isNumber(column) ? 'num' : undefined}
                  title={labelOf(column)}
                >
                  {labelOf(column)}
                </th>
              ))}
              {/* Headed for screen readers only: the cells hold links. */}
              {opensLists && (
                <th className="list">
                  <VisuallyHidden>Open list</VisuallyHidden>
                </th>
              )}
              <th className="open">
                <VisuallyHidden>Open</VisuallyHidden>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const name = title ? textOf(fieldFor(entry, title)) : undefined
              const blank = entry.hidden || !!entry.problem
              return (
                <tr
                  key={entry.id}
                  data-href={entry.href}
                  style={{ ['--i' as string]: Math.min(index, 12) }}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('a, button'))
                      return
                    navigate(entry.href)
                  }}
                >
                  {leadCell(entry, blank)}
                  <td className="status">
                    <StatusSlot entry={entry} now={now} />
                  </td>
                  {blank
                    ? others.length > 0 && (
                        <td colSpan={others.length}>
                          {!noticeInLead && <FieldsNotice entry={entry} />}
                        </td>
                      )
                    : others.map((column) => cell(entry, column))}
                  {opensLists && (
                    <td className="list">
                      {entry.openListTo && (
                        <OpenList to={entry.openListTo}>Open list</OpenList>
                      )}
                    </td>
                  )}
                  <td className="open">
                    <Link
                      to={entry.href}
                      aria-label={openLabel(entry, itemName, name)}
                    >
                      <CurateIcon name="chevron-down" size={14} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </EntryTableEl>
      </TableBox>
    </TableShell>
  )
}

/* ---------- Cards ---------- */

const Card = styled.article`
  /* Declared here, so the edge survives a browser without @property. */
  --edge-angle: 210deg;
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  /* The hairline is drawn in the border box, so hover can swap it for the
     app's lit edge without the card moving. */
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(var(--color-surface), var(--color-surface)) padding-box,
    linear-gradient(var(--glass-border), var(--glass-border)) border-box;
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-card);
  transition:
    transform var(--motion),
    box-shadow var(--motion),
    ${edgeTransition};
  ${reveal}
  animation-fill-mode: backwards;
  ${lifted}

  /* Hover and keyboard focus: the lit edge sweeps round, as it does on the
     primary action, and the card lifts. */
  &:hover,
  &:focus-within {
    --edge-angle: 570deg;
    transform: translateY(-2px);
    background: ${litEdgeBackground(
      'linear-gradient(var(--color-surface), var(--color-surface))',
    )};
    box-shadow:
      inset 0 1px 0 var(--glass-highlight),
      var(--shadow-card-hover);
  }

  &:hover [data-cover] img:last-child,
  &:focus-within [data-cover] img:last-child {
    transform: scale(1.04);
  }

  &:hover [data-chevron],
  &:focus-within [data-chevron] {
    ${neonGlow}
    transform: translateX(2px);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover,
    &:focus-within {
      transform: none;
    }

    &:hover [data-cover] img:last-child,
    &:focus-within [data-cover] img:last-child,
    &:hover [data-chevron],
    &:focus-within [data-chevron] {
      transform: none;
    }
  }
`

/* The image field as a cover: a blurred wash of the image, the image whole on top. */
const Cover = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 156px;
  overflow: hidden;
  border-bottom: 1px solid var(--glass-border);
  background: var(--color-raised);

  img:first-child {
    position: absolute;
    inset: -20%;
    width: 140%;
    height: 140%;
    object-fit: cover;
    filter: blur(28px) saturate(1.4);
    opacity: 0.5;
  }

  img:last-child {
    position: relative;
    max-width: 72%;
    max-height: 112px;
    object-fit: contain;
    border-radius: 12px;
    transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
  }
`

const CoverEmpty = styled.div`
  height: 156px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--color-raised);
`

/* A hidden entry's card: the cover's wash runs down to the footer with the
   notice and its reveal centred in it, so the card reads as veiled rather
   than as an empty band over an empty body. */
const Veil = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  min-height: 156px;
  padding: 24px 18px;
  background: var(--color-raised);

  [data-hidden-notice] {
    flex-direction: column;
    justify-content: center;
    gap: 14px;
    text-align: center;
  }
`

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1 1 auto;
  min-width: 0;
  padding: 18px 18px 0;
`

const CardTitle = styled.div`
  overflow: hidden;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 19px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
  ${insetFocus}
`

/* Each label over its value, so the value (often an address) gets the
   card's full width. */
const CardFields = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  ${insetFocus}

  > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  dt {
    display: flex;
    min-width: 0;
  }

  dt > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 16px;
  padding: 14px 18px 16px;
  border-top: 1px solid var(--glass-border);

  /* Straight under the veil, whose wash ends at the footer's hairline. */
  ${Veil} + & {
    margin-top: 0;
  }

  /* The status gives way first: the way out stays whole. */
  > :first-child {
    min-width: 0;
  }
`

const CardWays = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
`

const EntryCards = ({
  entries,
  columns,
  now,
  itemName,
}: {
  entries: EntryRow[]
  columns: V2Field[]
  now: number
  itemName: string
}) => {
  const { title, meta } = splitColumns(columns)
  const labelOf = useColumnLabels(columns)
  const listHasImages = entries.some((entry) =>
    entry.fields.some((field) => isImage(field) && hasValue(field)),
  )
  // Four cards across at 1440 and 1280, as on the base: 4 x 272 + 3 x 16 =
  // 1136 fits the 1168px column at 1280 with room for a classic scrollbar
  // (about 17px). A list with pictures asks 12px more, so just under those
  // widths its covers keep three wider cards to a row.
  return (
    <Grid $min={listHasImages ? 272 : 260}>
      {entries.map((entry, index) => {
        const image = entry.fields.find(
          (field) => isImage(field) && hasValue(field),
        )
        const titleField = title ? fieldFor(entry, title) : undefined
        const name = textOf(titleField)
        const src = image ? parseIpfs(String(image.value)) : undefined
        return (
          <Card
            key={entry.id}
            style={{ ['--i' as string]: Math.min(index, 12) }}
          >
            <Overlay
              to={entry.href}
              aria-label={openLabel(entry, itemName, name)}
            />
            {entry.hidden ? (
              <Veil>
                <HiddenNotice entry={entry} />
              </Veil>
            ) : (
              listHasImages &&
              (src ? (
                <Cover data-cover>
                  <img src={src} alt="" aria-hidden loading="lazy" />
                  <img src={src} alt={image?.label || ''} loading="lazy" />
                </Cover>
              ) : (
                <CoverEmpty aria-hidden />
              ))
            )}
            {!entry.hidden && (
              <CardBody>
                {entry.problem ? (
                  <FieldsNotice entry={entry} />
                ) : (
                  <>
                    <CardTitle>
                      <TitleValue
                        entry={entry}
                        field={titleField}
                        link={outLinkFor(entry, title)}
                      />
                    </CardTitle>
                    {meta.length > 0 && (
                      <CardFields>
                        {meta.slice(0, 3).map((column) => (
                          <div key={column.label}>
                            <dt title={labelOf(column)}>
                              <Label $tone="faint">{labelOf(column)}</Label>
                            </dt>
                            <dd>
                              <FieldValue
                                field={fieldFor(entry, column)}
                                link={outLinkFor(entry, column)}
                              />
                            </dd>
                          </div>
                        ))}
                      </CardFields>
                    )}
                  </>
                )}
              </CardBody>
            )}
            <CardFooter>
              <StatusSlot entry={entry} now={now} />
              <CardWays>
                {entry.openListTo && (
                  <OpenList to={entry.openListTo}>Open list</OpenList>
                )}
                <Chevron data-chevron aria-hidden>
                  <CurateIcon name="chevron-down" size={14} />
                </Chevron>
              </CardWays>
            </CardFooter>
          </Card>
        )
      })}
    </Grid>
  )
}

/* ---------- Switch ---------- */

const LoadingNote = styled(Surface)`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

export const EntryList = ({
  layout,
  entries,
  columns,
  now,
  itemName = 'entry',
  itemNamePlural = 'entries',
  loading,
  emptyAction,
  emptyTitle,
  emptyLine = 'Change the filters or search, or be the first to submit.',
}: {
  layout: RegistryLayout
  entries: EntryRow[]
  columns: V2Field[]
  now: number
  itemName?: string
  itemNamePlural?: string
  loading?: boolean
  emptyAction?: React.ReactNode
  /** The empty state's title; by default it says that nothing matches. */
  emptyTitle?: string
  /** The line under it; the page says why the list is empty. */
  emptyLine?: string
}) => {
  if (loading && entries.length === 0)
    return (
      <LoadingNote $padding="compact" role="status">
        Loading {itemNamePlural}…
      </LoadingNote>
    )
  if (entries.length === 0)
    return (
      <Surface $padding="none">
        <EmptyState
          icon="list"
          titleAs="h2"
          title={emptyTitle ?? `No ${itemNamePlural} match`}
          action={emptyAction}
        >
          {emptyLine}
        </EmptyState>
      </Surface>
    )
  if (layout === 'cards')
    return (
      <EntryCards
        entries={entries}
        columns={columns}
        now={now}
        itemName={itemName}
      />
    )
  return (
    <EntryTable
      entries={entries}
      columns={columns}
      now={now}
      itemName={itemName}
    />
  )
}

export default EntryList
