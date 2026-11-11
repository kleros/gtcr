import React, { useState } from 'react'
import styled, { css } from 'styled-components'
import { Link } from 'react-router-dom'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from 'components/display-selector'
import ETHAddress from 'components/eth-address'
import { parseIpfs } from 'utils/ipfs-parse'
import useTcrMetaEvidence from 'hooks/use-tcr-meta-evidence'
import useCheckPermanentList from 'hooks/use-check-permanent-list'
import useUrlChainId from 'hooks/use-url-chain-id'
import { CurateIcon } from './icons'
import { Chip, SkeletonBlock, Small, truncateMiddle } from './primitives'

/*
 * Field rendering shared by the entry list and the item pages: a field by
 * its type, images in a rounded frame that zooms on hover, and registry
 * references (GTCR address fields) as a small registry identity: logo, the
 * title that opens the list, the address (on an entry page, it opens the
 * explorer) and the Stake Curate chip. V2Card is the surface the factory shell builds on.
 */

export type V2Field = {
  label?: string
  value?: unknown
  type?: string
  description?: string
  isIdentifier?: boolean
  allowedFileTypes?: string | string[]
}

export const V2Card = styled.div<{ $hover?: boolean }>`
  position: relative;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-card);
  color: var(--color-text);
  transition:
    border-color var(--motion),
    box-shadow var(--motion),
    transform var(--motion);

  ${({ $hover }) =>
    $hover &&
    css`
      cursor: pointer;

      &:hover {
        border-color: var(--color-border-strong);
        box-shadow:
          inset 0 1px 0 var(--glass-highlight),
          var(--shadow-card-hover);
        transform: translateY(-1px);
      }
    `}
`

const FieldWrap = styled.div<{ $image?: boolean; $inherit?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  flex-shrink: ${({ $image }) => ($image ? 0 : 1)};
  color: var(--color-text);
  overflow-wrap: anywhere;
  ${({ $inherit }) =>
    !$inherit &&
    css`
      font-size: var(--fs-body);
      line-height: var(--lh-body);
    `}
`

const FieldLabel = styled(Small)`
  flex: 0 0 auto;
`

/* ---------- Image ---------- */

const ThumbFrame = styled.span<{ $large?: boolean }>`
  position: relative;
  display: block;
  flex: 0 0 auto;
  width: ${({ $large }) => ($large ? '125px' : '40px')};
  height: ${({ $large }) => ($large ? '125px' : '40px')};
  overflow: hidden;
  border-radius: ${({ $large }) =>
    $large ? 'var(--radius-lg)' : 'var(--radius)'};
  background: var(--color-raised);
  box-shadow:
    inset 0 0 0 1px var(--glass-border),
    inset 0 1px 0 var(--glass-highlight);
  isolation: isolate;

  img {
    display: block;
    width: 100%;
    height: 100%;
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

const ThumbFallback = styled.span`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--color-faint);
`

const Thumb = ({
  src,
  alt,
  large,
}: {
  src: string
  alt: string
  large?: boolean
}) => {
  const [state, setState] = useState<'loading' | 'ready' | 'broken'>('loading')
  return (
    <ThumbFrame $large={large}>
      {state === 'loading' && <SkeletonBlock data-skeleton />}
      {state === 'broken' ? (
        <ThumbFallback title="Image could not be loaded">
          <CurateIcon name="grid" size={large ? 22 : 14} />
        </ThumbFallback>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          data-loaded={state === 'ready'}
          onLoad={() => setState('ready')}
          onError={() => setState('broken')}
        />
      )}
    </ThumbFrame>
  )
}

/* ---------- List reference ---------- */

const ListReference = styled.div<{ $detailed?: boolean }>`
  display: inline-grid;
  grid-template-columns: ${({ $detailed }) =>
      $detailed ? '56px' : '36px'} minmax(0, 1fr);
  gap: ${({ $detailed }) => ($detailed ? '14px' : '10px')};
  align-items: center;
  min-width: 0;
  max-width: 100%;
`

const logoBox = css<{ $detailed?: boolean }>`
  width: ${({ $detailed }) => ($detailed ? '56px' : '36px')};
  height: ${({ $detailed }) => ($detailed ? '56px' : '36px')};
  border-radius: ${({ $detailed }) =>
    $detailed ? 'var(--radius-lg)' : 'var(--radius)'};
  background: var(--color-raised);
  box-shadow:
    inset 0 0 0 1px var(--glass-border),
    inset 0 1px 0 var(--glass-highlight);
`

const ListReferenceLogo = styled.img<{ $detailed?: boolean }>`
  ${logoBox}
  display: block;
  object-fit: contain;
`

const ListReferenceFallbackLogo = styled.span<{ $detailed?: boolean }>`
  ${logoBox}
  display: inline-grid;
  place-items: center;
  color: var(--color-faint);
`

const ListReferenceText = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
`

/*
 * Detailed, the title takes the type of where it stands (a page title, a
 * field row); compact, it is a 14px row title.
 */
const titleText = css<{ $detailed?: boolean }>`
  max-width: 100%;
  overflow: hidden;
  color: var(--color-text);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  ${({ $detailed }) =>
    $detailed
      ? css`
          font: inherit;
          font-weight: 500;
          white-space: normal;
          overflow-wrap: anywhere;
        `
      : css`
          font-family: var(--font-sans);
          font-size: var(--fs-body);
          line-height: var(--lh-body);
          letter-spacing: -0.005em;
        `}
`

const ListReferenceTitle = styled.span<{ $detailed?: boolean }>`
  ${titleText}
`

/*
 * The title as the way into the list. It keeps the name's colour wherever it
 * stands (table cells and page titles colour their links) and shows it is a
 * link on hover, as the address under it does. In a list it sits above the
 * row's own link, so a click opens the list, not the entry.
 */
const ListReferenceLink = styled(Link)<{ $detailed?: boolean }>`
  && {
    ${titleText}
    text-decoration: none;
    /* In a row, a 24px tap target: the line itself is that tall. */
    ${({ $detailed }) =>
      !$detailed &&
      css`
        line-height: 24px;
      `}
  }

  &&:hover {
    color: var(--color-primary);
    text-decoration: underline;
  }
`

const ListReferenceMeta = styled.span`
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
`

/*
 * On an entry page the address under the list's name opens the explorer and
 * copies, as every address field does, but stays quieter than the name it
 * belongs to. Each line is a 24px tap target.
 */
const ListReferenceAddress = styled.span`
  display: inline-flex;
  min-width: 0;
  max-width: 100%;

  && a {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    color: var(--color-muted);
    font-weight: 400;
  }
`

/* A value that is not an address: shown as it is, with nothing to open. */
const ListReferenceRaw = styled.span`
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
`

const normalizeType = (type?: string) => String(type || '').toLowerCase()

const isImageField = (field: V2Field) =>
  normalizeType(field.type) === normalizeType(ItemTypes.IMAGE)

const isGtcrAddressField = (field: V2Field) =>
  normalizeType(field.type) === normalizeType(ItemTypes.GTCR_ADDRESS)

/** A contract address; anything else in a GTCR field has nothing to open. */
const isAddress = (value: string) => /^0x[0-9a-f]{40}$/i.test(value)

/**
 * A registry referenced from an entry (a "list of lists" entry, a badges
 * list's badge list): logo, title, address. The title opens the list in
 * Curate on the chain in the URL; on an entry page the address opens the
 * explorer.
 */
const V2ListReferenceField = ({
  address,
  detailed,
  showStakeBadge = true,
}: {
  address: string
  detailed?: boolean
  showStakeBadge?: boolean
}) => {
  const chainId = useUrlChainId()
  const { data: metaEvidence, isLoading } = useTcrMetaEvidence(
    address || undefined,
    chainId ?? undefined,
  )
  const { isPermanentList } = useCheckPermanentList(
    address || null,
    chainId ?? null,
    !!address && !!chainId,
  )
  const metadata = metaEvidence?.metadata
  const logoURI = metadata?.logoURI
  const title = metadata?.tcrTitle || metadata?.title
  const linked = isAddress(address)
  const listHref = linked && chainId ? `/tcr/${chainId}/${address}` : undefined

  return (
    <ListReference $detailed={detailed}>
      {logoURI ? (
        <ListReferenceLogo
          $detailed={detailed}
          src={parseIpfs(logoURI)}
          alt=""
        />
      ) : (
        <ListReferenceFallbackLogo $detailed={detailed} aria-hidden="true">
          <CurateIcon name="registry" size={detailed ? 22 : 16} />
        </ListReferenceFallbackLogo>
      )}
      <ListReferenceText>
        {title ? (
          listHref ? (
            <ListReferenceLink to={listHref} $detailed={detailed} title={title}>
              {title}
            </ListReferenceLink>
          ) : (
            <ListReferenceTitle $detailed={detailed} title={title}>
              {title}
            </ListReferenceTitle>
          )
        ) : isLoading ? (
          <SkeletonBlock $width="120px" $height="14px" />
        ) : (
          // A list whose metadata did not load still opens: the link says so.
          listHref && (
            <ListReferenceLink to={listHref} $detailed={detailed}>
              Open list
            </ListReferenceLink>
          )
        )}
        <ListReferenceMeta>
          {/* In a row the title is the one way in: a second link stacked
              under it would be too close to tap apart. On the entry page
              the address opens the explorer. */}
          {linked && detailed ? (
            <ListReferenceAddress>
              <ETHAddress address={address} />
            </ListReferenceAddress>
          ) : (
            <ListReferenceRaw title={address}>
              {truncateMiddle(address, 6, 4)}
            </ListReferenceRaw>
          )}
          {showStakeBadge && isPermanentList && <Chip>Stake Curate</Chip>}
        </ListReferenceMeta>
      </ListReferenceText>
    </ListReference>
  )
}

/** One field rendered by type; `detailed` adds the label and the large image. */
export const V2FieldDisplay = ({
  field,
  detailed = false,
  showStakeBadge = true,
}: {
  field: V2Field
  detailed?: boolean
  showStakeBadge?: boolean
}) => {
  const value = field.value as string | number | boolean | null | undefined

  if (isGtcrAddressField(field) && value)
    return (
      <FieldWrap $inherit={detailed}>
        <V2ListReferenceField
          address={String(value)}
          detailed={detailed}
          showStakeBadge={showStakeBadge}
        />
      </FieldWrap>
    )

  if (isImageField(field) && value)
    return (
      <FieldWrap $image>
        <Thumb
          large={detailed}
          src={parseIpfs(String(value))}
          alt={field.label || 'Entry image'}
        />
      </FieldWrap>
    )

  return (
    <FieldWrap>
      {detailed && field.label && (
        <FieldLabel $muted>{field.label}:</FieldLabel>
      )}
      <DisplaySelector
        type={field.type || ItemTypes.TEXT}
        value={value}
        allowedFileTypes={field.allowedFileTypes as string}
        truncateLinks={!detailed}
        linkImage
      />
    </FieldWrap>
  )
}
