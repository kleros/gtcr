import { ItemTypes } from '@kleros/gtcr-encoder'

/*
 * A list's MetaEvidence is written by whoever deploys or governs the list,
 * and its title and logo also show on other lists' pages: a list of lists,
 * a badge, an entry that names a list. A field of the wrong type (a title
 * that is an object, say) would reach React as a child and take that whole
 * page down. So string fields that are not strings are dropped, and columns
 * keep the shape the app reads.
 */

const STRING_FIELDS = [
  'title',
  'description',
  'itemName',
  'itemNamePlural',
  'fileURI',
  'evidenceDisplayInterfaceURI',
] as const

const METADATA_STRING_FIELDS = [
  'tcrTitle',
  'tcrDescription',
  'title',
  'description',
  'itemName',
  'itemNamePlural',
  'logoURI',
  'policyURI',
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const withStrings = (
  record: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> => {
  const next = { ...record }
  for (const key of keys)
    if (key in next && typeof next[key] !== 'string') delete next[key]
  return next
}

const sanitizeColumns = (columns: unknown): Column[] | undefined =>
  Array.isArray(columns)
    ? columns.filter(isRecord).map(
        (column) =>
          ({
            ...column,
            label:
              typeof column.label === 'string'
                ? column.label
                : String(column.label ?? ''),
            type:
              typeof column.type === 'string' ? column.type : ItemTypes.TEXT,
            description:
              typeof column.description === 'string'
                ? column.description
                : undefined,
          }) as Column,
      )
    : undefined

/** The file with every field the app renders as text holding text, or null. */
export const sanitizeMetaEvidence = (file: unknown): MetaEvidence | null => {
  if (!isRecord(file)) return null
  const next = withStrings(file, STRING_FIELDS)
  if ('columns' in next) next.columns = sanitizeColumns(next.columns)
  if (isRecord(next.metadata)) {
    const metadata = withStrings(next.metadata, METADATA_STRING_FIELDS)
    if ('columns' in metadata)
      metadata.columns = sanitizeColumns(metadata.columns)
    next.metadata = metadata
  } else delete next.metadata
  return next as MetaEvidence
}
