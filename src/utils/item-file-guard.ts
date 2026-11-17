import { displayableValue } from './display-value'
import { sanitizeColumns } from './meta-evidence-guard'

/*
 * A Standard or Stake entry is a file its submitter writes, read back from IPFS
 * when the indexer has no fields for it. Whatever is in it reaches the list
 * and entry pages of every visitor, so it gets the shape the app reads
 * before anything else touches it: columns as in a MetaEvidence (a label
 * and a type that are text), and values that are text, a number, a boolean
 * or null. A value that is an object (one with its own "toString" key makes
 * String() and join() throw) or a column type that is a number would
 * otherwise take the whole page down.
 */

export type ItemFileValue = string | number | boolean | null

export interface ItemFile {
  columns: Column[]
  /** Keyed by column label; no prototype, so any label is a plain key. */
  values: Record<string, ItemFileValue>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** The entry file with the shape the app reads, or null when it is not one. */
export const sanitizeItemFile = (file: unknown): ItemFile | null => {
  if (!isRecord(file)) return null
  const values: Record<string, ItemFileValue> = Object.create(null)
  if (isRecord(file.values))
    for (const [key, value] of Object.entries(file.values))
      values[key] = displayableValue(value) ?? null
  return { columns: sanitizeColumns(file.columns) ?? [], values }
}
