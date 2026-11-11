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

/**
 * The Formik path of a column's value. Formik reads a field name as a path,
 * so setFieldValue("No. of tokens", …) would store {No: {" of tokens": …}},
 * where nothing reads it. Quoted in brackets, the label is one key, the way
 * the form reads it.
 */
export const fieldPath = (label: string): string =>
  `["${label.replace(/["\\]/g, '\\$&')}"]`

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

/**
 * The values gtcrEncode gets for a Classic list. The encoder reads a boolean
 * column by truthiness, so the form's "false" (a string) would go on chain
 * as true; boolean columns get real booleans instead.
 */
export const encoderValues = (
  columns: Column[],
  values: Record<string, unknown>,
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...values }
  // Exactly what the switch and the review show as "Yes": "True" from a link
  // reads as No there, so it must not go on chain as true.
  for (const column of columns)
    if (column.type === ItemTypes.BOOLEAN)
      next[column.label] = String(values[column.label]) === 'true'
  return next
}

/**
 * Blank rich addresses that only carry a chain ("eip155:1:") are sent as
 * empty, and links as validated: without surrounding spaces.
 */
export const normaliseValues = (
  columns: Column[],
  values: SubmissionValues,
): SubmissionValues => {
  const next: SubmissionValues = { ...values }
  for (const column of columns) {
    const value = next[column.label]
    if (typeof value !== 'string') continue
    if (column.type === ItemTypes.RICH_ADDRESS && isEmptyField(column, value))
      next[column.label] = ''
    else if (column.type === ItemTypes.LINK) next[column.label] = value.trim()
  }
  return next
}

const isEvmAddress = (value: string): boolean => namespaces[0].test(value)

/**
 * The submit dialogs' address format checks, run for the whole form. Each
 * address input checks its own value too, but Formik runs a field's check only
 * while the field is on screen and the review step unmounts them: without this
 * a malformed address would be sent (stored as 0x0…12ab on a Classic list).
 * Like those inputs, an empty address does not pass, unless the list marks
 * the column optional.
 */
export const addressFormatErrors = (
  columns: Column[],
  values: Record<string, unknown>,
): SubmissionErrors => {
  const errors: SubmissionErrors = {}
  for (const column of columns) {
    const value = values[column.label]
    const text = typeof value === 'string' ? value : ''
    if (!text.trim() && !isRequired(column)) continue
    if (column.type === ItemTypes.ADDRESS && !isEvmAddress(text))
      errors[column.label] = 'Invalid format'
    else if (
      column.type === ItemTypes.RICH_ADDRESS &&
      !parseRichAddress(text)?.passedTest
    )
      errors[column.label] = 'Invalid format'
  }
  return errors
}

/**
 * A full link: anything the URL parser takes with a scheme (https, ipfs,
 * mailto…), since lists cite more than web pages and the previous dialog took
 * any text. Script and data URLs are refused; pages only make https clickable.
 */
const isFullLink = (value: string): boolean => {
  if (/\s/.test(value)) return false
  try {
    const { protocol } = new URL(value)
    return !['javascript:', 'data:', 'vbscript:'].includes(protocol)
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

const MAX_INT256 = 2n ** 255n - 1n
const MIN_INT256 = -(2n ** 255n)

/**
 * What gtcrEncode takes for a Classic number or Twitter user column: bn.js
 * reads it with every space removed, as digits with an optional leading
 * minus, and the encoder refuses anything outside an int256. "1.5", "1,000"
 * or "abc" make it throw, and a lone "-" would go on chain as 2^256.
 */
export const integerProblem = (value: string): string | undefined => {
  const digits = value.replace(/\s+/g, '')
  if (!/^-?\d+$/.test(digits)) return 'Enter a whole number, like 42.'
  const number = BigInt(digits)
  if (number > MAX_INT256 || number < MIN_INT256)
    return 'This number is too large for the list to store.'
  return undefined
}

export const validateSubmission = async (
  columns: Column[],
  values: SubmissionValues,
  checks: FactoryChecks,
  /** Number columns go on chain as integers (Classic lists encode them). */
  wholeNumbers = false,
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
      wholeNumbers &&
      (column.type === ItemTypes.NUMBER ||
        column.type === ItemTypes.TWITTER_USER_ID)
    ) {
      const problem = integerProblem(value)
      if (problem) errors[column.label] = problem
    }
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
    if (column.type === ItemTypes.LINK && !isFullLink(value.trim()))
      errors[column.label] = 'Enter a full link, like https://example.org'
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
