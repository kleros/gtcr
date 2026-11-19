import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useAttachment } from 'hooks/use-attachment'
import { parseIpfs } from 'utils/ipfs-parse'
import { CurateIcon } from './icons'
import {
  Body,
  Button,
  ButtonLink,
  Data,
  IconButton,
  Row,
  SkeletonBlock,
  Small,
  Label,
  truncateMiddle,
} from './primitives'
import {
  EntryFields,
  isGtcrAddressField,
  type EntryField,
} from './item-standard-fields'
import { Notice } from './item-standard-notice'
import { ImagePlate, ItemMediaBand, entryMedia } from './item-media-band'
import { ItemRewardWithdrawal } from './item-reward-withdrawal'

/*
 * The entry's full details, all of it, in one place (the design review's
 * point 3: the fields used to be split between a page-long header of
 * identifiers and a separate "Details" box, and the cut between them
 * depended on the field's type, so the same list's fields landed in
 * different boxes).
 *
 * Round 4 folds it into the entry page's hero, under the facts strip, so
 * the entry and what it says are one box. It is therefore a region and not
 * a panel: an inset hairline and space, exactly like the facts strip above
 * it, because a panel inside a panel is a stack (DESIGN.md).
 *
 * Bands, in reading order: the entry's files (and its pictures, when it has
 * more than one, which need the whole measure), then what only the linked
 * list of a list-of-lists entry can say about itself, then every field —
 * identifiers included — beside the entry's one picture, then what this
 * account can claim from the entry's appeals. Nothing is reserved for a
 * field the entry does not have.
 *
 * The region is field-complete, so what the hero lifts out is here as well
 * (round 3: a box named "Full details" that was missing the two things the
 * page leads with). The picture is drawn once, here, on a captioned plate
 * under the hero's clock; the title reads here as a labelled row under its
 * own column name, which is what the hero's display line cannot say.
 */

/* A region of the hero, not a box of its own: one inset hairline, the same
   the facts strip above it draws, and space between the bands. */
const Region = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);
`

/* The fields keep a reading measure instead of stretching the hero's whole
   width, and the entry's one picture sits in the right-hand track, under
   the clock above it. The track is declared whether or not there is a
   picture, so the field measure never changes and an entry without one
   shows no hole. */
const FieldsRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 880px) 248px;
  gap: 24px 32px;
  align-items: start;

  @media (max-width: 1000px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const FieldsCell = styled.div`
  grid-column: 1;
  min-width: 0;
`

/* Explicitly placed, so the picture holds the right-hand track even when
   the entry has no rows to put beside it. Stacked, it leads the fields
   rather than following a few hundred pixels of them. */
const Picture = styled.div`
  grid-column: 2;
  min-width: 0;

  @media (max-width: 1000px) {
    grid-column: 1;
    order: -1;
  }
`

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
`

/* The region's name is a label, not a display line: inside the hero a
   second 22px heading is what made this read as a second box. */
const RegionName = styled(Label)`
  margin: 0;
`

/*
 * What the hero's title cannot say about the list a list-of-lists entry
 * points to: the list's own description, and the two ways into it. The
 * logo, the name and the address are not drawn again here — the title
 * above sets all three at display size, and since round 4 folded this
 * region into the same box they would read as a stutter 120px apart.
 *
 * A divider under it only when fields follow; when only the claim does,
 * its own top border is the one line.
 */
const RegistryBlock = styled.div<{ $divided: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  ${({ $divided }) =>
    $divided &&
    `
    padding-bottom: 16px;
    border-bottom: 1px solid var(--glass-border);
  `}
`

const CopyId = ({ id }: { id: string }) => {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])
  return (
    <Row $gap={4} title={id}>
      <Small $muted>ID</Small>
      <Data $mono $muted>
        {truncateMiddle(id, 8, 6)}
      </Data>
      <IconButton
        type="button"
        aria-label="Copy item ID"
        onClick={() => {
          navigator.clipboard
            ?.writeText(id)
            .then(() => setCopied(true))
            .catch(() => setCopied(false))
        }}
      >
        <CurateIcon name={copied ? 'check' : 'copy'} size={14} />
      </IconButton>
      {copied && (
        <Small $muted role="status">
          Copied
        </Small>
      )}
    </Row>
  )
}

/** What the item pages resolve for a linked registry's meta evidence. */
export interface LinkedRegistryState {
  file?: MetaEvidence
  error?: unknown
}

export const ItemSubmissionPanel = ({
  fields,
  item,
  itemID,
  errors = [],
  retry,
  loading = false,
  linkedRegistry,
  registryAddress,
  kind = 'standard',
}: {
  /**
   * Every field of the entry, with its value. Nothing is held back: the
   * picture draws here and nowhere else, and the title the hero sets large
   * keeps its labelled row, so the region is the whole submission.
   */
  fields: EntryField[]
  item?: SubgraphItem
  itemID?: string
  /** Why the entry's own file could not be read. */
  errors?: string[]
  /** Offered with those notices: a way to read the file that failed again. */
  retry?: React.ReactNode
  loading?: boolean
  /**
   * On a list of lists, the list the entry points to, which the page read
   * the file for: the field the seal reads, never simply the entry's first
   * field (a Standard entry's file orders its own columns).
   */
  linkedRegistry?: LinkedRegistryState | false | null
  registryAddress?: string
  /**
   * Standard lists claim their appeal fee rewards here; Stake lists settle
   * rewards elsewhere, so they get no claim.
   */
  kind?: 'standard' | 'stake'
}) => {
  const urlChainId = useUrlChainId()
  const openAttachment = useAttachment()

  const { file: linkedFile, error: linkedError } = linkedRegistry || {}
  const { metadata: linkedMetadata, fileURI } = linkedFile || {}
  const { tcrTitle, tcrDescription } = linkedMetadata || {}
  const linkedErrorMessage =
    linkedError instanceof Error ? linkedError.message : String(linkedError)
  const linkedAddress = linkedMetadata ? registryAddress : undefined
  const linkedHref =
    linkedAddress && urlChainId
      ? `/tcr/${urlChainId}/${linkedAddress}`
      : undefined
  // The block is drawn only when it holds something the title does not.
  const linkedExtras = !!(tcrDescription || fileURI || linkedHref)

  const found = entryMedia(fields)
  // One picture is the common case: it goes beside the fields, on the
  // plate under the hero's clock, and the band is left with the files. Two
  // or more stay in the band, which has the whole measure for them — in a
  // 248px track a gallery would stack into a column of its own.
  const rail = found.images.length === 1 ? found.images[0] : undefined
  // Only the fields a picture or a file plate draws stay out of the rows
  // below. The title field is not one of them: the hero sets it large
  // without saying which column it is, so it reads here as a labelled row
  // as well.
  const drawn = new Set<EntryField>([
    ...found.images.map((image) => image.field),
    ...found.files.map((file) => file.field),
  ])
  const rows = fields.filter((field) => {
    if (drawn.has(field)) return false
    // The hero's title already draws the list that field names — mark,
    // name and address — so the field itself does not read again here.
    if (linkedMetadata && isGtcrAddressField(field)) return false
    return true
  })

  const claim =
    kind === 'standard' ? <ItemRewardWithdrawal item={item} /> : null

  if (!loading && item && errors.length > 0)
    return (
      <Region id="item-submission">
        <RegionName as="h2" $tone="faint">
          Full details
        </RegionName>
        {errors.map((error, index) => (
          <Notice key={index} tone="contested" role="alert">
            {error}
          </Notice>
        ))}
        {retry && <Row>{retry}</Row>}
        {claim}
      </Region>
    )

  if (loading)
    return (
      <Region id="item-submission" aria-busy="true">
        <SkeletonBlock $height="18px" $width="40%" />
        <SkeletonBlock $height="20px" />
        <SkeletonBlock $height="20px" $width="70%" />
        <SkeletonBlock $height="20px" $width="55%" />
      </Region>
    )

  return (
    <Region id="item-submission" aria-label="Full details">
      <Head>
        <RegionName as="h2" $tone="faint">
          Full details
        </RegionName>
        {itemID && <CopyId id={itemID} />}
      </Head>
      {!!linkedError && (
        <Notice tone="contested" role="alert">
          Malformed submission: the linked registry could not be read (
          {linkedErrorMessage}).
        </Notice>
      )}
      {fields.length === 0 && (
        <Notice tone="contested">
          This entry does not pass the validation checks. Review it carefully.
        </Notice>
      )}
      <ItemMediaBand
        media={rail ? { images: [], files: found.files } : found}
      />
      {/* Only what the title above leaves unsaid about that list. */}
      {linkedMetadata && linkedExtras && (
        <RegistryBlock $divided={rows.length > 0}>
          {tcrDescription && <Body $muted>{tcrDescription}</Body>}
          {(fileURI || linkedHref) && (
            <Row $gap={8} $wrap>
              {fileURI && (
                <Button
                  type="button"
                  $variant="ghost"
                  $size="sm"
                  aria-label={`${tcrTitle || 'Linked list'} listing policy`}
                  onClick={() => openAttachment(parseIpfs(fileURI), true)}
                >
                  <CurateIcon name="policy" size={14} />
                  Its policy
                </Button>
              )}
              {linkedHref && (
                <ButtonLink to={linkedHref} $variant="secondary" $size="sm">
                  Open registry
                  <CurateIcon name="external" size={14} />
                </ButtonLink>
              )}
            </Row>
          )}
        </RegistryBlock>
      )}
      {(rows.length > 0 || rail) && (
        <FieldsRow>
          {rows.length > 0 && (
            <FieldsCell>
              <EntryFields fields={rows} />
            </FieldsCell>
          )}
          {rail && (
            <Picture>
              <ImagePlate image={rail} layout="rail" />
            </Picture>
          )}
        </FieldsRow>
      )}
      {claim}
    </Region>
  )
}

export default ItemSubmissionPanel
