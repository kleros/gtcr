import { AuthorizationError, Roles } from '@kleros/kleros-app'
import { describe, expect, it } from 'vitest'
import {
  atlasLimit,
  atlasUploadProblem,
  describeTypes,
  formatLimit,
  uploadFailure,
  type AtlasRole,
} from './upload-restrictions'

const KB = 1024
const MB = 1024 * KB

// The shape of Atlas's public `roles` query: names are the Roles enum's keys.
const RESTRICTIONS: AtlasRole[] = [
  {
    name: 'Evidence',
    restriction: {
      maxSize: 20 * MB,
      allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
    },
  },
  {
    name: 'CurateItemImage',
    restriction: { maxSize: 2 * MB, allowedMimeTypes: ['image/*'] },
  },
  {
    name: 'Policy',
    restriction: { maxSize: KB, allowedMimeTypes: ['application/pdf'] },
  },
]

const file = (type: string, size = 1, name = 'upload') =>
  new File([new Uint8Array(size)], name, { type })

// What kleros-app's own upload throws when Atlas's size check fails.
const tooBigMessage = (maxSize: number) =>
  `File too big. Max allowed size : ${(maxSize / (1024 * 1024)).toFixed(2)} mb.`

describe('atlasLimit', () => {
  it("finds a role's limits by the role Atlas names", () => {
    expect(atlasLimit(Roles.CurateItemImage, RESTRICTIONS)).toEqual({
      maxSize: 2 * MB,
      allowedMimeTypes: ['image/*'],
    })
  })

  it('has none before Atlas answers, or for a role it does not list', () => {
    expect(atlasLimit(Roles.Evidence)).toBeUndefined()
    expect(atlasLimit(Roles.Logo, RESTRICTIONS)).toBeUndefined()
  })
})

describe('describeTypes', () => {
  it.each([
    [['application/pdf'], 'PDF'],
    [['application/pdf', 'image/png'], 'PDF or PNG'],
    [['application/pdf', 'image/png', 'image/jpeg'], 'PDF, PNG or JPEG'],
    [['image/*'], 'any image'],
    [
      ['video/*', 'text/markdown', 'text/plain'],
      'any video, Markdown or plain text',
    ],
    [['image/svg+xml'], 'SVG+XML'],
    [['application/x-zip-compressed'], 'ZIP-COMPRESSED'],
    [['pdf'], 'PDF'],
  ])('names %j as "%s"', (types, words) => {
    expect(describeTypes(types)).toBe(words)
  })

  it('says each name once', () => {
    expect(describeTypes(['image/png', 'image/png', 'image/x-png'])).toBe('PNG')
  })

  it('says nothing for no types', () => {
    expect(describeTypes([])).toBe('')
  })
})

describe('formatLimit', () => {
  it.each([
    [20 * MB, '20 MB'],
    [1.5 * MB, '1.5 MB'],
    [2.25 * MB, '2.3 MB'],
    [MB, '1 MB'],
    [400 * KB, '400 KB'],
    [KB, '1 KB'],
  ])('writes %i bytes as %s', (bytes, text) => {
    expect(formatLimit(bytes)).toBe(text)
  })
})

describe('atlasUploadProblem', () => {
  it('finds nothing to refuse before Atlas has said what it takes', () => {
    expect(atlasUploadProblem(file('application/zip'), Roles.Evidence)).toBe('')
    expect(
      atlasUploadProblem(file('application/zip'), Roles.Logo, RESTRICTIONS),
    ).toBe('')
  })

  it('takes a file of a listed type within the limit, up to the limit itself', () => {
    expect(
      atlasUploadProblem(file('image/png'), Roles.Evidence, RESTRICTIONS),
    ).toBe('')
    expect(
      atlasUploadProblem(
        file('application/pdf', KB),
        Roles.Policy,
        RESTRICTIONS,
      ),
    ).toBe('')
  })

  it('refuses a type the role does not take, naming the ones it does', () => {
    expect(
      atlasUploadProblem(file('application/zip'), Roles.Evidence, RESTRICTIONS),
    ).toBe('This file type is not accepted here. Use PDF, PNG or JPEG.')
  })

  it('takes any type of a family for "image/*", and only that family', () => {
    for (const type of ['image/png', 'image/webp', 'image/svg+xml'])
      expect(
        atlasUploadProblem(file(type), Roles.CurateItemImage, RESTRICTIONS),
      ).toBe('')
    for (const type of ['application/pdf', 'imagex/png', 'video/mp4'])
      expect(
        atlasUploadProblem(file(type), Roles.CurateItemImage, RESTRICTIONS),
      ).toBe('This file type is not accepted here. Use any image.')
  })

  it('refuses a file the browser gave no type, as Atlas does', () => {
    expect(atlasUploadProblem(file(''), Roles.Evidence, RESTRICTIONS)).toMatch(
      /not accepted/,
    )
  })

  it('refuses a file over the limit, naming the limit', () => {
    expect(
      atlasUploadProblem(
        file('application/pdf', KB + 1),
        Roles.Policy,
        RESTRICTIONS,
      ),
    ).toBe('The file is too big: the limit is 1 KB.')
  })

  it('names the type before the size when both are wrong', () => {
    expect(
      atlasUploadProblem(file('image/png', KB + 1), Roles.Policy, RESTRICTIONS),
    ).toMatch(/file type is not accepted/)
  })
})

describe('uploadFailure', () => {
  it('asks to sign in again when the sign-in expired', () => {
    expect(uploadFailure(new AuthorizationError('jwt expired'))).toBe(
      'Your sign-in expired. Sign in again, then pick the file again.',
    )
  })

  it("explains Atlas's type refusal", () => {
    expect(uploadFailure(new Error('Unsupported file type.'))).toBe(
      'File upload failed: this file type is not accepted here.',
    )
  })

  it.each([
    [20 * MB, 20],
    [0.5 * MB, 0.5],
    [1.5 * MB, 1.5],
  ])(
    'reads the limit from the size refusal kleros-app throws (%i bytes)',
    (maxSize, mb) => {
      expect(uploadFailure(new Error(tooBigMessage(maxSize)))).toBe(
        `File upload failed: the file is too big (the limit is ${mb} MB).`,
      )
    },
  )

  it('passes any other reason on', () => {
    expect(uploadFailure(new Error('Network request failed'))).toBe(
      'File upload failed: Network request failed',
    )
  })

  it('says only that it failed when there is no reason', () => {
    for (const error of [undefined, null, {}, new Error(''), 'boom'])
      expect(uploadFailure(error)).toBe('File upload failed.')
  })
})
