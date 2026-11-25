import { describe, expect, it } from 'vitest'
import * as yup from 'yup'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { AMBIGUOUS_COMMA } from 'utils/decimal-input'
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
} from './factory-shared-schemas'

/** What the field says about `value`: its message, or null when it passes. */
const refusal = (schema: yup.AnySchema, value: unknown) =>
  schema.validate(value).then(
    () => null,
    (err: yup.ValidationError) => err.message,
  )

const NOT_A_NUMBER =
  'Use a plain number like 1000 or 0.5; a dot or a comma marks decimals.'
const NOT_PLAIN = 'Use digits with one dot or comma for decimals, like 0.5.'

// EIP-55's own example address, and the same address with one letter's case
// flipped: a checksum the deploy's encoder would refuse.
const CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const WRONG_CHECKSUM = '0x5aaeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

describe('address', () => {
  const schema = address('An arbitrator address is required.')
  const INVALID = 'Not a valid address: check it for a typo or a space.'

  it.each([
    ['empty', '', 'An arbitrator address is required.'],
    ['missing', undefined, 'An arbitrator address is required.'],
    ['checksummed', CHECKSUMMED, null],
    ['all lower case', CHECKSUMMED.toLowerCase(), null],
    ['with a wrong checksum', WRONG_CHECKSUM, INVALID],
    ['with a trailing space', `${CHECKSUMMED} `, INVALID],
    ['one character short', CHECKSUMMED.slice(0, -1), INVALID],
    ['with a capital 0X', `0X${CHECKSUMMED.slice(2)}`, INVALID],
    ['an ENS name', 'kleros.eth', INVALID],
  ])('%s', async (_, value, message) => {
    expect(await refusal(schema, value)).toBe(message)
  })
})

describe('extraData', () => {
  const INVALID = 'Extra data is hex bytes: 0x, then pairs of 0-9 and a-f.'
  // Court 1 with 3 jurors, as the court picker writes it: two 32-byte words.
  const COURT_AND_JURORS = `0x${'1'.padStart(64, '0')}${'3'.padStart(64, '0')}`

  it.each([
    ['empty', '', 'The arbitrator extra data is required.'],
    ['a court and a juror count', COURT_AND_JURORS, null],
    ['no bytes (the default court)', '0x', null],
    ['upper-case hex', '0xABCDEF', null],
    // viem would pad an odd length into another court or juror count.
    ['an odd number of digits', COURT_AND_JURORS.slice(0, -1), INVALID],
    ['a lone digit', '0x0', INVALID],
    ['non-hex characters', '0xzz', INVALID],
    ['no 0x prefix', COURT_AND_JURORS.slice(2), INVALID],
  ])('%s', async (_, value, message) => {
    expect(await refusal(extraData, value)).toBe(message)
  })
})

describe('amount', () => {
  it.each([
    ['0', 0],
    ['12.5', 12.5],
    ['0,5', 0.5],
    ['0,125', 0.125],
    ['1234,567', 1234.567],
    [' 3 ', 3],
    ['0.000000000000000001', 1e-18],
  ])('reads %j as %d', async (typed, read) => {
    expect(await amount.validate(typed)).toBe(read)
  })

  it('takes numbers as they are stored', async () => {
    expect(await amount.validate(7)).toBe(7)
    expect(await amount.validate(5e-7)).toBe(5e-7)
  })

  it('takes amounts beyond Number precision (the deploy encodes the text)', async () => {
    expect(await refusal(amount, '123456789012345678901234567890')).toBeNull()
  })

  it.each([
    ['an empty field', '', 'A value is required.'],
    ['a missing value', undefined, 'A value is required.'],
    ['null', null, 'A value is required.'],
    ['a negative amount', '-1', 'The amount must not be negative.'],
    ['a negative comma decimal', '-0,5', 'The amount must not be negative.'],
    ['a thousands-looking comma', '1,000', AMBIGUOUS_COMMA],
    ['three digits after a comma', '2,375', AMBIGUOUS_COMMA],
    ['several commas', '1,000,000', NOT_A_NUMBER],
    ['a comma and a dot', '1,000.5', NOT_A_NUMBER],
    ['a space between digits', '1 000', NOT_A_NUMBER],
    ['two dots', '1.2.3', NOT_A_NUMBER],
    ['words', 'ten', NOT_A_NUMBER],
    ['Infinity', 'Infinity', NOT_A_NUMBER],
    // yup reads these as numbers; parseEther or parseUnits would throw on
    // them after the uploads.
    ['an exponent', '1e3', NOT_PLAIN],
    ['hex', '0x10', NOT_PLAIN],
    ['no digit before the point', '.5', NOT_PLAIN],
    ['a trailing point', '5.', NOT_PLAIN],
  ])('refuses %s', async (_, value, message) => {
    expect(await refusal(amount, value)).toBe(message)
  })
})

describe('period', () => {
  const WHOLE_SECONDS = 'Use a duration that is a whole number of seconds.'
  const TEN_YEARS = 'Keep periods under ten years.'

  it.each([
    ['84', 84],
    ['0,5', 0.5],
    ['0.25', 0.25],
    ['87600', 87_600],
    // One second, as hours: float error is not a fraction of a second.
    [String(1 / 3600), 1 / 3600],
  ])('reads %j hours', async (typed, hours) => {
    expect(await period(true).validate(typed)).toBe(hours)
  })

  it('takes 0 only where the period may be skipped', async () => {
    expect(await refusal(period(false), '0')).toBeNull()
    expect(await refusal(period(true), '0')).toBe('Must be longer than 0.')
  })

  it.each([
    ['an empty field', '', 'A value is required.'],
    ['a negative duration', '-1', 'The amount must not be negative.'],
    ['0.123 hours (442.8 seconds)', '0.123', WHOLE_SECONDS],
    ['0.0001 hours (0.36 seconds)', '0.0001', WHOLE_SECONDS],
    ['ten years and an hour', '87601', TEN_YEARS],
    ['just over ten years', '87600.5', TEN_YEARS],
    ['an exponent', '1e2', NOT_PLAIN],
    ['a thousands-looking comma', '1,000', AMBIGUOUS_COMMA],
  ])('refuses %s', async (_, value, message) => {
    expect(await refusal(period(false), value)).toBe(message)
  })
})

describe('multiplier', () => {
  const BASIS_POINTS = 'Use at most two decimal places, like 12.5.'

  it.each([
    ['0', 0],
    ['100', 100],
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['12.34', 12.34],
    // 0.07 × 100 is 7.000000000000001 in floating point: still 7 bps.
    ['0.07', 0.07],
    ['10000', 10_000],
  ])('takes %j percent', async (typed, percent) => {
    expect(await multiplier.validate(typed)).toBe(percent)
  })

  it.each([
    ['an empty field', '', 'A value is required.'],
    ['a negative percent', '-1', 'The stake multiplier cannot be negative.'],
    ['a third decimal (no exact basis point)', '12.345', BASIS_POINTS],
    ['1.005 percent', '1.005', BASIS_POINTS],
    ['a thousands-looking comma', '1,000', AMBIGUOUS_COMMA],
    ['words', 'half', NOT_A_NUMBER],
  ])('refuses %s', async (_, value, message) => {
    expect(await refusal(multiplier, value)).toBe(message)
  })
})

describe('LIST_SECTIONS', () => {
  const check = (section: keyof typeof LIST_SECTIONS, values: object) =>
    refusal(yup.object().shape(LIST_SECTIONS[section]), values)

  it.each([
    ['title', { tcrTitle: '' }, 'A title is required.'],
    ['title', { tcrTitle: 'x'.repeat(40) }, null],
    [
      'title',
      { tcrTitle: 'x'.repeat(41) },
      'Keep the title to 40 characters or fewer.',
    ],
    ['description', { tcrDescription: '' }, 'A description is required.'],
    ['description', { tcrDescription: 'x'.repeat(255) }, null],
    [
      'description',
      { tcrDescription: 'x'.repeat(256) },
      'Keep the description to 255 characters or fewer.',
    ],
    ['logo', { tcrLogo: '' }, 'A logo is required.'],
    ['logo', { tcrLogo: '/ipfs/QmLogo/logo.png' }, null],
    ['policy', { tcrPrimaryDocument: '' }, 'Upload the listing policy.'],
    [
      'custom',
      { itemName: '', itemNamePlural: 'tokens' },
      'An item name is required.',
    ],
    [
      'custom',
      { itemName: 'x'.repeat(21), itemNamePlural: 'tokens' },
      'Keep the item name to 20 characters or fewer.',
    ],
    [
      'custom',
      { itemName: 'token', itemNamePlural: '' },
      'The plural of the item name is required.',
    ],
    [
      'custom',
      { itemName: 'token', itemNamePlural: 'x'.repeat(21) },
      'Keep the plural to 20 characters or fewer.',
    ],
    [
      'custom',
      { itemName: 'x'.repeat(20), itemNamePlural: 'x'.repeat(20) },
      null,
    ],
  ] as const)('%s: %j', async (section, values, message) => {
    expect(await check(section, values)).toBe(message)
  })
})

describe('itemSchema', () => {
  const column = (overrides: Partial<Column> = {}): Column => ({
    label: 'Name',
    description: 'What the entry is called',
    type: ItemTypes.TEXT,
    ...overrides,
  })

  it('takes fields with a label and a description', async () => {
    expect(await refusal(itemSchema, { columns: [column()] })).toBeNull()
  })

  it.each([
    [
      'a field with no label',
      column({ label: '' }),
      'The column label is required.',
    ],
    [
      'a field with no description',
      column({ description: '' }),
      'The column description is required.',
    ],
    [
      'a file field with no types',
      column({ type: ItemTypes.FILE, allowedFileTypes: '' }),
      'At least one file type is required.',
    ],
    [
      'a file field with a type entries cannot hold',
      column({ type: ItemTypes.FILE, allowedFileTypes: 'pdf exe' }),
      'Entries cannot hold exe files: use images, videos, PDF, JSON, text, Markdown or CSV.',
    ],
  ])('refuses %s', async (_, value, message) => {
    expect(await refusal(itemSchema, { columns: [value] })).toBe(message)
  })

  it('names the file field it refuses', async () => {
    const columns = [
      column(),
      column({ label: 'Doc', type: ItemTypes.FILE, allowedFileTypes: '' }),
    ]
    await expect(itemSchema.validate({ columns })).rejects.toMatchObject({
      path: 'columns[1].allowedFileTypes',
    })
  })

  it('checks file types on file fields only', async () => {
    const columns = [
      column({ type: ItemTypes.FILE, allowedFileTypes: '.PDF, png' }),
      column({ label: 'Note', type: ItemTypes.TEXT, allowedFileTypes: 'exe' }),
      column({ label: 'Logo', type: ItemTypes.IMAGE }),
    ]
    expect(await refusal(itemSchema, { columns })).toBeNull()
  })
})

describe('itemColumnsProblem', () => {
  const field = (label: string, isIdentifier = false): Column => ({
    label,
    type: ItemTypes.TEXT,
    isIdentifier,
  })

  it.each([
    ['no fields', [], 'At least one identifier field is required.'],
    [
      'no identifier',
      [field('Name'), field('Logo')],
      'At least one identifier field is required.',
    ],
    [
      'two fields with one name',
      [field('Name', true), field('Name')],
      'Field names must be unique.',
    ],
    // The identifier is checked first: it is the message for Next.
    [
      'duplicates and no identifier',
      [field('Name'), field('Name')],
      'At least one identifier field is required.',
    ],
    [
      'an identifier and unique names',
      [field('Name', true), field('Logo')],
      null,
    ],
    [
      'several identifiers',
      [field('Name', true), field('Symbol', true), field('Logo')],
      null,
    ],
  ])('%s', (_, columns, problem) => {
    expect(itemColumnsProblem(columns)).toBe(problem)
  })
})

describe('listInProse', () => {
  it.each([
    [[], ''],
    [['the logo'], 'the logo'],
    [['the name', 'the logo'], 'the name and the logo'],
    [
      ['the name', 'the logo', 'the policy'],
      'the name, the logo and the policy',
    ],
  ])('%j reads %j', (items, prose) => {
    expect(listInProse(items)).toBe(prose)
  })
})
