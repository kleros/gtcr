import { describe, expect, it } from 'vitest'
import type * as yup from 'yup'
import { ItemTypes } from '@kleros/gtcr-encoder'
import type { TcrState } from '.'
import {
  type FactorySection,
  fullTcrSchema,
  incompleteSteps,
  relSchema,
  tcrSchemaFor,
} from './schemas'

const ARBITRATOR = '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002'
const GOVERNOR = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const EXTRA_DATA = `0x${'1'.padStart(64, '0')}${'3'.padStart(64, '0')}`

/** A typed amount as Formik stores it: the text, where the type says number. */
const typed = (text: string) => text as unknown as number

const listState = (overrides: Partial<TcrState> = {}): TcrState => ({
  tcrTitle: 'Tokens',
  tcrDescription: 'Tokens and their logos',
  tcrLogo: '/ipfs/QmLogo/logo.png',
  tcrPrimaryDocument: '/ipfs/QmPolicy/policy.pdf',
  itemName: 'token',
  itemNamePlural: 'tokens',
  requireRemovalEvidence: true,
  arbitratorAddress: ARBITRATOR,
  arbitratorExtraData: EXTRA_DATA,
  governorAddress: GOVERNOR,
  submissionBaseDeposit: 0.05,
  removalBaseDeposit: 0.05,
  submissionChallengeBaseDeposit: 0,
  removalChallengeBaseDeposit: 0,
  challengePeriodDuration: 84,
  sharedStakeMultiplier: 100,
  winnerStakeMultiplier: 100,
  loserStakeMultiplier: 200,
  isTCRofTCRs: false,
  relArbitratorAddress: ARBITRATOR,
  relArbitratorExtraData: EXTRA_DATA,
  relGovernorAddress: GOVERNOR,
  relSubmissionBaseDeposit: 0.05,
  relRemovalBaseDeposit: 0.05,
  relSubmissionChallengeBaseDeposit: 0,
  relRemovalChallengeBaseDeposit: 0,
  relChallengePeriodDuration: 84,
  relItemName: 'list',
  relItemNamePlural: 'lists',
  relRequireRemovalEvidence: true,
  relTcrPrimaryDocument: '/ipfs/QmBadges/badges.pdf',
  relSharedStakeMultiplier: 100,
  relWinnerStakeMultiplier: 100,
  relLoserStakeMultiplier: 200,
  columns: [
    {
      label: 'Name',
      description: 'The token name',
      type: ItemTypes.TEXT,
      isIdentifier: true,
    },
    { label: 'Logo', description: 'The token logo', type: ItemTypes.IMAGE },
  ],
  relColumns: [],
  currStep: 0,
  transactions: {},
  relTcrDisabled: false,
  ...overrides,
})

const refusal = (schema: yup.AnySchema, value: unknown) =>
  schema.validate(value).then(
    () => null,
    (err: yup.ValidationError) => err.message,
  )

describe('tcrSchemaFor', () => {
  it('takes a complete list', async () => {
    expect(await refusal(tcrSchemaFor(), listState())).toBeNull()
  })

  it('checks the whole list when no step is given', () => {
    expect(tcrSchemaFor()).toBe(fullTcrSchema)
  })

  it.each<[FactorySection, object]>([
    ['title', { tcrTitle: 'Tokens' }],
    ['description', { tcrDescription: 'Tokens and their logos' }],
    ['logo', { tcrLogo: '/ipfs/QmLogo/logo.png' }],
    ['policy', { tcrPrimaryDocument: '/ipfs/QmPolicy/policy.pdf' }],
    ['custom', { itemName: 'token', itemNamePlural: 'tokens' }],
  ])('checks only the %s step on its Next', async (section, values) => {
    expect(await refusal(tcrSchemaFor(section), values)).toBeNull()
    // The same values alone are far from a deployable list.
    expect(await refusal(tcrSchemaFor(), values)).not.toBeNull()
  })

  it.each([
    [
      'the arbitrator',
      { arbitratorAddress: '' },
      'An arbitrator address is required.',
    ],
    [
      'the governor',
      { governorAddress: '' },
      'A governor address is required.',
    ],
    [
      'the extra data',
      { arbitratorExtraData: '' },
      'The arbitrator extra data is required.',
    ],
    [
      'a negative deposit',
      { removalBaseDeposit: -1 },
      'The amount must not be negative.',
    ],
    // With no challenge period nothing can be challenged.
    [
      'no challenge period',
      { challengePeriodDuration: 0 },
      'Must be longer than 0.',
    ],
    [
      'a multiplier in thousandths of a percent',
      { loserStakeMultiplier: 12.345 },
      'Use at most two decimal places, like 12.5.',
    ],
  ])('the deposit step refuses %s', async (_, overrides, message) => {
    expect(await refusal(tcrSchemaFor('deposit'), listState(overrides))).toBe(
      message,
    )
  })

  it('reads typed amounts as the deploy does', async () => {
    const state = listState({
      submissionBaseDeposit: typed('0,05'),
      removalBaseDeposit: typed('1234,567'),
      challengePeriodDuration: typed('3,5'),
      sharedStakeMultiplier: typed('12,5'),
    })
    expect(await refusal(tcrSchemaFor('deposit'), state)).toBeNull()
  })
})

describe('relSchema', () => {
  it('takes a complete badges step', async () => {
    expect(await refusal(relSchema, listState())).toBeNull()
  })

  it.each([
    [
      'its own policy',
      { relTcrPrimaryDocument: '' },
      'Upload the badges listing policy.',
    ],
    [
      'a valid arbitrator',
      { relArbitratorAddress: '0x1234' },
      'Not a valid address: check it for a typo or a space.',
    ],
    [
      'a challenge period',
      { relChallengePeriodDuration: 0 },
      'Must be longer than 0.',
    ],
    [
      'a readable deposit',
      { relSubmissionBaseDeposit: typed('1,000') },
      'A comma before three digits could mean thousands: write 2.375 or 2375.',
    ],
  ])('needs %s', async (_, overrides, message) => {
    expect(await refusal(relSchema, listState(overrides))).toBe(message)
  })
})

describe('incompleteSteps', () => {
  it('is empty for a list ready to deploy', () => {
    expect(incompleteSteps(listState())).toEqual([])
  })

  it.each([
    ['an empty title', { tcrTitle: '' }],
    ['no logo', { tcrLogo: '' }],
    ['no policy', { tcrPrimaryDocument: '' }],
    ['an unreadable deposit', { submissionBaseDeposit: typed('1,000') }],
  ])('names the list details for %s', (_, overrides) => {
    expect(incompleteSteps(listState(overrides))).toEqual(['the list details'])
  })

  it.each([
    [
      'no identifier',
      [{ label: 'Name', description: 'The name', type: ItemTypes.TEXT }],
    ],
    [
      'two fields with one name',
      [
        {
          label: 'Name',
          description: 'The name',
          type: ItemTypes.TEXT,
          isIdentifier: true,
        },
        { label: 'Name', description: 'Again', type: ItemTypes.TEXT },
      ],
    ],
    [
      'a field with no description',
      [
        {
          label: 'Name',
          description: '',
          type: ItemTypes.TEXT,
          isIdentifier: true,
        },
      ],
    ],
    [
      'a file field with no types',
      [
        {
          label: 'Doc',
          description: 'A document',
          type: ItemTypes.FILE,
          isIdentifier: true,
          allowedFileTypes: '',
        },
      ],
    ],
  ])('names the item fields for %s', (_, columns) => {
    expect(incompleteSteps(listState({ columns }))).toEqual(['the item fields'])
  })

  it('does not ask a list of lists for an identifier', () => {
    const columns = [
      {
        label: 'Address',
        description: 'The list',
        type: ItemTypes.GTCR_ADDRESS,
      },
    ]
    expect(incompleteSteps(listState({ isTCRofTCRs: true, columns }))).toEqual(
      [],
    )
  })

  it('checks the badges step unless it is switched off', () => {
    const state = listState({ relTcrPrimaryDocument: '' })
    expect(incompleteSteps(state)).toEqual(['the badges step'])
    expect(incompleteSteps({ ...state, relTcrDisabled: undefined })).toEqual([
      'the badges step',
    ])
    expect(incompleteSteps({ ...state, relTcrDisabled: true })).toEqual([])
  })

  it('names every incomplete step, in the order of the wizard', () => {
    const state = listState({
      tcrTitle: '',
      columns: [],
      relGovernorAddress: '',
    })
    expect(incompleteSteps(state)).toEqual([
      'the list details',
      'the item fields',
      'the badges step',
    ])
  })
})
