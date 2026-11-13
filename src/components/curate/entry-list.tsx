import React from 'react'
import styled, { css } from 'styled-components'
import { Link, useNavigate } from 'react-router-dom'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from 'components/display-selector'
import { parseIpfs } from 'utils/ipfs-parse'
import { isSafeNavigationUrl } from 'utils/url-validation'
import type { ListLayout } from 'hooks/use-stored-layout'
import {
  Button,
  EmptyState,
  Grid,
  Label,
  Small,
  StatusDot,
  Surface,
  Table,
  TableScroller,
} from './primitives'
import { CurateIcon } from './icons'
import { reveal } from './motion/reveal'
import type { V2Field } from './v2'
import { V2FieldDisplay } from './v2'
import { EntryStatus, type EntryStatusView } from './entry-status'
import { VerifiedBadge } from './verified-badge'

/*
 * Entries of a registry in the user's chosen layout: rows (YMax suggestion
 * rows: identity left, status and time left right), a refined table (the
 * identifying column, then the status, so the time left is always in view),
 * or cards with the image field as a cover. Fields render by type through
 * DisplaySelector; the status is a dot, a label, the time left and, while a
 * window runs, a track of that window with now and the deadline on it. Rows
 * and cards are one big link with the field links lifted above it, so
 * nothing nests.
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

const normalizeType = (type?: string) => (type || '').toLowerCase()
const isImage = (field: V2Field) =>
  normalizeType(field.type) === normalizeType(ItemTypes.IMAGE)
const isGtcrAddress = (field: V2Field) =>
  normalizeType(field.type) === normalizeType(ItemTypes.GTCR_ADDRESS)
const isBareAddress = (field: V2Field) =>
  [ItemTypes.ADDRESS, ItemTypes.RICH_ADDRESS]
    .map(normalizeType)
    .includes(normalizeType(field.type))
const isPlainText = (field: V2Field) =>
  [ItemTypes.TEXT, ItemTypes.LONG_TEXT, 'text', 'long text']
    .map(normalizeType)
    .includes(normalizeType(field.type) || 'text')
const hasValue = (field: V2Field) =>
  field.value !== undefined &&
  field.value !== null &&
  String(field.value) !== ''

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
 * name, a contract's tag), which then leads, as in rows and cards. Any other
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

/** A column's name as a heading: the form's "(optional)" hint dropped. */
const columnLabel = (column: V2Field): string =>
  (column.label ?? '').replace(/\s*\(optional\)\s*$/i, '')

const textOf = (field?: V2Field): string | undefined =>
  field && hasValue(field) && typeof field.value !== 'object'
    ? String(field.value)
    : undefined

const Thumb = styled.img<{ $size?: number }>`
  display: block;
  flex: 0 0 auto;
  width: ${({ $size }) => $size ?? 32}px;
  height: ${({ $size }) => $size ?? 32}px;
  border: 1px solid var(--glass-border);
  border-radius: ${({ $size }) => (($size ?? 32) >= 40 ? 12 : 8)}px;
  object-fit: cover;
  background: var(--color-raised);
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

const OutLinkAnchor = styled.a`
  && {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;
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

/** One link stretched over the whole row or card; inner links sit above it. */
const Overlay = styled(Link).attrs({ 'data-overlay': true })`
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

/* ---------- Rows ---------- */

const RowList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const RowItem = styled.li<{ $thumb: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: ${({ $thumb }) =>
    $thumb ? '44px minmax(0, 1fr) auto auto' : 'minmax(0, 1fr) auto auto'};
  align-items: center;
  gap: 16px;
  min-height: 72px;
  padding: 14px 16px 14px ${({ $thumb }) => ($thumb ? '14px' : '20px')};
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition:
    transform var(--motion),
    border-color var(--motion),
    box-shadow var(--motion);
  ${reveal}
  /* The entrance must not hold its last frame, or it pins the transform and
     the hover lift never shows. */
  animation-fill-mode: backwards;
  ${lifted}

  &:hover {
    transform: translateY(-1px);
    border-color: var(--color-border-strong);
    box-shadow:
      inset 0 1px 0 var(--glass-highlight),
      var(--shadow-card-hover);
  }

  &:hover [data-chevron] {
    color: var(--color-text);
    border-color: var(--color-border-strong);
    transform: translateX(2px);
  }

  @media (max-width: 720px) {
    grid-template-columns: ${({ $thumb }) =>
      $thumb ? '44px minmax(0, 1fr)' : 'minmax(0, 1fr)'};
    gap: 12px 14px;
    padding: 14px;

    > [data-side] {
      grid-column: ${({ $thumb }) => ($thumb ? '2' : '1')} / -1;
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
`

const RowTitle = styled.div`
  overflow: hidden;
  color: var(--color-text);
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RowMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px 10px;
  min-width: 0;
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  white-space: nowrap;

  > span {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  > span > * {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  > span + span::before {
    content: '·';
    margin-right: 10px;
    color: var(--color-faint);
  }

  @media (max-width: 720px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;

    /* Stacked, each line is its own 24px tap target. */
    > span {
      max-width: 100%;
      min-height: 24px;
    }

    a {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
    }

    > span + span::before {
      content: none;
    }
  }
`

const RowSide = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;

  @media (max-width: 720px) {
    justify-content: space-between;
  }
`

/* A fixed slot so every row's status and hairline line up. */
const StatusBox = styled.div`
  width: 248px;
  min-width: 0;

  > span {
    width: 100%;
  }

  @media (max-width: 720px) {
    width: auto;
    flex: 1 1 auto;
  }
`

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
    transform var(--motion);

  svg {
    transform: rotate(-90deg);
  }
`

const EntryRows = ({
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
  // The avatar is the entry's own image field, wherever it sits in the schema.
  const listHasImages = entries.some((entry) =>
    entry.fields.some((field) => isImage(field) && hasValue(field)),
  )
  return (
    <RowList>
      {entries.map((entry, index) => {
        const titleField = title ? fieldFor(entry, title) : undefined
        const image = entry.fields.find(
          (field) => isImage(field) && hasValue(field),
        )
        const name = textOf(titleField)
        return (
          <RowItem
            key={entry.id}
            $thumb={listHasImages}
            style={{ ['--i' as string]: Math.min(index, 12) }}
          >
            <Overlay
              to={entry.href}
              aria-label={openLabel(entry, itemName, name)}
            />
            {listHasImages &&
              (image && !entry.hidden ? (
                <Thumb
                  $size={44}
                  src={parseIpfs(String(image.value))}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <ThumbSlot aria-hidden />
              ))}
            {entry.hidden || entry.problem ? (
              <FieldsNotice entry={entry} />
            ) : (
              <RowText>
                <RowTitle>
                  <TitleValue
                    entry={entry}
                    field={titleField}
                    link={outLinkFor(entry, title)}
                  />
                </RowTitle>
                {meta.length > 0 && (
                  <RowMeta>
                    {meta.map((column) => (
                      <span key={column.label} title={column.label}>
                        <FieldValue
                          field={fieldFor(entry, column)}
                          link={outLinkFor(entry, column)}
                        />
                      </span>
                    ))}
                  </RowMeta>
                )}
              </RowText>
            )}
            <RowSide data-side>
              <StatusBox>
                <StatusSlot entry={entry} now={now} />
              </StatusBox>
              {entry.openListTo && (
                <OpenList to={entry.openListTo}>Open list</OpenList>
              )}
            </RowSide>
            <Chevron data-chevron aria-hidden>
              <CurateIcon name="chevron-down" size={14} />
            </Chevron>
          </RowItem>
        )
      })}
    </RowList>
  )
}

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

const EntryTableEl = styled(Table)`
  /* Fixed layout: field columns share the room, so Status always fits. */
  table-layout: fixed;

  thead th {
    overflow: hidden;
    text-overflow: ellipsis;
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
     the status sits at the right beside the open chevron, as in Rows. */
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

  tbody td {
    transition: background var(--motion);
  }

  tbody tr[data-href]:hover td:last-child a {
    color: var(--color-text);
    transform: translateX(2px);
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
    border-radius: var(--radius-pill);
    color: var(--color-faint);
    transition:
      color var(--motion),
      transform var(--motion);
  }

  td.open svg {
    transform: rotate(-90deg);
  }
`

const CellValue = styled.div`
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

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
  // its own, beside the entry's chevron, as rows and cards offer it.
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
    <td key={column.label}>
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
    <TableScroller>
      <EntryTableEl style={{ minWidth }}>
        <thead>
          <tr>
            {lead && (
              <th className={leadClass} title={columnLabel(lead)}>
                {columnLabel(lead)}
              </th>
            )}
            <th className="status">Status</th>
            {others.map((column) => (
              <th key={column.label} title={columnLabel(column)}>
                {columnLabel(column)}
              </th>
            ))}
            {opensLists && <th className="list" aria-label="Open list" />}
            <th className="open" aria-label="Open" />
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
                  if ((event.target as HTMLElement).closest('a, button')) return
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
    </TableScroller>
  )
}

/* ---------- Cards ---------- */

const Card = styled.article`
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-card);
  transition:
    transform var(--motion),
    border-color var(--motion),
    box-shadow var(--motion);
  ${reveal}
  animation-fill-mode: backwards;
  ${lifted}

  &:hover {
    transform: translateY(-2px);
    border-color: var(--color-border-strong);
    box-shadow:
      inset 0 1px 0 var(--glass-highlight),
      var(--shadow-card-hover);
  }

  &:hover [data-cover] img:last-child {
    transform: scale(1.04);
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
`

/* Each label over its value, so the value (often an address) gets the
   card's full width. */
const CardFields = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;

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
  const listHasImages = entries.some((entry) =>
    entry.fields.some((field) => isImage(field) && hasValue(field)),
  )
  return (
    <Grid $min={260}>
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
            {listHasImages &&
              (src && !entry.hidden ? (
                <Cover data-cover>
                  <img src={src} alt="" aria-hidden loading="lazy" />
                  <img src={src} alt={image?.label || ''} loading="lazy" />
                </Cover>
              ) : (
                <CoverEmpty aria-hidden />
              ))}
            <CardBody>
              {entry.hidden || entry.problem ? (
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
                          <dt title={columnLabel(column)}>
                            <Label $tone="faint">{columnLabel(column)}</Label>
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
            <CardFooter>
              <StatusSlot entry={entry} now={now} />
              {entry.openListTo && (
                <OpenList to={entry.openListTo}>Open list</OpenList>
              )}
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
}: {
  layout: ListLayout
  entries: EntryRow[]
  columns: V2Field[]
  now: number
  itemName?: string
  itemNamePlural?: string
  loading?: boolean
  emptyAction?: React.ReactNode
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
          title={`No ${itemNamePlural} match`}
          action={emptyAction}
        >
          Change the filters or search, or be the first to submit.
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
  if (layout === 'rows')
    return (
      <EntryRows
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
