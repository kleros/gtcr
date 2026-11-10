import React, { useState } from 'react'
import styled from 'styled-components'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { parseIpfs } from 'utils/ipfs-parse'
import { isSafeNavigationUrl } from 'utils/url-validation'
import { useAttachment } from 'hooks/use-attachment'
import { buttonReset } from 'styles/button-reset'
import { CurateIcon } from 'components/curate/icons'
import { SkeletonBlock, Small } from 'components/curate/primitives'
import GTCRAddress from './gtcr-address'
import RichAddress from './rich-address'
import ETHAddress from './eth-address'
import LongText from './long-text'
import FileDisplay from './file-display'
import TruncatedLink from './truncated-link'

/*
 * Renders one entry field by its MetaEvidence type. Addresses are mono with
 * copy and explorer, links name their domain, images sit in a rounded frame
 * that zooms on hover, long text fades out behind an expander. Empty values
 * show a faint placeholder; nothing is substituted for data the entry does
 * not have.
 */

const Plain = styled.span`
  overflow-wrap: anywhere;
`

const Num = styled.span`
  font-family: var(--font-figure);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
`

const Flag = styled.span<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${({ $on }) => ($on ? 'var(--color-text)' : 'var(--color-muted)')};
  font-weight: 500;

  svg {
    color: ${({ $on }) =>
      $on ? 'var(--status-registered)' : 'var(--color-faint)'};
  }
`

/* Inline, so on a long wrapping URL the arrow follows the last word. */
const StyledLink = styled.a`
  && {
    color: var(--color-primary);
    text-decoration: underline;
    text-decoration-color: transparent;
    text-underline-offset: 3px;
    overflow-wrap: anywhere;
    transition:
      color var(--motion),
      text-decoration-color var(--motion);
  }

  > svg {
    display: inline-block;
    margin-left: 4px;
    vertical-align: -1px;
    opacity: 0.7;
    transition: transform 240ms var(--ease-out);
  }

  &&:hover {
    color: var(--color-primary-hover);
    text-decoration-color: currentColor;
  }

  &:hover > svg {
    transform: translate(1px, -1px);
  }
`

/* ---------- Images ---------- */

const ImageFrame = styled.span`
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 100px;
  height: 100px;
  overflow: hidden;
  vertical-align: middle;
  border-radius: var(--radius);
  background: var(--color-raised);
  box-shadow:
    inset 0 0 0 1px var(--glass-border),
    inset 0 1px 0 var(--glass-highlight);
  isolation: isolate;

  img {
    display: block;
    width: 100%;
    height: 100%;
    padding: 6px;
    object-fit: contain;
    opacity: 0;
    transition:
      opacity 360ms var(--ease-out),
      transform 520ms var(--ease-out);
  }

  img[data-loaded='true'] {
    opacity: 1;
  }

  &:hover img {
    transform: scale(1.08);
  }

  > [data-skeleton] {
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
`

/* The expand mark that fades in over an image that opens in the viewer. */
const Expand = styled.span`
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-bg) 72%, transparent);
  box-shadow: inset 0 0 0 1px var(--glass-border);
  color: var(--color-text);
  opacity: 0;
  transform: scale(0.85);
  transition:
    opacity var(--motion),
    transform 240ms var(--ease-out);
`

const ImageLinkButton = styled.button`
  ${buttonReset}
  display: inline-flex;
  vertical-align: middle;
  border-radius: var(--radius);
  cursor: zoom-in;

  &:hover ${Expand}, &:focus-visible ${Expand} {
    opacity: 1;
    transform: none;
  }

  &:hover ${ImageFrame} {
    box-shadow:
      inset 0 0 0 1px var(--color-border-strong),
      inset 0 1px 0 var(--glass-highlight);
  }
`

const Broken = styled.span`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--color-faint);
`

const ExpandIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </svg>
)

const ImageIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m21 16-5-5-8 8" />
  </svg>
)

interface ImageWithLoadingProps {
  src: string
  alt: string
  linkImage?: boolean | null
}

const ImageWithLoading = ({ src, alt, linkImage }: ImageWithLoadingProps) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const openAttachment = useAttachment()

  if (error)
    return (
      <ImageFrame title="Image could not be loaded">
        <Broken>
          <ImageIcon />
        </Broken>
      </ImageFrame>
    )

  const content = (
    <ImageFrame>
      {loading && (
        <SkeletonBlock data-skeleton $width="100px" $height="100px" />
      )}
      <img
        src={src}
        alt={alt}
        data-loaded={!loading}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
      />
      {linkImage && !loading && (
        <Expand aria-hidden>
          <ExpandIcon />
        </Expand>
      )}
    </ImageFrame>
  )

  if (linkImage)
    return (
      <ImageLinkButton
        type="button"
        aria-label="Open image"
        onClick={(event) => {
          event.stopPropagation()
          openAttachment(src)
        }}
      >
        {content}
      </ImageLinkButton>
    )

  return content
}

const protocolRegex = /:\/\//

interface DisplaySelectorProps {
  type: string
  value?: string | number | boolean | null
  linkImage?: boolean | null
  allowedFileTypes?: string | null
  truncateLinks?: boolean
  disabled?: boolean
}

const DisplaySelector = ({
  type,
  value = null,
  linkImage = null,
  allowedFileTypes = null,
  truncateLinks = false,
  disabled = false,
}: DisplaySelectorProps) => {
  switch (type) {
    case ItemTypes.GTCR_ADDRESS:
      return value ? (
        <GTCRAddress address={String(value)} disabled={disabled} />
      ) : (
        <Small $faint>No address</Small>
      )
    case ItemTypes.ADDRESS:
      return value ? (
        <ETHAddress address={String(value)} />
      ) : (
        <Small $faint>No address</Small>
      )
    case ItemTypes.RICH_ADDRESS:
      return value ? (
        <RichAddress crude={String(value)} />
      ) : (
        <Small $faint>No address</Small>
      )
    case ItemTypes.TEXT:
      return <Plain>{value}</Plain>
    case ItemTypes.NUMBER:
      return value === null || value === undefined ? (
        <Small $faint>No value</Small>
      ) : (
        <Num>{String(value)}</Num>
      )
    case ItemTypes.BOOLEAN: {
      const on = String(value) === 'true'
      return (
        <Flag $on={on}>
          <CurateIcon name={on ? 'check' : 'close'} size={14} />
          {on ? 'Yes' : 'No'}
        </Flag>
      )
    }
    case ItemTypes.LONG_TEXT:
      return (
        <LongText
          value={value ? String(value) : null}
          compact={truncateLinks}
        />
      )
    case ItemTypes.FILE:
      return (
        <FileDisplay
          value={value ? String(value) : null}
          allowedFileTypes={allowedFileTypes}
        />
      )
    case ItemTypes.IMAGE:
      return value ? (
        <ImageWithLoading
          src={parseIpfs(String(value))}
          alt=""
          linkImage={linkImage}
        />
      ) : (
        <Small $faint>No image</Small>
      )
    case ItemTypes.LINK: {
      if (!value) return <Small $faint>No link</Small>
      const fullUrl = protocolRegex.test(String(value))
        ? String(value)
        : `https://${value}`
      if (!isSafeNavigationUrl(fullUrl)) return <Plain>{value}</Plain>
      if (truncateLinks) return <TruncatedLink url={fullUrl} />
      return (
        <StyledLink href={fullUrl} target="_blank" rel="noopener noreferrer">
          {value}
          <CurateIcon name="external" size={12} />
        </StyledLink>
      )
    }
    default:
      return <Small $faint>Unsupported field type: {type}</Small>
  }
}

export default React.memo(DisplaySelector)
