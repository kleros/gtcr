import React from 'react'
import styled, { css } from 'styled-components'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useAttachment } from 'hooks/use-attachment'
import { parseIpfs } from 'utils/ipfs-parse'
import { CurateIcon } from './icons'
import {
  Body,
  Button,
  ButtonLink,
  Row,
  SkeletonBlock,
  Label,
} from './primitives'
import {
  EntryFields,
  isGtcrAddressField,
  type EntryField,
} from './item-standard-fields'
import { Notice } from './item-standard-notice'
import {
  HERO_FLOW_MARK,
  HERO_LEAD_BESIDE,
  HERO_LEAD_GAP,
  HERO_LEAD_ROW_MIN,
  HERO_PICTURE_MARK,
  ImagePlate,
  PlateThumbs,
  ItemMediaBand,
  entryMedia,
  heroPicture,
} from './item-media-band'
import { ItemRewardWithdrawal } from './item-reward-withdrawal'

/*
 * The entry's full details, all of it, in one place (the design review's
 * point 3: the fields used to be split between a page-long header of
 * identifiers and a separate "Details" box, and the cut between them
 * depended on the field's type, so the same list's fields landed in
 * different boxes).
 *
 * Round 4 folds it into the entry page's hero, and round 5 has it trail
 * straight under the facts strip, in the hero's left column, so the entry
 * and what it says are one box with no band between them. It is therefore
 * a region and not a panel: an inset hairline and space, exactly like the
 * facts strip above it, because a panel inside a panel is a stack
 * (DESIGN.md).
 *
 * Bands, in reading order: the entry's files (and its pictures, when it has
 * more than one, which need the whole measure), then what only the linked
 * list of a list-of-lists entry can say about itself, then every field —
 * identifiers included — across the column, then what this account can
 * claim from the entry's appeals. Nothing is reserved for a field or a
 * picture the entry does not have.
 *
 * The region is field-complete, so what the hero lifts out is here as well
 * (round 3: a box named "Full details" that was missing the two things the
 * page leads with), with one exception: an entry's one picture is placed
 * by the page itself (`heroPicture`), in whichever hero column it leaves
 * the least empty glass in. Under the clock it is not drawn again here;
 * beside an action card that already stands taller than this region, the
 * page asks for it here (`leadsWithPicture`) and it opens the region, where
 * two or more pictures would have stood, with the first rows beside it.
 * The title reads here as a
 * labelled row under its own column name, which is what the hero's display
 * line cannot say. The entry's ID is in the facts strip above, next to
 * "By".
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

/* The region's name is a label, not a display line: inside the hero a
   second 22px heading is what made this read as a second box. */
const RegionName = styled(Label)`
  margin: 0;
`

/*
 * Everything under the region's name that the lead plate can stand beside:
 * the files, the linked list and the field rows, with the region's own
 * space between them. The lead plate opens it.
 *
 * Wide enough (HERO_LEAD_BESIDE), the plate sits on the left, up to 420px,
 * and what follows runs beside it in the rest of the measure: each field
 * row is a grid, a formatting context of its own, so beside the plate it
 * narrows to the room left and, once past the plate's foot, takes the full
 * measure again (the list is set as blocks for that; as a flex column it
 * would narrow as a whole). The round-5 audit found a 420px plate alone at
 * the top of the details with an empty block of about 377 by 196 beside
 * it. With nothing to run beside it, or too narrow for both, the plate
 * takes the measure's whole width above the rest, the picture contained on
 * its quiet fill, so no hole is left beside it either way. A flow root, so
 * the region holds the plate's whole height when the rows end first.
 */
const Flow = styled.div<{ $beside: boolean }>`
  display: flow-root;

  > * + * {
    margin-top: ${HERO_LEAD_GAP}px;
  }

  ${({ $beside }) =>
    $beside &&
    css`
      @media ${HERO_LEAD_BESIDE} {
        > [data-hero-picture] {
          float: left;
          /* Round 8 trial: a portrait plate on the left, the rows stacked
             beside it. Never so wide that the rows beside it drop under
             HERO_LEAD_ROW_MIN: a value column narrower than that clipped
             a chain chip and broke addresses mid-word near the
             threshold. */
          width: min(220px, 40%, 100% - ${HERO_LEAD_ROW_MIN}px);
          /* 12px, and the rows' own 12px inset, set them 24px off the
             plate, as a row's label is off its value. */
          margin: 0 12px ${HERO_LEAD_GAP}px 0;
        }

        > [data-hero-picture] + * {
          margin-top: 0;
        }

        /* Portrait: taller than wide, so the rows beside it read as a
           column next to the picture (the first plate; the small ones
           under it keep their own height). */
        > [data-hero-picture] > figure > button {
          height: 260px;
        }

        /* The rows' 12px bleed is moved from each row to the list: a row
           beside the float is fitted into the room it leaves and lost its
           negative right margin, so it ended 12px short of the rows past
           the plate's foot. Now every row ends on the same line. */
        > dl {
          display: block;
          /* Sides only: the space above stays the flow's own. */
          margin-right: -12px;
          margin-left: -12px;
        }

        > dl > div {
          margin-right: 0;
          margin-left: 0;
        }
      }
    `}
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

/** What the item pages resolve for a linked registry's meta evidence. */
export interface LinkedRegistryState {
  file?: MetaEvidence
  error?: unknown
}

export const ItemSubmissionPanel = ({
  fields,
  item,
  errors = [],
  retry,
  loading = false,
  linkedRegistry,
  registryAddress,
  kind = 'standard',
  leadsWithPicture = false,
}: {
  /**
   * Every field of the entry, with its value. Only an entry's one picture
   * is held back, since the page places it (under the hero's clock, or here
   * with `leadsWithPicture`); the title the hero sets large keeps its labelled row,
   * so the region is the whole submission.
   */
  fields: EntryField[]
  item?: SubgraphItem
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
  /**
   * Draw the entry's one picture here, first, ahead of the files and the
   * rows: the page asks for it when the clock's column already stands
   * taller than this region (useHeroPictureSide).
   */
  leadsWithPicture?: boolean
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
  // One picture is the common case: the page places it (under the hero's
  // clock, or first in here with leadsWithPicture), and the band is left
  // with the files. Two or more stay in the band, which has the column's whole
  // measure for them — in the hero's right-hand column a gallery would
  // stack into a column of its own.
  const single = heroPicture(fields)
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

  // The picture this region opens with: the page's one picture when it asks
  // for it here, or, with two or more, always (round 9): the first as the
  // portrait plate on the left, the others as small plates under it, the
  // field rows beside them, as the one picture stands.
  const gallery = found.images.length >= 2 ? found.images : undefined
  const lead = gallery ? gallery[0] : leadsWithPicture ? single : undefined
  const extras = gallery ? gallery.slice(1) : []
  const bandMedia =
    single || gallery ? { images: [], files: found.files } : found
  const linkedBlock = !!linkedMetadata && linkedExtras
  // Whether anything follows the lead plate to run beside it: with
  // nothing, it takes the measure's whole width.
  const besideContent =
    bandMedia.images.length > 0 ||
    bandMedia.files.length > 0 ||
    linkedBlock ||
    rows.length > 0

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
      <RegionName as="h2" $tone="faint">
        Full details
      </RegionName>
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
      {/* Marked so the page can measure what would run beside the plate.
          With nothing in it, it is not drawn, so it adds no gap. */}
      {(lead || besideContent) && (
        <Flow {...HERO_FLOW_MARK} $beside={!!lead && besideContent}>
          {lead && (
            // Marked so the page can measure it wherever it stands.
            <div {...HERO_PICTURE_MARK}>
              <ImagePlate image={lead} layout="lead" />
              {extras.length > 0 && (
                <PlateThumbs>
                  {extras.map((image, index) => (
                    <ImagePlate
                      key={`${image.field.label ?? 'picture'}-${index}`}
                      image={image}
                      layout="thumb"
                    />
                  ))}
                </PlateThumbs>
              )}
            </div>
          )}
          <ItemMediaBand media={bandMedia} />
          {/* Only what the title above leaves unsaid about that list. */}
          {linkedBlock && (
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
                      Open list
                      <CurateIcon name="external" size={14} />
                    </ButtonLink>
                  )}
                </Row>
              )}
            </RegistryBlock>
          )}
          {/* Across the column, with no track kept for a picture: the hero's
            left column (about 800px at 1440) is already a reading measure.
            Beside the lead plate, its first rows take the room it leaves. */}
          {rows.length > 0 && <EntryFields fields={rows} />}
        </Flow>
      )}
      {claim}
    </Region>
  )
}

export default ItemSubmissionPanel
