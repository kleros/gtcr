import { describe, expect, it } from 'vitest'
import { ItemTypes } from '@kleros/gtcr-encoder'
import {
  fileTypeList,
  fileTypesProblem,
  normalizeFileTypes,
  withNormalizedFileTypes,
} from './file-types'

const KINDS = 'use images, videos, PDF, JSON, text, Markdown or CSV.'

describe('fileTypeList', () => {
  it.each([
    ['.PDF, png', ['pdf', 'png']],
    ['pdf png  jpg', ['pdf', 'png', 'jpg']],
    ['pdf,png,,jpg', ['pdf', 'png', 'jpg']],
    ['..pdf', ['pdf']],
    ['pdf PDF .pdf', ['pdf']],
    ['', []],
    [' , ', []],
    [undefined, []],
    [null, []],
  ])('%j lists %j', (text, list) => {
    expect(fileTypeList(text)).toEqual(list)
  })
})

describe('normalizeFileTypes', () => {
  // The submit form checks a file by its type's own extension: a list that
  // only stored "jpg" would refuse every JPEG.
  it.each([
    ['jpg', 'jpg jpeg'],
    ['JPG, .png', 'jpg jpeg png'],
    ['md', 'md markdown'],
    ['mov', 'mov qt'],
    ['tiff', 'tiff tif'],
    ['jpeg jpg', 'jpeg jpg'],
    ['jpg jpg jpeg', 'jpg jpeg'],
    ['pdf, csv, json, txt, mp4, svg', 'pdf csv json txt mp4 svg'],
  ])('stores %j as %j', (typed, stored) => {
    expect(normalizeFileTypes(typed)).toBe(stored)
  })

  it('keeps types entries cannot hold, for the field to name', () => {
    expect(normalizeFileTypes('pdf exe mp3')).toBe('pdf exe mp3')
  })

  it('stores nothing for an empty field', () => {
    expect(normalizeFileTypes('')).toBe('')
    expect(normalizeFileTypes(undefined)).toBe('')
  })

  it('stores what it would store again', () => {
    const once = normalizeFileTypes('JPG .md, png tif')
    expect(normalizeFileTypes(once)).toBe(once)
  })
})

describe('fileTypesProblem', () => {
  it.each([
    'pdf',
    'png jpg gif webp svg',
    'mp4 webm mov',
    'json txt md csv',
    '.PDF, .PNG',
  ])('takes %j', (typed) => {
    expect(fileTypesProblem(typed)).toBe('')
  })

  it.each([
    ['', 'At least one file type is required.'],
    [' , ', 'At least one file type is required.'],
    [undefined, 'At least one file type is required.'],
    ['exe', `Entries cannot hold exe files: ${KINDS}`],
    ['pdf mp3', `Entries cannot hold mp3 files: ${KINDS}`],
    ['doc zip', `Entries cannot hold doc or zip files: ${KINDS}`],
    ['html doc zip', `Entries cannot hold html, doc or zip files: ${KINDS}`],
    // A media type is not an extension.
    ['image/png', `Entries cannot hold image/png files: ${KINDS}`],
    ['notatype', `Entries cannot hold notatype files: ${KINDS}`],
  ])('refuses %j', (typed, problem) => {
    expect(fileTypesProblem(typed)).toBe(problem)
  })
})

describe('withNormalizedFileTypes', () => {
  it('stores each file field’s types as normalizeFileTypes writes them', () => {
    const name = { label: 'Name', type: ItemTypes.TEXT, isIdentifier: true }
    const columns: Column[] = [
      name,
      { label: 'Photo', type: ItemTypes.FILE, allowedFileTypes: 'JPG, .md' },
      { label: 'Empty', type: ItemTypes.FILE },
    ]
    const deployed = withNormalizedFileTypes(columns)
    expect(deployed).toEqual([
      name,
      {
        label: 'Photo',
        type: ItemTypes.FILE,
        allowedFileTypes: 'jpg jpeg md markdown',
      },
      { label: 'Empty', type: ItemTypes.FILE, allowedFileTypes: '' },
    ])
    expect(deployed[0]).toBe(name)
    expect(columns[1].allowedFileTypes).toBe('JPG, .md')
  })

  it('leaves the types of other fields alone', () => {
    const columns = [
      { label: 'Note', type: ItemTypes.TEXT, allowedFileTypes: 'JPG' },
    ]
    expect(withNormalizedFileTypes(columns)).toEqual(columns)
  })
})
