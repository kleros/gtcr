import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { useParams } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useAttachment } from 'hooks/use-attachment'
import { parseIpfs } from 'utils/ipfs-parse'
import { cssImageUrl } from 'utils/url-validation'
import SeerExtraDetails from 'components/custom-registries/seer/seer-item-details'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'
import { CurateIcon } from './icons'
import {
  Body,
  Button,
  ButtonLink,
  Chip,
  Data,
  IconButton,
  Row,
  SkeletonBlock,
  Small,
  Stack,
  Subheading,
  Surface,
  truncateMiddle,
} from './primitives'
import {
  EntryFields,
  isGtcrAddressField,
  type EntryField,
} from './item-standard-fields'
import { Notice } from './item-standard-notice'
import { ItemMediaBand, entryMedia } from './item-media-band'
import { ItemRewardWithdrawal } from './item-reward-withdrawal'

/*
 * The entry's submission, all of it, in one place (the design review's
 * point 3: the fields used to be split between a page-long header of
 * identifiers and a separate "Details" box, and the cut between them
 * depended on the field's type, so the same list's fields landed in
 * different boxes).
 *
 * One panel, bands separated by space and hairlines: the pictures and files
 * the entry actually has (less the one the hero's tile already shows), then
 * every field — identifiers included — less the one the page sets as its
 * heading, then the list an entry of a list of lists points to, then what
 * this account can claim from the entry's appeals. Nothing is reserved for
 * a field the entry does not have.
 */

const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
`

const PanelName = styled.h2`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.02em;
`

/* A divider under it only when fields follow; when only the actions do,
   their own top border is the one line. */
const RegistryBlock = styled.div<{ $divided: boolean }>`
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 16px;
  ${({ $divided }) =>
    $divided &&
    `
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border);
  `}

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

const LogoButton = styled.button<{ $image?: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: ${({ $image }) => {
    const image = cssImageUrl($image)
    return image ? `${image} center / contain no-repeat` : 'none'
  }};
  background-color: var(--color-raised);
  color: var(--color-faint);
  cursor: ${({ $image }) => ($image ? 'pointer' : 'default')};
  overflow: hidden;

  &:hover {
    border-color: var(--color-border-strong);
  }
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
  heading: headingField,
  skip,
  item,
  itemID,
  errors = [],
  retry,
  loading = false,
  linkedRegistry,
  registryAddress,
  kind = 'standard',
}: {
  /** Every field of the entry, with its value. */
  fields: EntryField[]
  /** The field the page sets as its heading: it is the title, not a row. */
  heading?: EntryField
  /**
   * The picture field the page draws in its hero (`heroImage`): it keeps no
   * plate in the band and no row of its own, so it appears once.
   */
  skip?: EntryField
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
  const { tcrAddress } = useParams()
  const urlChainId = useUrlChainId()
  const openAttachment = useAttachment()

  const { file: linkedFile, error: linkedError } = linkedRegistry || {}
  const { metadata: linkedMetadata, fileURI } = linkedFile || {}
  const { tcrTitle, tcrDescription, logoURI } = linkedMetadata || {}
  const linkedErrorMessage =
    linkedError instanceof Error ? linkedError.message : String(linkedError)
  const linkedAddress = linkedMetadata ? registryAddress : undefined
  const logo = logoURI ? parseIpfs(logoURI) : undefined

  const found = entryMedia(fields)
  const drawn = new Set<EntryField>([
    ...(headingField ? [headingField] : []),
    ...found.images.map((image) => image.field),
    ...found.files.map((file) => file.field),
  ])
  // The page's hero already shows one picture on its tile: the band leaves
  // it out, so the same image is never drawn twice (and a one-picture entry
  // gets no band at all).
  const media = skip
    ? {
        ...found,
        images: found.images.filter((image) => image.field !== skip),
      }
    : found
  const rows = fields.filter((field) => {
    if (drawn.has(field)) return false
    // The linked registry's block stands for its address field.
    if (linkedMetadata && isGtcrAddressField(field)) return false
    return true
  })

  const claim =
    kind === 'standard' ? <ItemRewardWithdrawal item={item} /> : null

  if (!loading && item && errors.length > 0)
    return (
      <Panel id="item-submission" $padding="standard">
        <PanelName>Submission</PanelName>
        {errors.map((error, index) => (
          <Notice key={index} tone="contested" role="alert">
            {error}
          </Notice>
        ))}
        {retry && <Row>{retry}</Row>}
        {claim}
      </Panel>
    )

  if (loading)
    return (
      <Panel id="item-submission" $padding="standard" aria-busy="true">
        <SkeletonBlock $height="18px" $width="40%" />
        <SkeletonBlock $height="20px" />
        <SkeletonBlock $height="20px" $width="70%" />
        <SkeletonBlock $height="20px" $width="55%" />
      </Panel>
    )

  return (
    <Panel id="item-submission" $padding="standard" aria-label="Submission">
      <Head>
        <PanelName>
          Submission
          {rows.length > 0 && <Chip>{rows.length}</Chip>}
        </PanelName>
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
      <ItemMediaBand media={media} />
      {linkedMetadata && (
        <RegistryBlock $divided={rows.length > 0}>
          <LogoButton
            type="button"
            $image={logo}
            disabled={!logo}
            aria-label="Open registry logo"
            onClick={() => logo && openAttachment(logo)}
          >
            {!logo && <CurateIcon name="registry" size={24} />}
          </LogoButton>
          <Stack $gap={6}>
            <Subheading>{tcrTitle}</Subheading>
            {/* The address field stays out of the rows below (this block
                stands for it), so its address shows here. */}
            {linkedAddress && (
              <Data $mono $muted title={linkedAddress}>
                {truncateMiddle(linkedAddress, 8, 6)}
              </Data>
            )}
            {tcrDescription && <Body $muted>{tcrDescription}</Body>}
            {(fileURI || (linkedAddress && urlChainId)) && (
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
                {linkedAddress && urlChainId && (
                  <ButtonLink
                    to={`/tcr/${urlChainId}/${linkedAddress}`}
                    $variant="secondary"
                    $size="sm"
                  >
                    Open registry
                    <CurateIcon name="external" size={14} />
                  </ButtonLink>
                )}
              </Row>
            )}
          </Stack>
        </RegistryBlock>
      )}
      {rows.length > 0 && <EntryFields fields={rows} />}
      {tcrAddress !== undefined &&
        urlChainId !== null &&
        isSeerRegistry(tcrAddress, urlChainId) &&
        item &&
        typeof item.decodedData?.[0] === 'string' &&
        typeof item.decodedData?.[1] === 'string' && (
          <SeerExtraDetails
            chainId={urlChainId}
            contractAddress={item.decodedData[0]}
            imagesIpfsHash={item.decodedData[1]}
          />
        )}
      {claim}
    </Panel>
  )
}

export default ItemSubmissionPanel
