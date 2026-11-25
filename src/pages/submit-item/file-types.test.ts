import { describe, expect, it } from 'vitest'
import { normalizeFileTypes } from 'pages/factory/file-types'
import { allowedExtensions, extensionList, fileTypeProblem } from './file-types'

const file = (name: string, type = '') => new File(['x'], name, { type })

describe('allowedExtensions', () => {
  it.each([
    ['pdf doc', ['pdf', 'doc']],
    ['.PDF, .png', ['pdf', 'png']],
    ['pdf,png', ['pdf', 'png']],
    ['  ', []],
    ['', []],
    [null, []],
    [undefined, []],
  ])('%j allows %j', (text, extensions) => {
    expect(allowedExtensions(text)).toEqual(extensions)
  })
})

describe('extensionList', () => {
  it.each([
    [['pdf'], '.pdf'],
    [['pdf', 'doc'], '.pdf, .doc'],
    [[], ''],
  ])('%j reads %j', (allowed, text) => {
    expect(extensionList(allowed)).toBe(text)
  })
})

describe('fileTypeProblem', () => {
  it('takes any file when the column names no type', () => {
    expect(
      fileTypeProblem(file('setup.exe', 'application/x-msdownload'), []),
    ).toBe('')
  })

  it.each([
    ['by its name', file('policy.pdf', 'application/pdf'), ['pdf']],
    [
      'whatever the case of its name',
      file('POLICY.PDF', 'application/pdf'),
      ['pdf'],
    ],
    // image/jpeg's own extension is "jpeg": a list asking for jpg takes it.
    [
      'a .jpeg photo where jpg is asked',
      file('photo.jpeg', 'image/jpeg'),
      ['jpg'],
    ],
    [
      'a .jpg photo where jpeg is asked',
      file('photo.jpg', 'image/jpeg'),
      ['jpeg'],
    ],
    ['a renamed photo, by its type', file('photo', 'image/jpeg'), ['jpg']],
    [
      'Markdown, whose type reads "markdown"',
      file('notes.md', 'text/markdown'),
      ['md'],
    ],
    [
      'an mp3, whose type reads "mpga"',
      file('song.mp3', 'audio/mpeg'),
      ['mp3'],
    ],
    ['a QuickTime video', file('clip.mov', 'video/quicktime'), ['mov']],
  ])('takes a file %s', (_, picked, allowed) => {
    expect(fileTypeProblem(picked, allowed)).toBe('')
  })

  it.each([
    [
      file('setup.exe', 'application/x-msdownload'),
      ['pdf', 'png'],
      'Allowed file types: .pdf, .png.',
    ],
    [file('README'), ['pdf'], 'Allowed file types: .pdf.'],
    [
      file('photo.png', 'image/png'),
      ['jpg', 'jpeg'],
      'Allowed file types: .jpg, .jpeg.',
    ],
    [
      file('archive.pdf.zip', 'application/zip'),
      ['pdf'],
      'Allowed file types: .pdf.',
    ],
  ])('refuses %o', (picked, allowed, problem) => {
    expect(fileTypeProblem(picked, allowed)).toBe(problem)
  })

  it.each([
    ['jpg', file('photo.jpeg', 'image/jpeg')],
    ['md', file('notes.markdown', 'text/markdown')],
    ['.PDF', file('policy.pdf', 'application/pdf')],
    ['mov', file('clip.qt', 'video/quicktime')],
  ])('takes what a list deployed with %j asks for', (typed, picked) => {
    // The factory stores the types; the submit form reads them back.
    const allowed = allowedExtensions(normalizeFileTypes(typed))
    expect(fileTypeProblem(picked, allowed)).toBe('')
  })
})
