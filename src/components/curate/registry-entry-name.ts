import type { V2Field } from './v2'

/*
 * What a drawing calls an entry: the value the list's first column shows, so
 * a lane on the Standard page and a lane on the Stake page name their
 * entries the way their rows do. Both registry summaries read it from the
 * entry's own fields (registry-stake-summary.ts,
 * registry-standard-summary.ts).
 */

const isTextType = (type?: string) =>
  !type || ['text', 'long text', 'address', 'rich address'].includes(type)

const isNamingType = (type?: string) =>
  !type || !['image', 'file', 'boolean', 'link'].includes(type)

/**
 * The entry's first identifying field (a bare number keeps its label,
 * "Agent number 1143"), else its first text field.
 */
export const entryName = (props: V2Field[] | undefined): string | undefined => {
  const named = (props ?? []).filter(
    (prop) =>
      prop.value !== undefined &&
      prop.value !== null &&
      typeof prop.value !== 'object' &&
      String(prop.value).trim() !== '',
  )
  const pick =
    named.find(
      (prop) => prop.isIdentifier && isNamingType(prop.type?.toLowerCase()),
    ) ?? named.find((prop) => isTextType(prop.type?.toLowerCase()))
  if (!pick) return undefined
  const value = String(pick.value).trim()
  return /^\d+$/.test(value) && pick.label ? `${pick.label} ${value}` : value
}

export default entryName
