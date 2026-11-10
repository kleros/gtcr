import * as yup from 'yup'
import { ItemTypes } from '@kleros/gtcr-encoder'
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

const address = (message: string) =>
  yup
    .string()
    .required(message)
    .max(42, 'Ethereum addresses are 42 characters long.')

const amount = yup
  .number()
  .typeError('Amount should be a number.')
  .required('A value is required.')
  .min(0, 'The amount must not be negative.')
  .test(
    'finite',
    'Amount should be a number.',
    (value) => value === undefined || Number.isFinite(value),
  )

const multiplier = yup
  .number()
  .typeError('Amount should be a number.')
  .min(0, 'The stake multiplier cannot be negative.')
  .required('A value is required')

const TCR_FIELDS: Record<FactorySection, Record<string, yup.AnySchema>> = {
  title: {
    tcrTitle: yup
      .string()
      .required('A title is required.')
      .max(40, 'Title must be less than 40 characters long.'),
  },
  description: {
    tcrDescription: yup
      .string()
      .required('A description is required.')
      .max(255, 'Description must be less than 255 characters long.'),
  },
  logo: {
    tcrLogo: yup.string().required('A logo is required.'),
  },
  policy: {
    tcrPrimaryDocument: yup
      .string()
      .required('A primary document is required.'),
  },
  token: {
    tokenAddress: address('A stake token address is required.'),
  },
  stake: {
    arbitratorAddress: address('An arbitrator address is required.'),
    arbitratorExtraData: yup
      .string()
      .required('The arbitrator extra data is required.'),
    governorAddress: address('A governor address is required.'),
    submissionMinDeposit: amount,
    submissionPeriodDuration: amount,
    reinclusionPeriodDuration: amount,
    withdrawingPeriodDuration: amount,
    arbitrationParamsCooldown: amount,
    challengeStakeMultiplier: multiplier,
    sharedStakeMultiplier: multiplier,
    winnerStakeMultiplier: multiplier,
    loserStakeMultiplier: multiplier,
  },
  custom: {
    itemName: yup
      .string()
      .required('An item name is required.')
      .max(20, 'The item name must be less than 20 characters long.'),
    itemNamePlural: yup
      .string()
      .required('The plural of the item name is required.')
      .max(20, 'The item name must be less than 20 characters long.'),
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
      allowedFileTypes: yup.string().when('type', {
        is: ItemTypes.FILE,
        then: (schema) =>
          schema.required('At least one file type is required.'),
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
  arbitrationParamsCooldown: 'the parameters cooldown',
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
      missing: true,
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
