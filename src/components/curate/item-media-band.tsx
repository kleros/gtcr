import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { ItemTypes } from '@kleros/gtcr-encoder'
import FileDisplay from 'components/file-display'
import { useAttachment } from 'hooks/use-attachment'
import { ipfsImageUrl } from 'utils/ipfs-parse'
import { buttonReset } from 'styles/button-reset'
import { Label } from './primitives'
import { hasValue, isImageField, type EntryField } from './item-standard-fields'

/*
 * The entry's pictures and files, given a place of their own at the top of
 * the full-details panel. Entries differ wildly — a token has a logo, an
 * address tag has nothing — so the band reserves no room: with nothing to
 * show it does not render, one picture gets a plate the width of a picture,
 * a handful get equal plates, and a long set becomes a strip you can scroll.
 *
 * Every plate says which field it is, so a picture is never left to speak
 * for itself, and opens full size in the in-app viewer. Pictures are read
 * through the IPFS gateway (ipfsImageUrl says why); a field whose value is
 * not on it keeps its row in the fields below instead of a plate here.
 *
 * A single picture is the common case and the entry page draws it on its
 * own (`heroPicture`), in whichever of the hero's two columns it leaves the
 * least empty glass in (`useHeroPictureSide`): as a `rail` plate under the
 * clock and the action, or as a `lead` plate opening the full details,
 * with the first field rows running beside it. The band then renders only
 * the files. Round 5 of the design review asked for a better place than the
 * track beside the field list, which was reserved whether or not there was
 * a picture and left a 280px strip down every entry without one; a picture
 * fixed under the clock then left a block of empty glass beside it wherever
 * the action card stood taller than a short field list, and a 420px plate
 * alone at the top of the details left an empty block about 377 by 196
 * beside it. Two or more keep the band and its full measure, because a
 * gallery cannot live in a 312px column.
 */

/**
 * The shapes a picture can take: inside the band, under the hero's clock
 * (`rail`), or opening the full details (`lead`, as wide as the room the
 * details give it).
 */
export type PlateLayout = 'one' | 'few' | 'many' | 'rail' | 'lead' | 'thumb'

/* The width at which the hero stacks into one column, set in the pages. */
const HERO_STACKED = '(max-width: 1000px)'

/**
 * From this width the lead plate sits beside the first field rows; below
 * it the details column is too narrow for both (a plate of about 300px and
 * rows of HERO_LEAD_ROW_MIN), and the plate takes the column's width above
 * them.
 */
export const HERO_LEAD_BESIDE = '(min-width: 1180px)'

/**
 * The narrowest a field row beside the lead plate gets, the plate giving
 * way first: label 120px, value 192px. An address with its chain chip and
 * the copy control that appears on hover takes 173px; at 172 the chip's
 * name was cut to "MATI…".
 */
export const HERO_LEAD_ROW_MIN = 360

/** The space between the lead plate and what follows it, beside or below. */
export const HERO_LEAD_GAP = 16

const Band = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

/* One picture takes a plate the size of a picture, not the panel's whole
   measure: most entries have a single logo, and across 800px of column an
   `object-fit: contain` logo is mostly empty glass. It still opens full
   size on click. Two to four share the row; their 140px minimum lets two
   sit side by side in a 320px phone column, where a 170px one stacked
   every picture into a column over 500px tall. */
const Plates = styled.div<{ $layout: 'one' | 'few' | 'many' }>`
  display: ${({ $layout }) => ($layout === 'many' ? 'flex' : 'grid')};
  gap: 12px;

  ${({ $layout }) =>
    $layout === 'one'
      ? 'grid-template-columns: minmax(0, 360px);'
      : $layout === 'few'
        ? 'grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));'
        : `
          overflow-x: auto;
          scroll-snap-type: x proximity;
          padding-bottom: 6px;
        `}
`

/* The rail plate takes the width of the hero's right-hand column (312px
   inside its padding), so a logo or a screenshot reads at the size of the
   clock above it. Where the hero stacks it stands alone in the column, so
   it takes the column's whole width rather than leaving a hole beside a
   420px plate, and a little more height (Open), the picture contained on
   the plate's quiet fill. The lead plate is as wide as the room the full
   details give it: up to 420px beside the field rows, the whole measure
   with none beside it. Its height is the rail plate's, so the column it
   lands in grows by the same amount wherever it goes and before the image
   has loaded. */
const Plate = styled.figure<{ $layout: PlateLayout }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  min-width: 0;

  ${({ $layout }) =>
    $layout === 'many' &&
    `
    flex: 0 0 auto;
    width: 190px;
    scroll-snap-align: start;
  `}

  ${({ $layout }) =>
    $layout === 'rail' &&
    `
    width: 100%;
    max-width: 420px;

    @media ${HERO_STACKED} {
      max-width: none;
    }
  `}

  ${({ $layout }) =>
    ($layout === 'lead' || $layout === 'thumb') &&
    `
    width: 100%;
  `}

  ${({ $layout }) =>
    $layout === 'thumb' &&
    `
    gap: 4px;

    figcaption {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `}

  figcaption {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`

const Open = styled.button<{ $layout: PlateLayout }>`
  ${buttonReset}
  position: relative;
  display: block;
  width: 100%;
  height: ${({ $layout }) =>
    $layout === 'one'
      ? 'clamp(180px, 26vw, 300px)'
      : $layout === 'rail' || $layout === 'lead'
        ? '168px'
        : $layout === 'thumb'
          ? '96px'
          : '150px'};

  ${({ $layout }) =>
    $layout === 'rail' &&
    `
    @media ${HERO_STACKED} {
      height: clamp(168px, 28vw, 240px);
    }
  `}
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  cursor: zoom-in;
  transition:
    border-color var(--motion),
    transform var(--motion);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 420ms var(--ease-out);
  }

  &:hover {
    border-color: var(--color-border-strong);
  }

  &:hover img {
    transform: scale(1.03);
  }

  @media (prefers-reduced-motion: reduce) {
    img,
    &:hover img {
      transform: none;
      transition: none;
    }
  }
`

const Missing = styled.span`
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Files = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
`

const normalizeType = (type?: unknown) =>
  typeof type === 'string' ? type.toLowerCase() : ''

const isFileField = (field: EntryField) =>
  normalizeType(field.type) === normalizeType(ItemTypes.FILE)

/** A picture the gateway can serve, with the field it came from. */
export interface MediaImage {
  field: EntryField
  url: string
}

/** A file the viewer can open, with the field it came from. */
export interface MediaFile {
  field: EntryField
  /** The field's value as text: its IPFS path. */
  path: string
}

export interface EntryMedia {
  images: MediaImage[]
  files: MediaFile[]
}

/**
 * The entry's pictures and files. Fields it returns are drawn by the band,
 * so the panel leaves them out of its rows: nothing is shown twice.
 */
export const entryMedia = (fields: EntryField[]): EntryMedia => {
  const images: MediaImage[] = []
  const files: MediaFile[] = []
  for (const field of fields) {
    if (!hasValue(field)) continue
    if (isImageField(field)) {
      const url = ipfsImageUrl(field.value)
      if (url) images.push({ field, url })
      continue
    }
    // A file field's value is an IPFS path. An entry's file is written by
    // anyone, so a column typed FILE can hold anything: a value that is not
    // text keeps its ordinary row below, where displayableValue renders it
    // safely (utils/display-value.ts: never String(), an object with its own
    // "toString" key makes it throw).
    if (isFileField(field) && typeof field.value === 'string')
      files.push({ field, path: field.value })
  }
  return { images, files }
}

/**
 * The one picture the entry page draws in its hero itself: only when the
 * entry has exactly one. With none there is nothing to place and nothing is
 * reserved; with two or more the band keeps them all.
 */
export const heroPicture = (fields: EntryField[]): MediaImage | undefined => {
  const { images } = entryMedia(fields)
  return images.length === 1 ? images[0] : undefined
}

/** Where the hero's one picture goes: under the clock, or in the details. */
export type HeroPictureSide = 'aside' | 'details'

/**
 * Spread on the element that holds the hero's one picture, in either place,
 * so `useHeroPictureSide` can find and measure it.
 */
export const HERO_PICTURE_MARK = { 'data-hero-picture': '' }

/**
 * Spread on the full details' flow (what follows the region's name: the
 * lead plate when it is there, the files, the linked list and the field
 * rows), so `useHeroPictureSide` can measure what would run beside it.
 */
export const HERO_FLOW_MARK = { 'data-hero-flow': '' }

/**
 * Which hero column takes the entry's one picture. Round 8, on trial ("if
 * present in the item page, the image should still be on the left in a
 * sort of vertical organization"): always the left, opening the full
 * details as a portrait plate with the field rows stacked beside it
 * (Flow), wherever the hero has two columns. Where the hero stacks, the
 * page's own order places it, under the facts, which is the clock's
 * column's answer. (Before the trial the picture went to whichever column
 * left the least empty glass; `git revert` of this trial restores it.)
 */
export const useHeroPictureSide = (
  _left: HTMLElement | null,
  _aside: HTMLElement | null,
  active: boolean,
): HeroPictureSide => {
  const [stacked, setStacked] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.(HERO_STACKED).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(HERO_STACKED)
    const change = () => setStacked(query.matches)
    change()
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return active && !stacked ? 'details' : 'aside'
}

/**
 * One picture under its field's name, opening full size on click. The
 * entry page renders it itself for the `rail` layout, the full details for
 * the `lead` one; the band renders the rest.
 */
export const ImagePlate = ({
  image,
  layout,
}: {
  image: MediaImage
  layout: PlateLayout
}) => {
  const [broken, setBroken] = useState(false)
  const openAttachment = useAttachment()
  const name = image.field.label || 'Picture'

  return (
    <Plate $layout={layout}>
      <Open
        type="button"
        $layout={layout}
        aria-label={`Open ${name} full size`}
        onClick={() => openAttachment(image.url)}
      >
        {broken ? (
          <Missing>Could not be loaded</Missing>
        ) : (
          <img
            src={image.url}
            alt={name}
            loading="lazy"
            onError={() => setBroken(true)}
          />
        )}
      </Open>
      <figcaption>
        <Label $tone="faint">{name}</Label>
      </figcaption>
    </Plate>
  )
}

/*
 * The pictures after the first, under it in the left column (round 9:
 * "how you will handle this when an entry has multiple pics"): small
 * plates, as many to a row as fit, each opening full size.
 */
export const PlateThumbs = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
  margin-top: 12px;
`

/** The entry's pictures and files; nothing at all when it has neither. */
export const ItemMediaBand = ({ media }: { media: EntryMedia }) => {
  const { images, files } = media
  if (images.length === 0 && files.length === 0) return null
  const layout =
    images.length === 1 ? 'one' : images.length <= 4 ? 'few' : 'many'

  return (
    <Band>
      {images.length > 0 && (
        <Plates
          $layout={layout}
          {...(layout === 'many'
            ? {
                tabIndex: 0,
                role: 'group',
                // The strip holds every picture the entry has, so the
                // figure is its total.
                'aria-label': `${images.length} pictures in this strip`,
              }
            : {})}
        >
          {images.map((image, index) => (
            <ImagePlate
              key={`${image.field.label ?? 'image'}-${index}`}
              image={image}
              layout={layout}
            />
          ))}
        </Plates>
      )}
      {files.length > 0 && (
        <Files>
          {files.map(({ field, path }, index) => (
            <li key={`${field.label ?? 'file'}-${index}`}>
              <Label $tone="faint">{field.label || 'File'}</Label>
              <FileDisplay
                value={path}
                allowedFileTypes={field.allowedFileTypes as string}
              />
            </li>
          ))}
        </Files>
      )}
    </Band>
  )
}

export default ItemMediaBand
