import { Roles } from '@kleros/kleros-app'

/*
 * Atlas (Kleros' backend) stores every upload under a role, and each role
 * has a size limit and a list of file types it takes (the public `roles`
 * query, which useAtlasProvider exposes as roleRestrictions). The same rule
 * Atlas applies is checked when a file is picked, so a file it would refuse
 * is turned down at once, with what it takes, instead of after signing in.
 */

export type AtlasRole = {
  name: string
  restriction: { maxSize: number; allowedMimeTypes: string[] }
}

/** A role's limits, once Atlas has answered. */
export const atlasLimit = (role: Roles, restrictions?: AtlasRole[]) =>
  restrictions?.find(
    (entry) => Roles[entry.name as keyof typeof Roles] === role,
  )?.restriction

/** Atlas's own test: an exact type, or a whole family for "image/*". */
const accepts = (allowed: string, type: string) =>
  allowed.endsWith('/*')
    ? type.startsWith(allowed.slice(0, -1))
    : allowed === type

const TYPE_NAMES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/json': 'JSON',
  'text/plain': 'plain text',
  'text/markdown': 'Markdown',
  'text/csv': 'CSV',
  'image/*': 'any image',
  'video/*': 'any video',
}

/** "PDF, PNG or JPEG": the types a role takes, for people. */
export const describeTypes = (types: string[]): string => {
  const names = [
    ...new Set(
      types.map(
        (type) =>
          TYPE_NAMES[type] ??
          (type.split('/')[1] ?? type).replace(/^x-/, '').toUpperCase(),
      ),
    ),
  ]
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
    : (names[0] ?? '')
}

/** "20 MB", "400 KB". */
export const formatLimit = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
    : `${Math.round(bytes / 1024)} KB`

/** Why Atlas would refuse this file for this role; '' if it takes it or has not said. */
export const atlasUploadProblem = (
  file: File,
  role: Roles,
  restrictions?: AtlasRole[],
): string => {
  const limit = atlasLimit(role, restrictions)
  if (!limit) return ''
  if (!limit.allowedMimeTypes.some((allowed) => accepts(allowed, file.type)))
    return `This file type is not accepted here. Use ${describeTypes(limit.allowedMimeTypes)}.`
  if (file.size > limit.maxSize)
    return `The file is too big: the limit is ${formatLimit(limit.maxSize)}.`
  return ''
}

/** The toast for a failed upload, naming the reason when there is one. */
export const uploadFailure = (error: unknown): string => {
  const { name, message } = (error ?? {}) as { name?: string; message?: string }
  if (name === 'AuthorizationError')
    return 'Your sign-in expired. Sign in again, then pick the file again.'
  if (message === 'Unsupported file type.')
    return 'File upload failed: this file type is not accepted here.'
  const tooBig = message?.match(/max allowed size\s*:\s*([\d.]+)\s*mb/i)
  if (tooBig)
    return `File upload failed: the file is too big (the limit is ${Number(tooBig[1])} MB).`
  return message ? `File upload failed: ${message}` : 'File upload failed.'
}
