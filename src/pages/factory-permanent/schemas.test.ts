import { describe, expect, it } from 'vitest'
import type * as yup from 'yup'
import { ItemTypes } from '@kleros/gtcr-encoder'
import type { TcrState } from '.'
import {
  type DeployProblem,
  type FactorySection,
  deployBlocker,
  deployProblems,
  fullTcrSchema,
  tcrSchemaFor,
} from './schemas'

const ARBITRATOR = '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002'
const GOVERNOR = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
// sDAI on Gnosis.
const TOKEN = '0xaf204776c7245bf4147c2612bf6e5972ee483701'
const EXTRA_DATA = `0x${'1'.padStart(64, '0')}${'3'.padStart(64, '0')}`

const NAME: Column = {
  label: 'Name',
  description: 'The entry name',
  type: ItemTypes.TEXT,
  isIdentifier: true,
}

const stakeState = (overrides: Partial<TcrState> = {}): TcrState => ({
  tcrTitle: 'Stake list',
  tcrDescription: 'Entries backed by a stake',
  tcrLogo: '/ipfs/QmLogo/logo.png',
  tcrPrimaryDocument: '/ipfs/QmPolicy/policy.pdf',
  itemName: 'entry',
  itemNamePlural: 'entries',
  requireRemovalEvidence: true,
  tokenAddress: TOKEN,
  arbitratorAddress: ARBITRATOR,
  arbitratorExtraData: EXTRA_DATA,
  governorAddress: GOVERNOR,
  submissionMinDeposit: '0.05',
  submissionPeriodDuration: 84,
  reinclusionPeriodDuration: 84,
  withdrawingPeriodDuration: 168,
  arbitrationParamsCooldown: 168,
  challengeStakeMultiplier: 50,
  sharedStakeMultiplier: 100,
  winnerStakeMultiplier: 100,
  loserStakeMultiplier: 200,
  columns: [NAME],
  currStep: 0,
  transactions: {},
  ...overrides,
})

const refusal = (schema: yup.AnySchema, value: unknown) =>
  schema.validate(value).then(
    () => null,
    (err: yup.ValidationError) => err.message,
  )

describe('tcrSchemaFor', () => {
  it('takes a complete list', async () => {
    expect(await refusal(fullTcrSchema, stakeState())).toBeNull()
    expect(tcrSchemaFor()).toBe(fullTcrSchema)
  })

  it.each<[FactorySection, object]>([
    ['title', { tcrTitle: 'Stake list' }],
    ['token', { tokenAddress: TOKEN }],
    ['custom', { itemName: 'entry', itemNamePlural: 'entries' }],
  ])('checks only the %s step on its Next', async (section, values) => {
    expect(await refusal(tcrSchemaFor(section), values)).toBeNull()
  })

  it.each([
    [
      'no stake token',
      { tokenAddress: '' },
      'A stake token address is required.',
    ],
    [
      'a mistyped stake token',
      { tokenAddress: '0xaf204776c7245bf4147c2612bf6e5972ee48370' },
      'Not a valid address: check it for a typo or a space.',
    ],
  ])('the token step refuses %s', async (_, overrides, message) => {
    expect(await refusal(tcrSchemaFor('token'), stakeState(overrides))).toBe(
      message,
    )
  })

  it.each([
    // Skipping the submission or reinclusion period, or the cooldown, is a
    // choice; a 0 withdrawing period would let a submitter leave ahead of
    // any challenge.
    ['no submission period', { submissionPeriodDuration: 0 }, null],
    ['no reinclusion period', { reinclusionPeriodDuration: 0 }, null],
    ['no cooldown', { arbitrationParamsCooldown: 0 }, null],
    [
      'no withdrawing period',
      { withdrawingPeriodDuration: 0 },
      'Must be longer than 0.',
    ],
    [
      'a challenger stake in thousandths of a percent',
      { challengeStakeMultiplier: 0.125 },
      'Use at most two decimal places, like 12.5.',
    ],
    ['a typed comma stake', { submissionMinDeposit: '0,05' }, null],
    [
      'an exponent stake',
      { submissionMinDeposit: '5e-2' },
      'Use digits with one dot or comma for decimals, like 0.5.',
    ],
  ])('the stake step: %s', async (_, overrides, message) => {
    expect(await refusal(tcrSchemaFor('stake'), stakeState(overrides))).toBe(
      message,
    )
  })
})

describe('deployProblems', () => {
  it('finds nothing in a list ready to deploy', () => {
    expect(deployProblems(stakeState())).toEqual([])
  })

  it('names empty fields to add and wrong ones to fix', () => {
    expect(
      deployProblems(
        stakeState({
          tcrLogo: '',
          submissionMinDeposit: '',
          governorAddress: '0x1234',
          tcrTitle: 'x'.repeat(41),
        }),
      ),
    ).toEqual([
      { path: 'tcrTitle', label: 'the name', missing: false },
      { path: 'tcrLogo', label: 'the logo', missing: true },
      {
        path: 'submissionMinDeposit',
        label: 'the minimum stake',
        missing: true,
      },
      { path: 'governorAddress', label: 'the governor', missing: false },
    ])
  })

  it('lists every field in the order of the steps', () => {
    const labels = deployProblems(
      stakeState({
        itemNamePlural: '',
        loserStakeMultiplier: -1,
        arbitratorAddress: '',
        tokenAddress: '',
        tcrPrimaryDocument: '',
        tcrDescription: '',
      }),
    ).map((problem) => problem.label)
    expect(labels).toEqual([
      'the description',
      'the policy',
      'the stake token',
      'the arbitrator',
      'the loser appeal multiplier',
      'the plural item name',
    ])
  })

  it('names a field once, however many of its rules fail', () => {
    // Over ten years, and not a whole number of seconds.
    expect(
      deployProblems(stakeState({ withdrawingPeriodDuration: 87_600.0001 })),
    ).toEqual([
      {
        path: 'withdrawingPeriodDuration',
        label: 'the withdrawing period',
        missing: false,
      },
    ])
  })

  it.each([
    ['0', { withdrawingPeriodDuration: 0 }, 'the withdrawing period', false],
    [
      'an ambiguous stake',
      { submissionMinDeposit: '1,000' },
      'the minimum stake',
      false,
    ],
    ['no court', { arbitratorExtraData: '' }, 'the court', true],
    ['an odd extra data', { arbitratorExtraData: '0x0' }, 'the court', false],
    [
      'a challenger stake with three decimals',
      { challengeStakeMultiplier: 12.345 },
      'the challenger stake',
      false,
    ],
  ])('calls %s something to fix or to add', (_, overrides, label, missing) => {
    expect(deployProblems(stakeState(overrides))).toEqual([
      expect.objectContaining({ label, missing }),
    ])
  })

  it.each<[string, Column[], DeployProblem[]]>([
    [
      'a field with no description',
      [{ ...NAME, description: '' }],
      [
        {
          path: 'columns',
          label: 'a name and a description for every field',
          missing: true,
        },
      ],
    ],
    [
      'a file field with no types',
      [NAME, { label: 'Doc', description: 'A file', type: ItemTypes.FILE }],
      [
        {
          path: 'columns',
          label: 'the file types of the file fields',
          missing: true,
        },
      ],
    ],
    [
      'a file field with a type entries cannot hold',
      [
        NAME,
        {
          label: 'Doc',
          description: 'A file',
          type: ItemTypes.FILE,
          allowedFileTypes: 'exe',
        },
      ],
      [
        {
          path: 'columns',
          label: 'the file types of the file fields',
          missing: false,
        },
      ],
    ],
    [
      'no identifier',
      [{ ...NAME, isIdentifier: false }],
      [{ path: 'columns', label: 'an identifier field', missing: true }],
    ],
    [
      'two fields with one name',
      [NAME, { ...NAME, isIdentifier: false }],
      [{ path: 'columns', label: 'the duplicate field names', missing: false }],
    ],
    [
      'no fields at all',
      [],
      [{ path: 'columns', label: 'an identifier field', missing: true }],
    ],
    [
      'an unnamed field and no identifier',
      [{ ...NAME, label: '', isIdentifier: false }],
      [
        {
          path: 'columns',
          label: 'a name and a description for every field',
          missing: true,
        },
        { path: 'columns', label: 'an identifier field', missing: true },
      ],
    ],
  ])('checks the entry fields: %s', (_, columns, problems) => {
    expect(deployProblems(stakeState({ columns }))).toEqual(problems)
  })

  it('reads a draft saved without fields as having none', () => {
    const state = stakeState()
    delete (state as Partial<TcrState>).columns
    expect(deployProblems(state)).toEqual([
      { path: 'columns', label: 'an identifier field', missing: true },
    ])
  })
})

describe('deployBlocker', () => {
  const add = (label: string): DeployProblem => ({
    path: label,
    label,
    missing: true,
  })
  const fix = (label: string): DeployProblem => ({
    path: label,
    label,
    missing: false,
  })

  it.each([
    [[], ''],
    [[add('the logo')], 'Add the logo before deploying'],
    [
      [add('the name'), add('the logo')],
      'Add the name and the logo before deploying',
    ],
    [
      [add('the name'), add('the logo'), add('the policy')],
      'Add the name, the logo and the policy before deploying',
    ],
    [[fix('the arbitrator')], 'Fix the arbitrator before deploying'],
    [
      [fix('the court'), add('the logo')],
      'Add the logo, and fix the court before deploying',
    ],
    // A part with its own "and" gets a serial comma, so the list still reads.
    [
      [
        add('a name and a description for every field'),
        add('an identifier field'),
      ],
      'Add a name and a description for every field, and an identifier field before deploying',
    ],
    [
      [add('a name and a description for every field')],
      'Add a name and a description for every field before deploying',
    ],
  ])('%j says %j', (problems, sentence) => {
    expect(deployBlocker(problems)).toBe(sentence)
  })

  it('says what stops a half-filled list', () => {
    const state = stakeState({ tcrLogo: '', governorAddress: '0x1234' })
    expect(deployBlocker(deployProblems(state))).toBe(
      'Add the logo, and fix the governor before deploying',
    )
  })
})
