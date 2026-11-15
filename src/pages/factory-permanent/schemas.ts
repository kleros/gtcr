import * as yup from 'yup'
import { isAddress } from 'viem'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { normalizeDecimalInput } from 'utils/decimal-input'
import { fileTypesProblem } from 'pages/factory/file-types'
import type { TcrState } from '.'

/*
 * The Stake wizard's validation in one place. Each visual step checks only
 * its own fields when Next is pressed; together the sections are exactly the
 * list schema the wizard always had, and the deploy step re-checks the whole
 * state so nothing can be deployed half filled.
 */

export type FactorySection =
  | 'title'
  | 'description'
  | 'logo'
  | 'policy'
  | 'token'
  | 'stake'
  | 'custom'

// The deploy encodes addresses with viem, which refuses what isAddress
// refuses (a typo, a space, a wrong-case checksum), but only after the
// uploads: refused here, at the field, instead. No length rule: its message
// would speak first and hide this one, which names the likely cause.
const address = (message: string) =>
  yup
    .string()
    .required(message)
    .test(
      'address',
      'Not a valid address: check it for a typo or a space.',
      (value) => !value || isAddress(value),
    )

// Hex bytes, as the court picker writes them. viem encodes bytes without
// checking them, and pads an odd length into other extra data (another
// court or number of jurors).
const extraData = yup
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

const amount = yup
  .number()
  .transform(typedNumber)
  .typeError(NOT_A_NUMBER)
  .required('A value is required.')
  .min(0, 'The amount must not be negative.')
  .test(
    'finite',
    NOT_A_NUMBER,
    (value) => value === undefined || Number.isFinite(value),
  )
  // yup reads "1e3" as a number, but the deploy (parseUnits) would throw on
  // it after the uploads: only plain digits, with one dot or comma.
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
 * `positive` periods can't be 0: with no withdrawing period a submitter can
 * withdraw ahead of any challenge, so the stake is never at risk.
 */
const period = (positive: boolean) =>
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
const multiplier = yup
  .number()
  .transform(typedNumber)
  .typeError(NOT_A_NUMBER)
  .min(0, 'The stake multiplier cannot be negative.')
  .required('A value is required')
  .test(
    'basis-points',
    'Use at most two decimal places, like 12.5.',
    (value) =>
      value === undefined ||
      Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
  )

const TCR_FIELDS: Record<FactorySection, Record<string, yup.AnySchema>> = {
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
  token: {
    tokenAddress: address('A stake token address is required.'),
  },
  stake: {
    arbitratorAddress: address('An arbitrator address is required.'),
    arbitratorExtraData: extraData,
    governorAddress: address('A governor address is required.'),
    submissionMinDeposit: amount,
    submissionPeriodDuration: period(false),
    reinclusionPeriodDuration: period(false),
    withdrawingPeriodDuration: period(true),
    arbitrationParamsCooldown: period(false),
    challengeStakeMultiplier: multiplier,
    sharedStakeMultiplier: multiplier,
    winnerStakeMultiplier: multiplier,
    loserStakeMultiplier: multiplier,
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
}

export const fullTcrSchema = yup
  .object()
  .shape(Object.assign({}, ...Object.values(TCR_FIELDS)))

/** One visual step's schema, or the whole list schema without a step. */
export const tcrSchemaFor = (section?: FactorySection) =>
  section ? yup.object().shape(TCR_FIELDS[section]) : fullTcrSchema

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

/** The two checks the item step runs on Next, as a message or null. */
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

/** How the deploy blocker names each list field. */
const FIELD_LABELS: Record<string, string> = {
  tcrTitle: 'the name',
  tcrDescription: 'the description',
  tcrLogo: 'the logo',
  tcrPrimaryDocument: 'the policy',
  tokenAddress: 'the stake token',
  submissionMinDeposit: 'the minimum stake',
  arbitratorExtraData: 'the court',
  challengeStakeMultiplier: 'the challenger stake',
  submissionPeriodDuration: 'the submission period',
  reinclusionPeriodDuration: 'the reinclusion period',
  withdrawingPeriodDuration: 'the withdrawing period',
  arbitrationParamsCooldown: 'the cooldown',
  arbitratorAddress: 'the arbitrator',
  governorAddress: 'the governor',
  sharedStakeMultiplier: 'the shared appeal multiplier',
  winnerStakeMultiplier: 'the winner appeal multiplier',
  loserStakeMultiplier: 'the loser appeal multiplier',
  itemName: 'the item name',
  itemNamePlural: 'the plural item name',
}

const FIELD_ORDER = Object.keys(FIELD_LABELS)

/** One thing that stops the deploy: what it is and whether it is empty or wrong. */
export type DeployProblem = { path: string; label: string; missing: boolean }

const isBlank = (value: unknown) =>
  value === '' || value === undefined || value === null

/**
 * Every field that stops the deploy, in the order of the steps: the list
 * schema run in full (not stopping at the first error), then the entry
 * fields and the item step's two checks.
 */
export const deployProblems = (state: TcrState): DeployProblem[] => {
  const problems: DeployProblem[] = []
  try {
    fullTcrSchema.validateSync(state, { abortEarly: false })
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      const paths = new Set(
        (err.inner.length > 0 ? err.inner : [err]).map(
          (inner) => inner.path ?? '',
        ),
      )
      ;[...paths]
        .sort((a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b))
        .forEach((path) =>
          problems.push({
            path,
            label: FIELD_LABELS[path] ?? 'the list details',
            missing: isBlank(
              (state as unknown as Record<string, unknown>)[path],
            ),
          }),
        )
    }
  }

  const columns = state.columns ?? []
  if (
    columns.some(
      (column) => isBlank(column.label) || isBlank(column.description),
    )
  )
    problems.push({
      path: 'columns',
      label: 'a name and a description for every field',
      missing: true,
    })
  else if (!itemSchema.isValidSync(state))
    problems.push({
      path: 'columns',
      label: 'the file types of the file fields',
      // Empty ("Add …"), or naming a type entries cannot hold ("Fix …").
      missing: columns.some(
        (column) =>
          column.type === ItemTypes.FILE && isBlank(column.allowedFileTypes),
      ),
    })
  if (!columns.some((column) => column.isIdentifier))
    problems.push({
      path: 'columns',
      label: 'an identifier field',
      missing: true,
    })
  else if (itemColumnsProblem(columns) !== null)
    problems.push({
      path: 'columns',
      label: 'the duplicate field names',
      missing: false,
    })
  return problems
}

/** "a and b", with a serial comma when a part has its own "and". */
const clauseList = (items: string[]): string =>
  items.length > 1 && items.some((item) => item.includes(' and '))
    ? `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
    : listInProse(items)

/** "Add the logo, and fix the name before deploying", or '' when nothing blocks. */
export const deployBlocker = (problems: DeployProblem[]): string => {
  const add = clauseList(
    problems
      .filter((problem) => problem.missing)
      .map((problem) => problem.label),
  )
  const fix = clauseList(
    problems
      .filter((problem) => !problem.missing)
      .map((problem) => problem.label),
  )
  if (add && fix) return `Add ${add}, and fix ${fix} before deploying`
  if (add) return `Add ${add} before deploying`
  if (fix) return `Fix ${fix} before deploying`
  return ''
}

/** "a, b and c". */
export const listInProse = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
