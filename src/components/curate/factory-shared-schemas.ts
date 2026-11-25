import * as yup from 'yup'
import { isAddress } from 'viem'
import { ItemTypes } from '@kleros/gtcr-encoder'
import {
  AMBIGUOUS_COMMA,
  isAmbiguousComma,
  normalizeDecimalInput,
} from 'utils/decimal-input'
import { fileTypesProblem } from 'pages/factory/file-types'

/*
 * The validation both list factories (classic and Stake) share: the field
 * rules (addresses, extra data, amounts, periods, multipliers) as the deploy
 * will read the values, the list sections every list has (name,
 * description, logo, policy, item name) and the entry fields' rules. Each
 * factory's own schemas add its own sections (deposits and badges; the
 * stake token and the stake) and its deploy checks.
 */

// The deploy encodes addresses with viem, which refuses what isAddress
// refuses (a typo, a space, a wrong-case checksum), but only after the
// uploads: refused here, at the field, instead. No length rule: its message
// would speak first and hide this one, which names the likely cause.
export const address = (requiredMessage: string) =>
  yup
    .string()
    .required(requiredMessage)
    .test(
      'address',
      'Not a valid address: check it for a typo or a space.',
      (value) => !value || isAddress(value),
    )

// Hex bytes, as the court picker writes them. viem encodes bytes without
// checking them, and pads an odd length into other extra data (another
// court or number of jurors).
export const extraData = yup
  .string()
  .required('The arbitrator extra data is required.')
  .matches(
    /^0x(?:[0-9a-fA-F]{2})*$/,
    'Extra data is hex bytes: 0x, then pairs of 0-9 and a-f.',
  )

/**
 * A typed number as the deploy reads it: one comma with no dot is the
 * decimal point ("0,5", as decimal keypads write it in many regions), while
 * "1,000" stays unreadable instead of becoming 1. An emptied field is a
 * missing value.
 */
const typedNumber = (value: unknown, raw: unknown) => {
  if (typeof raw !== 'string') return value
  const text = normalizeDecimalInput(raw)
  return text === '' ? undefined : Number(text)
}

const NOT_A_NUMBER =
  'Use a plain number like 1000 or 0.5; a dot or a comma marks decimals.'

/** The refusal, or the reason a comma was not read ("2,375": thousands?). */
const notANumber = ({ originalValue }: { originalValue?: unknown }) =>
  typeof originalValue === 'string' && isAmbiguousComma(originalValue)
    ? AMBIGUOUS_COMMA
    : NOT_A_NUMBER

export const amount = yup
  .number()
  .transform(typedNumber)
  .typeError(notANumber)
  .required('A value is required.')
  .min(0, 'The amount must not be negative.')
  .test(
    'finite',
    NOT_A_NUMBER,
    (value) => value === undefined || Number.isFinite(value),
  )
  // yup reads "1e3" as a number, but the deploy (parseEther, or parseUnits
  // for a stake) would throw on it after the uploads: only plain digits,
  // with one dot or comma.
  .test(
    'plain',
    'Use digits with one dot or comma for decimals, like 0.5.',
    function (value) {
      const raw = this.originalValue
      return (
        value === undefined ||
        typeof raw === 'number' ||
        /^\d+(\.\d+)?$/.test(normalizeDecimalInput(String(raw)))
      )
    },
  )

/** Ten years: longer periods are typos, and long cooldowns overflow. */
const MAX_PERIOD_HOURS = 87_600

/**
 * A duration in hours. The deploy sends hours × 3600 as whole seconds, so a
 * value that is not (0.123 h) would only fail there, after the uploads.
 * `positive` periods can't be 0: a 0 challenge period leaves no time to
 * challenge anything, and with no withdrawing period a submitter can
 * withdraw ahead of any challenge.
 */
export const period = (positive: boolean) =>
  amount
    .max(MAX_PERIOD_HOURS, 'Keep periods under ten years.')
    .test(
      'whole-seconds',
      'Use a duration that is a whole number of seconds.',
      (value) =>
        value === undefined ||
        Math.abs(value * 3600 - Math.round(value * 3600)) < 1e-6,
    )
    .test(
      'positive',
      'Must be longer than 0.',
      (value) => !positive || value === undefined || value > 0,
    )

/**
 * A percent. The contract takes basis points (hundredths of a percent) and
 * the deploy sends percent × 100, so a third decimal (12.345%) has no exact
 * value there.
 */
export const multiplier = yup
  .number()
  .transform(typedNumber)
  .typeError(notANumber)
  .min(0, 'The stake multiplier cannot be negative.')
  .required('A value is required.')
  .test(
    'basis-points',
    'Use at most two decimal places, like 12.5.',
    (value) =>
      value === undefined ||
      Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
  )

/** The list sections every list has, the same in both factories. */
export const LIST_SECTIONS = {
  title: {
    tcrTitle: yup
      .string()
      .required('A title is required.')
      .max(40, 'Keep the title to 40 characters or fewer.'),
  },
  description: {
    tcrDescription: yup
      .string()
      .required('A description is required.')
      .max(255, 'Keep the description to 255 characters or fewer.'),
  },
  logo: {
    tcrLogo: yup.string().required('A logo is required.'),
  },
  policy: {
    tcrPrimaryDocument: yup.string().required('Upload the listing policy.'),
  },
  custom: {
    itemName: yup
      .string()
      .required('An item name is required.')
      .max(20, 'Keep the item name to 20 characters or fewer.'),
    itemNamePlural: yup
      .string()
      .required('The plural of the item name is required.')
      .max(20, 'Keep the plural to 20 characters or fewer.'),
  },
} satisfies Record<string, Record<string, yup.AnySchema>>

export const itemSchema = yup.object().shape({
  columns: yup.array().of(
    yup.object().shape({
      label: yup.string().required('The column label is required.'),
      description: yup.string().required('The column description is required.'),
      // Types entries can hold (see file-types), deployed with the list.
      allowedFileTypes: yup.string().when('type', {
        is: ItemTypes.FILE,
        then: (schema) =>
          schema.test('file-types', '', (value, context) => {
            const problem = fileTypesProblem(value)
            return problem ? context.createError({ message: problem }) : true
          }),
      }),
    }),
  ),
})

/** The item step's two checks on Next (one identifier, unique names), as a message or null. */
export const itemColumnsProblem = (columns: Column[]): string | null => {
  if (!columns.some((column) => column.isIdentifier))
    return 'At least one identifier field is required.'
  const usedLabels = new Set<string>()
  for (const column of columns) {
    if (usedLabels.has(column.label)) return 'Field names must be unique.'
    usedLabels.add(column.label)
  }
  return null
}

/** "a, b and c". */
export const listInProse = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
