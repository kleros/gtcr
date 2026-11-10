import * as yup from 'yup'
import { ItemTypes } from '@kleros/gtcr-encoder'
import type { TcrState } from '.'

/*
 * The wizard's validation, in one place: each visual step validates only
 * its own fields when the user presses Next, and the deploy step re-checks
 * the whole state so nothing can be deployed with an empty title, logo or
 * policy. The rules are the ones the previous wizard declared.
 */

export type FactorySection =
  | 'title'
  | 'description'
  | 'logo'
  | 'policy'
  | 'deposit'
  | 'custom'

const address = (what: string) =>
  yup
    .string()
    .required(`${what} address is required.`)
    .max(42, 'Ethereum addresses are 42 characters long.')

const amount = yup
  .number()
  .typeError('Amount should be a number.')
  .required('A value is required.')
  .min(0, 'The amount must not be negative.')

const multiplier = yup
  .number()
  .typeError('Amount should be a number.')
  .min(0, 'The stake multiplier cannot be negative.')
  .required('A value is required.')

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
  deposit: {
    arbitratorAddress: address('An arbitrator'),
    arbitratorExtraData: yup
      .string()
      .required('The arbitrator extra data is required.'),
    governorAddress: address('A governor'),
    submissionBaseDeposit: amount,
    removalBaseDeposit: amount,
    submissionChallengeBaseDeposit: amount,
    removalChallengeBaseDeposit: amount,
    challengePeriodDuration: amount,
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

/** The schema for one visual step, or the whole list schema when no step is given. */
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

/** The two checks the previous wizard ran on submit, as a message or null. */
export const itemColumnsProblem = (columns: Column[]): string | null => {
  if (!columns.some((column) => column.isIdentifier))
    return 'At least one ID field is required.'
  const usedLabels = new Set<string>()
  for (const column of columns) {
    if (usedLabels.has(column.label)) return 'Column names must be unique.'
    usedLabels.add(column.label)
  }
  return null
}

export const relSchema = yup.object().shape({
  relArbitratorAddress: address('An arbitrator'),
  relArbitratorExtraData: yup
    .string()
    .required('The arbitrator extra data is required.'),
  relGovernorAddress: address('A governor'),
  relSubmissionBaseDeposit: amount,
  relRemovalBaseDeposit: amount,
  relSubmissionChallengeBaseDeposit: amount,
  relRemovalChallengeBaseDeposit: amount,
  relChallengePeriodDuration: amount,
  relTcrPrimaryDocument: yup
    .string()
    .required('A primary document is required.'),
  relSharedStakeMultiplier: multiplier,
  relWinnerStakeMultiplier: multiplier,
  relLoserStakeMultiplier: multiplier,
})

/**
 * The steps that are not complete yet, named for the deploy blocker:
 * "Complete the list details and the badges step before deploying".
 */
export const incompleteSteps = (state: TcrState): string[] => {
  const problems: string[] = []
  if (!fullTcrSchema.isValidSync(state)) problems.push('the list details')
  if (
    !itemSchema.isValidSync(state) ||
    (!state.isTCRofTCRs && itemColumnsProblem(state.columns) !== null)
  )
    problems.push('the item fields')
  if (state.relTcrDisabled !== true && !relSchema.isValidSync(state))
    problems.push('the badges step')
  return problems
}

/** "a, b and c" for the blocker sentence. */
export const listInProse = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
