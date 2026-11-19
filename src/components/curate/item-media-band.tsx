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
export type PlateLayout = 'one' | 'few' | 'many' | 'rail' | 'lead'

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
    $layout === 'lead' &&
    `
    width: 100%;
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

const HERO_PICTURE_SELECTOR = '[data-hero-picture]'

/**
 * Spread on the full details' flow (what follows the region's name: the
 * lead plate when it is there, the files, the linked list and the field
 * rows), so `useHeroPictureSide` can measure what would run beside it.
 */
export const HERO_FLOW_MARK = { 'data-hero-flow': '' }

const HERO_FLOW_SELECTOR = '[data-hero-flow]'

/* How much less empty glass the other place must leave before the picture
   moves, in pixels of height across the narrower column: a few pixels
   either way is not worth a jump. */
const HERO_PICTURE_SLACK = 12

/**
 * Which hero column takes the entry's one picture: the place that leaves
 * the least empty glass. Under the clock is its first place, beside the
 * field list it belongs to; but an action card beside an entry of two
 * fields can already stand taller than the left column, and a picture
 * there doubled the block of empty glass at the hero's bottom-left (the
 * round-5 review measured 284px by 870px on a decided entry). There it
 * opens the full details instead, with the first field rows beside it.
 *
 * Empty glass is the height by which one column falls short of the other,
 * times that column's width: a strip under the action in the 360px column
 * reads as air, the same height across the 870px left column as a
 * half-empty box. Both columns are measured as they would stand without
 * the picture, and each place is charged what the picture adds there:
 * under the clock, the plate and the gap above it; in the details, beside
 * the rows, only the part of the plate that runs past them (all of it,
 * with its gap, where the details are too narrow for the two side by side,
 * HERO_LEAD_BESIDE). The rows' height at the details' full width is noted
 * while the picture is under the clock and reused while it sits beside
 * them (narrowed, they wrap a little), so the two places are always
 * weighed with the same figures and the picture cannot chase itself from
 * one to the other. Where the hero stacks the page's own order places it,
 * under the facts, so the answer is then always the clock's column.
 */
export const useHeroPictureSide = (
  left: HTMLElement | null,
  aside: HTMLElement | null,
  active: boolean,
): HeroPictureSide => {
  const [side, setSide] = useState<HeroPictureSide>('aside')

  useEffect(() => {
    if (
      !active ||
      !left ||
      !aside ||
      typeof ResizeObserver === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return undefined
    const stacked = window.matchMedia(HERO_STACKED)
    const beside = window.matchMedia(HERO_LEAD_BESIDE)
    // The flow's height at its full width, by that width, noted while the
    // picture is not in it.
    const flowHeights = new Map<number, number>()
    const measure = () => {
      if (stacked.matches) {
        setSide('aside')
        return
      }
      const picture = (left.querySelector(HERO_PICTURE_SELECTOR) ??
        aside.querySelector(HERO_PICTURE_SELECTOR)) as HTMLElement | null
      // Absent while the details have nothing for the plate to stand
      // beside and the plate is not in them either.
      const flow = left.querySelector(HERO_FLOW_SELECTOR) as HTMLElement | null
      if (!picture) return
      const plate = picture.offsetHeight
      const inDetails = !!flow && flow.contains(picture)
      // What would run beside the plate: the flow's own content.
      const hasContent = !!flow && flow.children.length > (inDetails ? 1 : 0)
      const sideBySide = beside.matches && hasContent
      // The flow's content at full width, noted while the plate is not in
      // it. Beside the plate and with no note for this width (the page was
      // resized meanwhile), its narrowed height stands in: a few pixels
      // high at worst.
      const flowWidth = flow ? Math.round(flow.clientWidth) : 0
      if (flow && !inDetails) flowHeights.set(flowWidth, flow.offsetHeight)
      const content =
        flow && sideBySide
          ? (flowHeights.get(flowWidth) ??
            Math.max(
              0,
              ...[...flow.children]
                .filter((child) => child !== picture)
                .map(
                  (child) =>
                    child.getBoundingClientRect().bottom -
                    flow.getBoundingClientRect().top,
                ),
            ))
          : 0
      // What the picture adds in each place: under the clock, the plate
      // and the column's gap above it; in the details, beside the rows,
      // the part of the plate (and the gap under it) that runs past them,
      // and otherwise the plate and the gap that parts it from the rest
      // (or, alone, from the region's name).
      const asideShare =
        plate + (parseFloat(getComputedStyle(aside).rowGap) || 0)
      const detailsShare = sideBySide
        ? Math.max(0, plate + HERO_LEAD_GAP - content)
        : plate + HERO_LEAD_GAP
      // Each column as it would stand without the picture. In the details
      // beside the rows, what it adds now includes the rows' narrowing.
      const leftBase =
        left.offsetHeight -
        (!inDetails
          ? 0
          : flow && sideBySide
            ? flow.offsetHeight - content
            : plate + HERO_LEAD_GAP)
      const asideBase = aside.offsetHeight - (inDetails ? 0 : asideShare)
      const leftWidth = left.offsetWidth
      const asideWidth = aside.offsetWidth
      // The empty glass two column heights leave: the shorter column's
      // shortfall across its own width.
      const emptyGlass = (leftHeight: number, asideHeight: number) =>
        leftHeight >= asideHeight
          ? (leftHeight - asideHeight) * asideWidth
          : (asideHeight - leftHeight) * leftWidth
      const glass: Record<HeroPictureSide, number> = {
        aside: emptyGlass(leftBase, asideBase + asideShare),
        details: emptyGlass(leftBase + detailsShare, asideBase),
      }
      const slack = HERO_PICTURE_SLACK * Math.min(leftWidth, asideWidth)
      setSide((current) => {
        const other = current === 'aside' ? 'details' : 'aside'
        return glass[other] + slack < glass[current] ? other : current
      })
    }
    // Both columns change height as the entry, the clock and the action
    // card arrive, and with the page's width; the observer's first report
    // is the first measurement.
    const observer = new ResizeObserver(measure)
    observer.observe(left)
    observer.observe(aside)
    stacked.addEventListener('change', measure)
    beside.addEventListener('change', measure)
    return () => {
      observer.disconnect()
      stacked.removeEventListener('change', measure)
      beside.removeEventListener('change', measure)
    }
  }, [left, aside, active])

  return active ? side : 'aside'
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
