import { getExtension, getType } from 'mime'

/*
 * A file column's allowed types, one rule for the submit page and the entry
 * pages' dialogs. List creators type them freely: "pdf doc", ".pdf", "PDF"
 * and "pdf, png" all name the same formats. A type's canonical extension is
 * not enough to tell a file by: image/jpeg reads "jpeg", text/markdown
 * "markdown", audio/mpeg "mpga", so a list asking for jpg, md or mp3 would
 * refuse exactly those files.
 */

/** The column's extensions, lowercase and without dots. None means any type. */
export const allowedExtensions = (allowedFileTypes?: string | null): string[] =>
  (allowedFileTypes ?? '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((ext) => ext.replace(/^\.+/, ''))
    .filter(Boolean)

/** ".pdf, .doc" */
export const extensionList = (allowed: string[]): string =>
  allowed.map((ext) => `.${ext}`).join(', ')

/**
 * Why the column refuses this file, or '' when it takes it: the file's name
 * ends in an allowed extension, its type's canonical extension is one, or
 * its type is the type of one (a .jpeg photo on a list asking for jpg).
 */
export const fileTypeProblem = (file: File, allowed: string[]): string => {
  if (allowed.length === 0) return ''
  const dot = file.name.lastIndexOf('.')
  const own = dot === -1 ? '' : file.name.slice(dot + 1).toLowerCase()
  const canonical = getExtension(file.type) ?? ''
  if (
    allowed.includes(own) ||
    allowed.includes(canonical) ||
    (!!file.type && allowed.some((ext) => getType(ext) === file.type))
  )
    return ''
  return `Allowed file types: ${extensionList(allowed)}.`
}
