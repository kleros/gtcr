import { ItemTypes } from '@kleros/gtcr-encoder'
import { parseIpfs } from './ipfs-parse'

/*
 * A list's MetaEvidence is written by whoever deploys or governs the list,
 * and its title and logo also show on other lists' pages: a list of lists,
 * an entry that names a list. A field of the wrong type (a title that is an
 * object, say) would reach React as a child and take that whole page down.
 * So string fields that are not strings are dropped, and columns keep the
 * shape the app reads.
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

/*
 * A column label as text. Never String() on an object: a JSON object can
 * carry its own "toString" key (1, say), and String() then throws.
 */
const labelText = (label: unknown): string =>
  typeof label === 'string'
    ? label
    : typeof label === 'number' || typeof label === 'boolean'
      ? String(label)
      : ''

/** Columns with the shape the app reads (also used for entry files). */
export const sanitizeColumns = (columns: unknown): Column[] | undefined =>
  Array.isArray(columns)
    ? columns.filter(isRecord).map(
        (column) =>
          ({
            ...column,
            label: labelText(column.label),
            type:
              typeof column.type === 'string' ? column.type : ItemTypes.TEXT,
            description:
              typeof column.description === 'string'
                ? column.description
                : undefined,
            // Read as text while the submit page draws a file field.
            allowedFileTypes:
              typeof column.allowedFileTypes === 'string'
                ? column.allowedFileTypes
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

/** How long a list's MetaEvidence file may take before the read fails. */
const META_EVIDENCE_TIMEOUT_MS = 20_000

/**
 * A list's MetaEvidence file from IPFS, sanitized. Throws (so React Query
 * retries, and the page can offer Try again) when the gateway errors or
 * hangs, or the file is not a MetaEvidence object.
 */
export const fetchMetaEvidenceFile = async (
  uri: string,
): Promise<MetaEvidence> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), META_EVIDENCE_TIMEOUT_MS)
  try {
    const response = await fetch(parseIpfs(uri), { signal: controller.signal })
    if (!response.ok)
      throw new Error(`The list file answered ${response.status}`)
    const file = sanitizeMetaEvidence(await response.json())
    if (!file) throw new Error('The list file is not a MetaEvidence file')
    return file
  } finally {
    clearTimeout(timer)
  }
}
