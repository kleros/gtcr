import * as yup from 'yup'
import {
  LIST_SECTIONS,
  address,
  amount,
  extraData,
  itemColumnsProblem,
  itemSchema,
  multiplier,
  period,
} from 'components/curate/factory-shared-schemas'
import type { TcrState } from '.'

export {
  itemColumnsProblem,
  itemSchema,
  listInProse,
} from 'components/curate/factory-shared-schemas'

/*
 * The wizard's validation, in one place: each visual step validates only
 * its own fields when the user presses Next, and the deploy step re-checks
 * the whole state so nothing can be deployed with an empty title, logo or
 * policy. The field rules and the sections every list has are shared with
 * the Stake factory (factory-shared-schemas); the deposits and the badges
 * step are this factory's own.
 */

export type FactorySection =
  | 'title'
  | 'description'
  | 'logo'
  | 'policy'
  | 'deposit'
  | 'custom'

const TCR_FIELDS: Record<FactorySection, Record<string, yup.AnySchema>> = {
  ...LIST_SECTIONS,
  deposit: {
    arbitratorAddress: address('An arbitrator address is required.'),
    arbitratorExtraData: extraData,
    governorAddress: address('A governor address is required.'),
    submissionBaseDeposit: amount,
    removalBaseDeposit: amount,
    submissionChallengeBaseDeposit: amount,
    removalChallengeBaseDeposit: amount,
    challengePeriodDuration: period(true),
    sharedStakeMultiplier: multiplier,
    winnerStakeMultiplier: multiplier,
    loserStakeMultiplier: multiplier,
  },
}

export const fullTcrSchema = yup
  .object()
  .shape(Object.assign({}, ...Object.values(TCR_FIELDS)))

/** The schema for one visual step, or the whole list schema when no step is given. */
export const tcrSchemaFor = (section?: FactorySection) =>
  section ? yup.object().shape(TCR_FIELDS[section]) : fullTcrSchema

export const relSchema = yup.object().shape({
  relArbitratorAddress: address('An arbitrator address is required.'),
  relArbitratorExtraData: extraData,
  relGovernorAddress: address('A governor address is required.'),
  relSubmissionBaseDeposit: amount,
  relRemovalBaseDeposit: amount,
  relSubmissionChallengeBaseDeposit: amount,
  relRemovalChallengeBaseDeposit: amount,
  relChallengePeriodDuration: period(true),
  relTcrPrimaryDocument: yup
    .string()
    .required('Upload the badges listing policy.'),
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
