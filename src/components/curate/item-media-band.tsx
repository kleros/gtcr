import React, { useState } from 'react'
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
 * the submission panel. Entries differ wildly — a token has a logo, an
 * address tag has nothing — so the band reserves no room: with nothing to
 * show it does not render, one picture gets a wide plate, a handful get
 * equal plates, and a long set becomes a strip you can scroll.
 *
 * Every plate says which field it is, so a picture is never left to speak
 * for itself, and opens full size in the in-app viewer. Pictures are read
 * through the IPFS gateway (ipfsImageUrl says why); a field whose value is
 * not on it keeps its row in the fields below instead of a plate here.
 */

const Band = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

const Plates = styled.div<{ $layout: 'one' | 'few' | 'many' }>`
  display: ${({ $layout }) => ($layout === 'many' ? 'flex' : 'grid')};
  gap: 12px;

  ${({ $layout }) =>
    $layout === 'one'
      ? 'grid-template-columns: minmax(0, 1fr);'
      : $layout === 'few'
        ? 'grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));'
        : `
          overflow-x: auto;
          scroll-snap-type: x proximity;
          padding-bottom: 6px;
        `}
`

const Plate = styled.figure<{ $layout: 'one' | 'few' | 'many' }>`
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

  figcaption {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`

const Open = styled.button<{ $tall: boolean }>`
  ${buttonReset}
  position: relative;
  display: block;
  width: 100%;
  height: ${({ $tall }) => ($tall ? 'clamp(180px, 26vw, 300px)' : '150px')};
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
 * The picture a page leads with: the entry's first one the gateway can
 * serve. The panel takes it as `skip` so the same image is never both the
 * hero's tile and a plate in the band.
 */
export const heroImage = (fields: EntryField[]): MediaImage | undefined =>
  entryMedia(fields).images[0]

const ImagePlate = ({
  image,
  layout,
}: {
  image: MediaImage
  layout: 'one' | 'few' | 'many'
}) => {
  const [broken, setBroken] = useState(false)
  const openAttachment = useAttachment()
  const name = image.field.label || 'Picture'

  return (
    <Plate $layout={layout}>
      <Open
        type="button"
        $tall={layout === 'one'}
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
                // The figure counts what the strip holds, which is not
                // always the entry's total: the hero keeps one picture.
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
