import { describe, expect, it } from 'vitest'
import { sanitizeItemFile } from './item-file-guard'

describe('sanitizeItemFile', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', [{ label: 'Name' }]],
    ['text', '{"columns":[]}'],
    ['a number', 1],
  ])('is null for a file that is %s', (_, file) => {
    expect(sanitizeItemFile(file)).toBeNull()
  })

  it('keeps a well-formed entry as it is', () => {
    const columns = [
      { label: 'Name', type: 'text', description: 'The name' },
      { label: 'Address', type: 'address', isIdentifier: true },
    ]
    const file = sanitizeItemFile({
      columns,
      values: { Name: 'Kleros', Address: '0xabc', Score: 3, Verified: false },
    })
    expect(file?.columns).toEqual([
      { label: 'Name', type: 'text', description: 'The name' },
      {
        label: 'Address',
        type: 'address',
        isIdentifier: true,
        description: undefined,
      },
    ])
    expect({ ...file?.values }).toEqual({
      Name: 'Kleros',
      Address: '0xabc',
      Score: 3,
      Verified: false,
    })
  })

  it('turns values that are objects into their JSON text', () => {
    const file = sanitizeItemFile({
      values: JSON.parse(
        '{"Logo":{"toString":1},"Tags":["a","b"],"Empty":null}',
      ),
    })
    expect(file?.values.Logo).toBe('{"toString":1}')
    expect(file?.values.Tags).toBe('["a","b"]')
    expect(file?.values.Empty).toBeNull()
    // What the list and entry pages do with values must not throw.
    expect(() => Object.values(file?.values ?? {}).join(', ')).not.toThrow()
    expect(() => Object.values(file?.values ?? {}).map(String)).not.toThrow()
  })

  it('gives empty values and no columns when the file has none it can read', () => {
    for (const values of [undefined, null, 'text', ['a'], 5]) {
      const file = sanitizeItemFile({ columns: 'not a list', values })
      expect(file?.columns).toEqual([])
      expect({ ...file?.values }).toEqual({})
    }
  })

  it('gives columns the shape the app reads', () => {
    const file = sanitizeItemFile({
      columns: [
        { label: 5, type: 7, description: { a: 1 } },
        null,
        'Name',
        { label: { toString: 1 }, type: 'image' },
      ],
    })
    expect(file?.columns).toEqual([
      { label: '5', type: 'text', description: undefined },
      { label: '', type: 'image', description: undefined },
    ])
  })

  it('keeps any column label as a plain key, with no prototype behind it', () => {
    const file = sanitizeItemFile(
      JSON.parse(
        '{"values":{"__proto__":"a","constructor":"b","hasOwnProperty":"c"}}',
      ),
    )
    const values = file?.values ?? {}
    expect(Object.getPrototypeOf(values)).toBeNull()
    expect(values.__proto__).toBe('a')
    expect(values.constructor).toBe('b')
    expect(values.hasOwnProperty).toBe('c')
    // A label the entry does not have reads as missing, not as Object's own.
    expect(values.toString).toBeUndefined()
  })
})
