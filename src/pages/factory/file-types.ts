import { getExtension, getType } from 'mime'
import { ItemTypes } from '@kleros/gtcr-encoder'

/*
 * The "Allowed file types" of a file field, deployed with the list. Atlas
 * stores entry files only in the types below (the CurateItemFile role of its
 * roles query), so any other type would make a field nobody can fill. The
 * submit form checks a picked file by its type's own extension
 * (getExtension: "jpeg" for every JPEG, "markdown" for .md), so each
 * extension is stored with that one beside it: "jpg" alone would refuse
 * every JPEG.
 */

/** The types Atlas takes for entry files. */
export const ENTRY_FILE_TYPES = [
  'image/*',
  'video/*',
  'application/pdf',
  'application/json',
  'text/plain',
  'text/markdown',
  'text/csv',
]

const ENTRY_FILE_KINDS = 'images, videos, PDF, JSON, text, Markdown or CSV'

/** Atlas's own test: an exact type, or a whole family for "image/*". */
const accepted = (type: string) =>
  ENTRY_FILE_TYPES.some((allowed) =>
    allowed.endsWith('/*')
      ? type.startsWith(allowed.slice(0, -1))
      : allowed === type,
  )

/** The type an extension names, if entries can hold it. */
const entryType = (extension: string): string | null => {
  if (!/^[a-z0-9]+$/.test(extension)) return null
  const type = getType(extension)
  return type && accepted(type) ? type : null
}

/** ".PDF, png" → ["pdf", "png"]: lower case, no dots, split on spaces and commas, once each. */
export const fileTypeList = (text: unknown): string[] => [
  ...new Set(
    String(text ?? '')
      .toLowerCase()
      .split(/[\s,]+/)
      .map((extension) => extension.replace(/^\.+/, ''))
      .filter(Boolean),
  ),
]

/**
 * The field's value as stored: the extensions space-separated, each one
 * entries can hold followed by its type's own extension ("jpg jpeg").
 * Extensions entries cannot hold stay, for the field's error to name.
 */
export const normalizeFileTypes = (text: unknown): string => {
  const stored: string[] = []
  for (const extension of fileTypeList(text)) {
    if (!stored.includes(extension)) stored.push(extension)
    const type = entryType(extension)
    const own = type ? getExtension(type) : null
    if (own && !stored.includes(own)) stored.push(own)
  }
  return stored.join(' ')
}

/** Why a file field's types cannot be deployed, or '' when they can. */
export const fileTypesProblem = (text: unknown): string => {
  const extensions = fileTypeList(text)
  if (extensions.length === 0) return 'At least one file type is required.'
  const refused = extensions.filter((extension) => !entryType(extension))
  if (refused.length === 0) return ''
  const named =
    refused.length > 1
      ? `${refused.slice(0, -1).join(', ')} or ${refused[refused.length - 1]}`
      : refused[0]
  return `Entries cannot hold ${named} files: use ${ENTRY_FILE_KINDS}.`
}

/** The columns as deployed: every file field with its types stored as normalizeFileTypes writes them. */
export const withNormalizedFileTypes = (columns: Column[]): Column[] =>
  columns.map((column) =>
    column.type === ItemTypes.FILE
      ? {
          ...column,
          allowedFileTypes: normalizeFileTypes(column.allowedFileTypes),
        }
      : column,
  )
