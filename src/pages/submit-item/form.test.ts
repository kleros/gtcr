import { describe, expect, it, vi } from 'vitest'
import { getIn, setIn } from 'formik'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { AMBIGUOUS_COMMA } from 'utils/decimal-input'
import {
  type FactoryChecks,
  type SubmissionValues,
  buildInitialValues,
  fieldPath,
  isEmptyField,
  isEmptyValue,
  isOptionalColumn,
  isRequired,
  missingRequired,
  normaliseValues,
  validateSubmission,
  withWebScheme,
} from './form'

const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const RICH_ADDRESS = `eip155:1:${ADDRESS}`
const UPLOAD = new File(['%PDF'], 'policy.pdf', { type: 'application/pdf' })

const column = (type: string, label = 'Field', extra: Partial<Column> = {}) =>
  ({ label, type, ...extra }) as Column

/** List-creator checks that answer `standard` and `permanent`. */
const factoryChecks = (standard: boolean, permanent = false) => ({
  deployedWithStandardFactory: vi.fn(async () => standard),
  deployedWithPermanentFactory: vi.fn(async () => permanent),
})

/** The submit form's errors for one column holding `value`. */
const errorFor = async (
  field: Column,
  value: SubmissionValues[string] | undefined,
  checks: FactoryChecks = factoryChecks(true),
) => {
  const values: SubmissionValues = {}
  if (value !== undefined) values[field.label] = value
  const errors = await validateSubmission([field], values, checks)
  return errors[field.label]
}

describe('fieldPath', () => {
  // Formik reads a name as a path: "No. of tokens" alone would be stored as
  // {No: {" of tokens": …}}, where the form never reads it.
  it('is needed: a bare label is split by Formik', () => {
    expect(setIn({}, 'No. of tokens', '5')).toEqual({
      No: { ' of tokens': '5' },
    })
  })

  it.each([
    'No. of tokens',
    'Say "hi"',
    'a\\b',
    'a[0]',
    'x.y.z',
    'Logo (Optional)',
    "it's",
  ])('keeps %j one key for Formik', (label) => {
    const path = fieldPath(label)
    expect(setIn({}, path, '5')).toEqual({ [label]: '5' })
    expect(getIn({ [label]: '7' }, path)).toBe('7')
  })
})

describe('isOptionalColumn', () => {
  it.each([
    [{ optional: true }, 'Logo', true],
    [{}, 'Logo (Optional)', true],
    [{}, 'Logo (optional)  ', true],
    [{}, 'Logo (OPTIONAL)', true],
    [{}, '(Optional) Logo', false],
    [{}, 'Optional logo', false],
    [{}, 'Logo', false],
  ])('%j labelled %j: %s', (extra, label, optional) => {
    expect(isOptionalColumn(column(ItemTypes.TEXT, label, extra))).toBe(
      optional,
    )
  })
})

describe('isRequired', () => {
  it.each([
    [ItemTypes.TEXT, 'Name', true],
    [ItemTypes.IMAGE, 'Logo', true],
    [ItemTypes.ADDRESS, 'Address', true],
    // A switch always holds a value.
    [ItemTypes.BOOLEAN, 'Listed', false],
    [ItemTypes.IMAGE, 'Logo (Optional)', false],
  ])('a %s column labelled %j: %s', (type, label, required) => {
    expect(isRequired(column(type, label))).toBe(required)
  })
})

describe('isEmptyValue', () => {
  it.each([
    [undefined, true],
    ['', true],
    ['  \n', true],
    ['0', false],
    ['false', false],
    [UPLOAD, false],
  ])('%j: %s', (value, empty) => {
    expect(isEmptyValue(value)).toBe(empty)
  })
})

describe('isEmptyField', () => {
  it.each([
    // A rich address whose chain was picked but whose address is blank.
    [ItemTypes.RICH_ADDRESS, 'eip155:1:', true],
    [ItemTypes.RICH_ADDRESS, 'eip155:1:   ', true],
    [ItemTypes.RICH_ADDRESS, RICH_ADDRESS, false],
    [ItemTypes.RICH_ADDRESS, '', true],
    // Not a rich address at all: for the format check to refuse.
    [ItemTypes.RICH_ADDRESS, 'nonsense', false],
    [ItemTypes.TEXT, 'eip155:1:', false],
    [ItemTypes.TEXT, ' ', true],
    [ItemTypes.FILE, UPLOAD, false],
  ])('a %s column holding %j: %s', (type, value, empty) => {
    expect(isEmptyField(column(type), value)).toBe(empty)
  })
})

describe('buildInitialValues', () => {
  const columns = [
    column(ItemTypes.NUMBER, 'Supply'),
    column(ItemTypes.TWITTER_USER_ID, 'Twitter'),
    column(ItemTypes.BOOLEAN, 'Audited'),
    column(ItemTypes.TEXT, 'Name'),
    column(ItemTypes.ADDRESS, 'Address'),
    column('some future type', 'Other'),
  ]

  it('starts numbers blank, not at the encoder’s 0', () => {
    expect(buildInitialValues(columns)).toEqual({
      Supply: '',
      Twitter: '',
      Audited: 'false',
      Name: '',
      Address: '',
      Other: '',
    })
  })

  it('keeps provided values as text, and falls back for missing ones', () => {
    expect(
      buildInitialValues(columns, [0, null, true, 'Kleros', undefined]),
    ).toEqual({
      Supply: '0',
      Twitter: '',
      Audited: 'true',
      Name: 'Kleros',
      Address: '',
      Other: '',
    })
  })
})

describe('missingRequired', () => {
  const columns = [
    column(ItemTypes.TEXT, 'Name'),
    column(ItemTypes.RICH_ADDRESS, 'Contract'),
    column(ItemTypes.IMAGE, 'Logo'),
    column(ItemTypes.BOOLEAN, 'Audited'),
    column(ItemTypes.LINK, 'Website (Optional)'),
  ]

  it('counts the required fields still empty', () => {
    expect(
      missingRequired(columns, {
        Name: ' ',
        Contract: 'eip155:1:',
        Logo: UPLOAD,
        Audited: '',
        'Website (Optional)': '',
      }),
    ).toBe(2)
  })

  it('is 0 once every required field holds something', () => {
    expect(
      missingRequired(columns, {
        Name: 'Kleros',
        Contract: RICH_ADDRESS,
        Logo: '/ipfs/QmLogo/logo.png',
      }),
    ).toBe(0)
  })
})

describe('normaliseValues', () => {
  const columns = [
    column(ItemTypes.RICH_ADDRESS, 'Blank chain'),
    column(ItemTypes.RICH_ADDRESS, 'Contract'),
    column(ItemTypes.LINK, 'Website'),
    column(ItemTypes.NUMBER, 'Decimals'),
    column(ItemTypes.NUMBER, 'Supply'),
    column(ItemTypes.TEXT, 'Name'),
    column(ItemTypes.FILE, 'Document'),
  ]
  const values: SubmissionValues = {
    'Blank chain': 'eip155:100:',
    Contract: RICH_ADDRESS,
    Website: '  https://kleros.io  ',
    Decimals: '0,5',
    Supply: '1,000',
    Name: '  Kleros  ',
    Document: UPLOAD,
    Unlisted: ' kept ',
  }

  it('sends values as they go on chain', () => {
    expect(normaliseValues(columns, values)).toEqual({
      'Blank chain': '',
      Contract: RICH_ADDRESS,
      Website: 'https://kleros.io',
      // A decimal comma goes as a dot; "1,000" stays for validation to refuse.
      Decimals: '0.5',
      Supply: '1,000',
      Name: '  Kleros  ',
      Document: UPLOAD,
      Unlisted: ' kept ',
    })
  })

  it('leaves the form’s own values alone', () => {
    const before = { ...values }
    normaliseValues(columns, values)
    expect(values).toEqual(before)
  })
})

describe('withWebScheme', () => {
  it.each([
    ['example.org/app', 'https://example.org/app'],
    [' example.org ', 'https://example.org'],
    ['//example.org', 'https://example.org'],
    ['www.kleros.io', 'https://www.kleros.io'],
  ])('gives %j a scheme', (typed, link) => {
    expect(withWebScheme(typed)).toBe(link)
  })

  it.each([
    'https://example.org',
    'http://example.org',
    'ipfs://QmHash/file.pdf',
    'mailto:curate@kleros.io',
    'localhost',
    'two words.org',
    '',
    '   ',
  ])('leaves %j for validation to judge', (typed) => {
    expect(withWebScheme(typed)).toBe(typed)
  })

  // Regression: the scheme test /^[a-z][a-z\d+.-]*:/ read a host with a
  // port ("example.org:") as a scheme, so the link keeps no https:// and
  // validateSubmission then takes "example.org:8080/app" as a full link with
  // the protocol "example.org:". Entry pages only make https links
  // clickable.
  it('gives a link with a port its scheme too', () => {
    expect(withWebScheme('example.org:8080/app')).toBe(
      'https://example.org:8080/app',
    )
  })
})

describe('validateSubmission', () => {
  it.each([
    ['an empty text', column(ItemTypes.TEXT, 'Name'), ''],
    ['spaces', column(ItemTypes.TEXT, 'Name'), '   '],
    ['a missing value', column(ItemTypes.IMAGE, 'Logo'), undefined],
    [
      'a chain with no address',
      column(ItemTypes.RICH_ADDRESS, 'Contract'),
      'eip155:1:',
    ],
    ['an empty number', column(ItemTypes.NUMBER, 'Supply'), ''],
  ])('requires %s', async (_, field, value) => {
    expect(await errorFor(field, value)).toBe('Required.')
  })

  it.each([
    [
      'an optional field left empty',
      column(ItemTypes.TEXT, 'Notes (Optional)'),
      '',
    ],
    [
      'an optional chain with no address',
      column(ItemTypes.RICH_ADDRESS, 'Contract (Optional)'),
      'eip155:1:',
    ],
    ['a switch', column(ItemTypes.BOOLEAN, 'Audited'), 'false'],
    ['a stashed upload', column(ItemTypes.IMAGE, 'Logo'), UPLOAD],
  ])('takes %s', async (_, field, value) => {
    expect(await errorFor(field, value)).toBeUndefined()
  })

  describe('numbers', () => {
    const NOT_A_NUMBER =
      'Enter a number, like 18 or 0.5. A dot or a comma works for decimals.'
    const supply = column(ItemTypes.NUMBER, 'Supply')

    it.each(['18', '-3', '0.5', '.5', '5.', '0,5', '1234,567', ' 7 '])(
      'takes %j',
      async (value) => {
        expect(await errorFor(supply, value)).toBeUndefined()
      },
    )

    it.each([
      ['eighteen', NOT_A_NUMBER],
      ['1e3', NOT_A_NUMBER],
      ['0x10', NOT_A_NUMBER],
      ['1,000.5', NOT_A_NUMBER],
      ['1.2.3', NOT_A_NUMBER],
      ['2,375', AMBIGUOUS_COMMA],
      ['-1,250', AMBIGUOUS_COMMA],
    ])('refuses %j', async (value, message) => {
      expect(await errorFor(supply, value)).toBe(message)
    })
  })

  describe('addresses', () => {
    const INVALID = 'Enter a valid address: 0x followed by 40 hex characters.'

    it.each([
      ['too short', '0x1234'],
      ['with a space', ` ${ADDRESS}`],
      ['without 0x', ADDRESS.slice(2)],
      ['an ENS name', 'kleros.eth'],
    ])('refuses an address %s', async (_, value) => {
      expect(await errorFor(column(ItemTypes.ADDRESS), value)).toBe(INVALID)
    })

    it('takes an address in any case', async () => {
      expect(await errorFor(column(ItemTypes.ADDRESS), ADDRESS)).toBeUndefined()
      expect(
        await errorFor(column(ItemTypes.ADDRESS), ADDRESS.toLowerCase()),
      ).toBeUndefined()
    })

    it.each([
      [RICH_ADDRESS, undefined],
      [
        'bip122:000000000019d6689c085ae165831e93:1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        undefined,
      ],
      ['eip155:1:0x1234', 'Enter a valid address for the selected chain.'],
      ['eip155:999999:0x1234', 'Enter a valid address for the selected chain.'],
      ['nonsense', 'Enter a valid address for the selected chain.'],
    ])('a rich address %j', async (value, error) => {
      expect(await errorFor(column(ItemTypes.RICH_ADDRESS), value)).toBe(error)
    })
  })

  describe('links', () => {
    const NOT_A_LINK = 'Enter a full link, like https://example.org'

    it.each([
      'https://example.org',
      '  https://example.org/a?b=c  ',
      'ipfs://QmHash/file.pdf',
      'mailto:curate@kleros.io',
    ])('takes %j', async (value) => {
      expect(await errorFor(column(ItemTypes.LINK), value)).toBeUndefined()
    })

    it.each([
      'example',
      'https://exa mple.org',
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ])('refuses %j', async (value) => {
      expect(await errorFor(column(ItemTypes.LINK), value)).toBe(NOT_A_LINK)
    })
  })

  describe('list addresses', () => {
    const list = column(ItemTypes.GTCR_ADDRESS, 'List')

    it('takes a list deployed with the Standard creator, asking no further', async () => {
      const checks = factoryChecks(true)
      expect(await errorFor(list, ADDRESS, checks)).toBeUndefined()
      expect(checks.deployedWithStandardFactory).toHaveBeenCalledWith(ADDRESS)
      expect(checks.deployedWithPermanentFactory).not.toHaveBeenCalled()
    })

    it('takes a list deployed with the Stake creator', async () => {
      expect(
        await errorFor(list, ADDRESS, factoryChecks(false, true)),
      ).toBeUndefined()
    })

    it('refuses an address neither creator deployed', async () => {
      expect(await errorFor(list, ADDRESS, factoryChecks(false, false))).toBe(
        'This address was not deployed with the list creator.',
      )
    })

    it('waits for an indexer that does not answer', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const checks = factoryChecks(true)
      checks.deployedWithStandardFactory.mockRejectedValue(new Error('503'))
      expect(await errorFor(list, ADDRESS, checks)).toBe(
        'Could not check this address right now. Try again.',
      )
      expect(error).toHaveBeenCalled()
    })

    it('does not look up a malformed address', async () => {
      const checks = factoryChecks(true)
      expect(await errorFor(list, '0x1234', checks)).toBe(
        'Enter a valid address: 0x followed by 40 hex characters.',
      )
      expect(checks.deployedWithStandardFactory).not.toHaveBeenCalled()
    })

    it('does not look up an optional list left empty', async () => {
      const checks = factoryChecks(false)
      const optional = column(ItemTypes.GTCR_ADDRESS, 'List (Optional)')
      expect(await errorFor(optional, '', checks)).toBeUndefined()
      expect(checks.deployedWithStandardFactory).not.toHaveBeenCalled()
    })

    // Regression: an optional list address holding only spaces is empty
    // for every other rule (isEmptyField), but the list-creator lookup only
    // skips '' and is sent "  ": the submission is blocked with "This
    // address was not deployed with the list creator." on a field that
    // looks empty, or with "Could not check…" when the indexer refuses it.
    it('does not look up an optional list holding only spaces', async () => {
      const optional = column(ItemTypes.GTCR_ADDRESS, 'List (Optional)')
      expect(
        await errorFor(optional, '  ', factoryChecks(false)),
      ).toBeUndefined()
    })
  })

  it('reports each column under its own label', async () => {
    const columns = [
      column(ItemTypes.TEXT, 'Name'),
      column(ItemTypes.NUMBER, 'No. of tokens'),
      column(ItemTypes.LINK, 'Website'),
      column(ItemTypes.ADDRESS, 'Address'),
    ]
    expect(
      await validateSubmission(
        columns,
        {
          Name: 'Kleros',
          'No. of tokens': 'many',
          Website: 'kleros',
          Address: ADDRESS,
        },
        factoryChecks(true),
      ),
    ).toEqual({
      'No. of tokens':
        'Enter a number, like 18 or 0.5. A dot or a comma works for decimals.',
      Website: 'Enter a full link, like https://example.org',
    })
  })
})
