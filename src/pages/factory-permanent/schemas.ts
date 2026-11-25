import * as yup from 'yup'
import { ItemTypes } from '@kleros/gtcr-encoder'
import {
  LIST_SECTIONS,
  address,
  amount,
  extraData,
  itemColumnsProblem,
  itemSchema,
  listInProse,
  multiplier,
  period,
} from 'components/curate/factory-shared-schemas'
import type { TcrState } from '.'

export {
  itemColumnsProblem,
  itemSchema,
} from 'components/curate/factory-shared-schemas'

/*
 * The Stake wizard's validation in one place. Each visual step checks only
 * its own fields when Next is pressed; together the sections are exactly the
 * list schema the wizard always had, and the deploy step re-checks the whole
 * state so nothing can be deployed half filled. The field rules and the
 * sections every list has are shared with the classic factory
 * (factory-shared-schemas); the stake token and the stake are this
 * factory's own.
 */

export type FactorySection =
  | 'title'
  | 'description'
  | 'logo'
  | 'policy'
  | 'token'
  | 'stake'
  | 'custom'

const TCR_FIELDS: Record<FactorySection, Record<string, yup.AnySchema>> = {
  ...LIST_SECTIONS,
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
}

export const fullTcrSchema = yup
  .object()
  .shape(Object.assign({}, ...Object.values(TCR_FIELDS)))

/** One visual step's schema, or the whole list schema without a step. */
export const tcrSchemaFor = (section?: FactorySection) =>
  section ? yup.object().shape(TCR_FIELDS[section]) : fullTcrSchema

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
