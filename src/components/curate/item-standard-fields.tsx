import React from 'react'
import styled from 'styled-components'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from 'components/display-selector'
import useUrlChainId from 'hooks/use-url-chain-id'
import { getAddressPage } from 'utils/network-utils'
import { displayableValue } from 'utils/display-value'
import { V2FieldDisplay, type V2Field } from './v2'
import { Data, Small, truncateMiddle } from './primitives'
import { ChromeAddress } from './chrome-address'

/*
 * A person on a Standard entry (the hero's By and Challenged by, and the
 * history's parties) is the app's one person control, CuratorAddress: it
 * opens their Curate profile, with copy beside it. The name is kept so the
 * entry page and the history timeline switched over without being edited.
 * It is for people only. A contract has an empty Curate profile, so a
 * contract takes ExplorerAddressLink below.
 */
export { CuratorAddress as AddressLink } from './chrome-address'

/*
 * A contract on a Standard entry, which today means the arbitrator. The
 * action card names it ("#123 at 0x…") when a case has no court page to
 * link to, because the arbitrator is not Kleros or the chain has no court
 * site. It is a ChromeAddress: it opens the chain explorer in a new tab and
 * carries the arrow that says so, with copy beside it. Without a chain in
 * the URL there is no explorer to open, so it is plain text with copy.
 */
export const ExplorerAddressLink = ({ address }: { address: string }) => {
  const chainId = useUrlChainId()
  return (
    <ChromeAddress
      address={address}
      display={truncateMiddle(address, 6, 4)}
      href={
        chainId ? getAddressPage({ networkId: chainId, address }) : undefined
      }
    />
  )
}

/*
 * Entry fields rendered by type (DESIGN.md: data is the hero, in mono where
 * it is data). Identifiers make the title of an entry; every field lands in
 * a key/value list on the item page.
 */

export type EntryField = V2Field

// A column type or a value from an entry's file may be anything: neither is
// passed to String() unless it is text, a number or a boolean.
const normalizeType = (type?: unknown) =>
  typeof type === 'string' ? type.toLowerCase() : ''

export const hasValue = (field: EntryField): boolean => {
  const value = displayableValue(field.value)
  return value !== undefined && value !== null && String(value) !== ''
}

export const isImageField = (field: EntryField) =>
  normalizeType(field.type) === normalizeType(ItemTypes.IMAGE)

export const isGtcrAddressField = (field: EntryField) =>
  normalizeType(field.type) === normalizeType(ItemTypes.GTCR_ADDRESS)

export const isAddressLikeField = (field: EntryField) =>
  normalizeType(field.type).includes('address')

const isMonoField = (field: EntryField) => {
  const type = normalizeType(field.type)
  return (
    type === normalizeType(ItemTypes.NUMBER) ||
    type === normalizeType(ItemTypes.ADDRESS) ||
    type === normalizeType(ItemTypes.RICH_ADDRESS)
  )
}

/** Identifier fields with a value, images excluded (they are not a title). */
const identifierFields = (fields: EntryField[]): EntryField[] =>
  fields.filter(
    (field) => field.isIdentifier && hasValue(field) && !isImageField(field),
  )

const isPlainTextField = (field: EntryField) =>
  [ItemTypes.TEXT, ItemTypes.LONG_TEXT]
    .map(normalizeType)
    .includes(normalizeType(field.type) || normalizeType(ItemTypes.TEXT))

/**
 * The field that names the entry, chosen as the list rows choose theirs: a
 * text identifier (a name reads better than a link or an address), else a
 * non-address identifier, else any identifier, else the first value.
 */
export const titleField = (fields: EntryField[]): EntryField | undefined => {
  const identifiers = identifierFields(fields)
  return (
    identifiers.find(isPlainTextField) ??
    identifiers.find((field) => !isAddressLikeField(field)) ??
    identifiers[0] ??
    fields.find((field) => hasValue(field) && !isImageField(field))
  )
}

const Mono = styled(Data)`
  overflow-wrap: anywhere;
`

const Plain = styled.span`
  overflow-wrap: anywhere;
  white-space: pre-line;
`

export const FieldValue = ({
  field,
  detailed = false,
}: {
  field: EntryField
  detailed?: boolean
}) => {
  if (!hasValue(field)) return <Small $faint>Not provided</Small>
  const type = normalizeType(field.type)
  const value = displayableValue(field.value) as string | number | boolean

  if (isGtcrAddressField(field))
    return <V2FieldDisplay detailed={detailed} field={field} showStakeBadge />
  if (type === normalizeType(ItemTypes.BOOLEAN))
    return <Data>{String(value) === 'true' ? 'Yes' : 'No'}</Data>
  if (type === normalizeType(ItemTypes.TEXT)) return <Plain>{value}</Plain>
  if (type === normalizeType(ItemTypes.NUMBER)) return <Mono>{value}</Mono>
  return (
    <ValueWrap $mono={isMonoField(field)}>
      <DisplaySelector
        type={field.type || ItemTypes.TEXT}
        value={value}
        allowedFileTypes={field.allowedFileTypes as string}
        truncateLinks={!detailed}
        linkImage
      />
    </ValueWrap>
  )
}

const ValueWrap = styled.span<{ $mono?: boolean }>`
  display: inline-block;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  font-family: ${({ $mono }) => ($mono ? 'var(--font-mono)' : 'inherit')};
  font-variant-numeric: tabular-nums;

  a {
    color: var(--color-primary);
  }
`

const FieldList = styled.dl`
  display: flex;
  flex-direction: column;
  margin: 0;
`

/* Labels sit on the first line of their value (a wrapped link, an image or
   a paragraph alike), so rows align on the top and the label takes the
   value's line height. The hairline is drawn inside the padding, straight
   and level with the text, so the rounded hover fill never bends it. */
const FieldRow = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: minmax(120px, 30%) minmax(0, 1fr);
  gap: 4px 24px;
  align-items: start;
  margin: 0 -12px;
  padding: 14px 12px;
  border-radius: var(--radius);
  transition: background var(--motion);

  & + &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 12px;
    left: 12px;
    height: 1px;
    background: var(--glass-border);
    pointer-events: none;
  }

  &:hover {
    background: var(--color-raised);
  }

  dt {
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: 22px;
  }

  dd {
    margin: 0;
    min-width: 0;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: 22px;
    overflow-wrap: anywhere;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;

    dt {
      line-height: var(--lh-small);
    }
  }
`

/** Every field as label/value, rendered by type. */
export const EntryFields = ({ fields }: { fields: EntryField[] }) => (
  <FieldList>
    {fields.map((field, index) => (
      <FieldRow key={`${field.label ?? 'field'}-${index}`}>
        <dt title={field.description || undefined}>
          {field.label || `Field ${index + 1}`}
        </dt>
        <dd>
          <FieldValue field={field} detailed />
        </dd>
      </FieldRow>
    ))}
  </FieldList>
)

export default EntryFields
