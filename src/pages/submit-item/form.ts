import { ItemTypes, typeDefaultValues } from '@kleros/gtcr-encoder'
import { namespaces, parseRichAddress } from 'utils/rich-address'

/*
 * Form plumbing shared by the three registry kinds: the value shape the
 * encoders and `resolveStashedFiles` expect, the defaults the submit modals
 * use, and the validation rules (format checks for addresses and links,
 * plus the "deployed with a list creator" check for GTCR address columns).
 */

/** A field holds a string, or a File while an upload is stashed. */
export type FieldValue = string | File
export type SubmissionValues = Record<string, FieldValue>
export type SubmissionErrors = Record<string, string>

export type RegistryExistsCheck = (tcrAddress: string) => Promise<boolean>

export interface FactoryChecks {
  deployedWithFactory: RegistryExistsCheck
  deployedWithLightFactory: RegistryExistsCheck
  deployedWithPermanentFactory: RegistryExistsCheck
}

export const isRequired = (column: Column): boolean =>
  column.type !== ItemTypes.BOOLEAN && !column.optional

export const isEmptyValue = (value: FieldValue | undefined): boolean =>
  value === undefined || (typeof value === 'string' && value.trim() === '')

/**
 * Column-aware emptiness: a rich address whose chain was picked but whose
 * address is still blank ("eip155:1:") counts as empty.
 */
export const isEmptyField = (
  column: Column,
  value: FieldValue | undefined,
): boolean => {
  if (isEmptyValue(value)) return true
  if (column.type === ItemTypes.RICH_ADDRESS && typeof value === 'string') {
    const parsed = parseRichAddress(value)
    return !!parsed && parsed.address.trim() === ''
  }
  return false
}

/**
 * Same defaults as the submit modals. A missing initial value falls back to
 * the column type's default instead of the string "undefined".
 */
export const buildInitialValues = (
  columns: Column[],
  initialValues?: unknown[],
): SubmissionValues => {
  const values: SubmissionValues = {}
  for (const [index, column] of columns.entries()) {
    const provided = initialValues?.[index]
    // NUMBER and TWITTER_USER_ID default to 0 in the encoder, which would
    // count as a filled-in required field; they start blank instead.
    const fallback =
      column.type === ItemTypes.NUMBER ||
      column.type === ItemTypes.TWITTER_USER_ID
        ? ''
        : (typeDefaultValues[column.type] ?? '')
    values[column.label] = String(provided ?? fallback)
  }
  return values
}

/** How many required columns are still empty (the modals' "fields complete" rule). */
export const missingRequired = (
  columns: Column[],
  values: SubmissionValues,
): number =>
  columns.filter(
    (column) =>
      isRequired(column) && isEmptyField(column, values[column.label]),
  ).length

/** Blank rich addresses that only carry a chain ("eip155:1:") are sent as empty. */
export const normaliseValues = (
  columns: Column[],
  values: SubmissionValues,
): SubmissionValues => {
  const next: SubmissionValues = { ...values }
  for (const column of columns)
    if (
      column.type === ItemTypes.RICH_ADDRESS &&
      typeof next[column.label] === 'string' &&
      isEmptyField(column, next[column.label])
    )
      next[column.label] = ''
  return next
}

const isEvmAddress = (value: string): boolean => namespaces[0].test(value)

/** An http(s) link to a named host: "https://example.org/path". */
const isWebLink = (value: string): boolean => {
  try {
    const { protocol, hostname } = new URL(value)
    return (
      (protocol === 'https:' || protocol === 'http:') && hostname.includes('.')
    )
  } catch {
    return false
  }
}

/**
 * A link typed without its scheme ("example.org/app") gets "https://"; any
 * other value is returned unchanged for validation to judge.
 */
export const withWebScheme = (value: string): string => {
  const text = value.trim()
  if (
    !text ||
    /\s/.test(text) ||
    !text.includes('.') ||
    /^[a-z][a-z\d+.-]*:/i.test(text)
  )
    return value
  return `https://${text.replace(/^\/+/, '')}`
}

export const validateSubmission = async (
  columns: Column[],
  values: SubmissionValues,
  checks: FactoryChecks,
): Promise<SubmissionErrors> => {
  const errors: SubmissionErrors = {}

  for (const column of columns) {
    const value = values[column.label]
    if (isRequired(column) && isEmptyField(column, value)) {
      errors[column.label] = 'Required.'
      continue
    }
    if (typeof value !== 'string' || isEmptyField(column, value)) continue
    if (
      (column.type === ItemTypes.ADDRESS ||
        column.type === ItemTypes.GTCR_ADDRESS) &&
      !isEvmAddress(value)
    )
      errors[column.label] =
        'Enter a valid address: 0x followed by 40 hex characters.'
    if (
      column.type === ItemTypes.RICH_ADDRESS &&
      !parseRichAddress(value)?.passedTest
    )
      errors[column.label] = 'Enter a valid address for the selected chain.'
    if (column.type === ItemTypes.LINK && !isWebLink(value.trim()))
      errors[column.label] = 'Enter a full link starting with https://'
  }

  // A list address must have been deployed by one of the list creators
  // (classic, light or permanent): the same check the submit modals run.
  await Promise.all(
    columns
      .filter(
        (column) =>
          column.type === ItemTypes.GTCR_ADDRESS &&
          !errors[column.label] &&
          typeof values[column.label] === 'string' &&
          values[column.label] !== '',
      )
      .map(async (column) => {
        const address = values[column.label] as string
        const deployed =
          (await checks.deployedWithFactory(address)) ||
          (await checks.deployedWithLightFactory(address)) ||
          (await checks.deployedWithPermanentFactory(address))
        if (!deployed)
          errors[column.label] =
            'This address was not deployed with the list creator.'
      }),
  )

  return errors
}
