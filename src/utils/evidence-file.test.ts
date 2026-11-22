import { describe, expect, it } from 'vitest'
import { evidenceFileFields } from './evidence-file'

const NONE = {
  title: null,
  description: null,
  fileURI: null,
  fileTypeExtension: null,
}

describe('evidenceFileFields', () => {
  it('keeps the four fields when they are text', () => {
    expect(
      evidenceFileFields({
        title: 'The logo is wrong',
        description: 'It is the old logo.',
        fileURI: '/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/a.png',
        fileTypeExtension: 'png',
      }),
    ).toEqual({
      title: 'The logo is wrong',
      description: 'It is the old logo.',
      fileURI: '/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/a.png',
      fileTypeExtension: 'png',
    })
  })

  it('keeps empty text as text', () => {
    expect(evidenceFileFields({ title: '' }).title).toBe('')
  })

  it.each([
    ['a number', 1],
    ['a boolean', true],
    ['null', null],
    ['an array', ['a', 'b']],
    ['an object', { text: 'x' }],
    ['an object with its own toString', JSON.parse('{"toString":1}')],
  ])('drops a field that is %s', (_, value) => {
    expect(
      evidenceFileFields({
        title: value,
        description: value,
        fileURI: value,
        fileTypeExtension: value,
      }),
    ).toEqual(NONE)
  })

  it('keeps the text fields when others are not text', () => {
    expect(
      evidenceFileFields({ title: 'Kept', description: { html: '<b>x</b>' } }),
    ).toEqual({ ...NONE, title: 'Kept' })
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['text', 'evidence'],
    ['a number', 7],
    ['an array', ['title']],
  ])('gives no fields for a file that is %s', (_, file) => {
    expect(evidenceFileFields(file)).toEqual(NONE)
  })

  it('returns only the four fields, whatever else the file holds', () => {
    const fields = evidenceFileFields({
      title: 'T',
      extra: 'not read',
      constructor: 'x',
    })
    expect(Object.keys(fields).sort()).toEqual([
      'description',
      'fileTypeExtension',
      'fileURI',
      'title',
    ])
  })

  it('does not read fields through a "__proto__" key', () => {
    const file = JSON.parse('{"__proto__":{"title":"spoofed"}}')
    expect(evidenceFileFields(file).title).toBeNull()
  })
})
