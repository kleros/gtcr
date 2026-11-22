import { describe, expect, it } from 'vitest'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { linkedListAddress, linkedListField } from './linked-list'

const LIST = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const DECOY = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'

const listColumn = (label: string, type: string = ItemTypes.GTCR_ADDRESS) => ({
  label,
  type,
})

describe('linkedListAddress', () => {
  it('reads the field labelled like the list’s list-address column, in lower case', () => {
    expect(
      linkedListAddress(
        [{ label: 'Registry', value: LIST }],
        [listColumn('Name', ItemTypes.TEXT), listColumn('Registry')],
      ),
    ).toBe(LIST.toLowerCase())
  })

  it.each([
    ['names no columns', undefined],
    ['has no columns', []],
    ['has no list-address column', [listColumn('Name', ItemTypes.TEXT)]],
  ])('reads "Address" when the list %s', (_, columns) => {
    expect(
      linkedListAddress([{ label: 'Address', value: LIST }], columns),
    ).toBe(LIST.toLowerCase())
  })

  it('matches the column type whatever its case', () => {
    expect(
      linkedListAddress(
        [{ label: 'Registry', value: LIST }],
        [listColumn('Registry', 'gtcr ADDRESS')],
      ),
    ).toBe(LIST.toLowerCase())
  })

  it('reads the list’s first list-address column', () => {
    expect(
      linkedListAddress(
        [
          { label: 'Badges', value: DECOY },
          { label: 'Registry', value: LIST },
        ],
        [listColumn('Registry'), listColumn('Badges')],
      ),
    ).toBe(LIST.toLowerCase())
  })

  // An entry file names its own columns: an extra field that sorts first,
  // or one labelled like a column in another case, must not decide.
  it('ignores the entry’s other fields', () => {
    expect(
      linkedListAddress(
        [
          { label: 'A', value: DECOY },
          { label: 'address', value: DECOY },
          { label: 'Address', value: LIST },
        ],
        undefined,
      ),
    ).toBe(LIST.toLowerCase())
  })

  it.each([
    ['an ENS name', 'kleros.eth'],
    ['a short address', '0x1234'],
    ['an address with a space', ` ${LIST}`],
    ['a number', 42],
    ['nothing', null],
  ])('points nowhere when the field holds %s', (_, value) => {
    expect(linkedListAddress([{ label: 'Address', value }], undefined)).toBe(
      undefined,
    )
  })

  it('points nowhere without fields', () => {
    expect(linkedListAddress(undefined, undefined)).toBeUndefined()
    expect(linkedListAddress([], undefined)).toBeUndefined()
    expect(linkedListAddress([{ label: 'Name', value: LIST }], undefined)).toBe(
      undefined,
    )
  })
})

describe('linkedListField', () => {
  it('is the very field that names the list', () => {
    const field = {
      label: 'Registry',
      value: LIST,
      type: ItemTypes.GTCR_ADDRESS,
    }
    const fields = [{ label: 'Name', value: 'Tokens' }, field]
    expect(linkedListField(fields, [listColumn('Registry')])).toBe(field)
  })

  it('is undefined when that field holds no address', () => {
    expect(
      linkedListField([{ label: 'Address', value: 'kleros.eth' }], undefined),
    ).toBeUndefined()
  })

  it('is undefined when no field has the label', () => {
    expect(
      linkedListField(
        [{ label: 'Address', value: LIST }],
        [listColumn('Registry')],
      ),
    ).toBeUndefined()
  })
})
