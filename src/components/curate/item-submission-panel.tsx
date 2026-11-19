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
 * The entry's full details, all of it, in one place (the design review's
 * point 3: the fields used to be split between a page-long header of
 * identifiers and a separate "Details" box, and the cut between them
 * depended on the field's type, so the same list's fields landed in
 * different boxes).
 *
 * One panel, bands separated by space and hairlines: every picture and file
 * the entry has, then every field — identifiers included — then the list an
 * entry of a list of lists points to, then what this account can claim from
 * the entry's appeals. Nothing is reserved for a field the entry does not
 * have.
 *
 * The box is field-complete, so what the hero lifts out is here as well
 * (round 3: a box named "Full details" that was missing the two things the
 * page leads with). The hero's tile and the band draw the same picture, and
 * the title reads here as a labelled row under its own column name, which
 * is what the hero's display line cannot say.
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
   * picture and the title the page's hero lifts out keep their plate and
   * their row here, so the box is the whole submission.
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
  // Only the fields the band draws itself stay out of the rows below. The
  // title field is not one of them: the hero sets it large without saying
  // which column it is, so it reads here as a labelled row as well.
  const drawn = new Set<EntryField>([
    ...found.images.map((image) => image.field),
    ...found.files.map((file) => file.field),
  ])
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
        <PanelName>Full details</PanelName>
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
    <Panel id="item-submission" $padding="standard" aria-label="Full details">
      <Head>
        <PanelName>Full details</PanelName>
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
      <ItemMediaBand media={found} />
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
