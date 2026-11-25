import { Roles } from '@kleros/kleros-app'
import { describe, expect, it, vi } from 'vitest'
import { uploadOnce } from './upload-once'

const json = (data: unknown, name = 'reg-meta-evidence.json') =>
  new File([JSON.stringify(data)], name, { type: 'application/json' })

const RULES = { title: 'Add an entry to QA', metadata: { tcrTitle: 'QA' } }

/** An Atlas whose answer is a path per call, as uploads that succeed. */
const atlas = () => {
  let calls = 0
  return vi.fn(async () => `/ipfs/Qm${++calls}`)
}

describe('uploadOnce', () => {
  it('gives a deploy sent again the path its file got, without uploading it again', async () => {
    const uploadFile = atlas()
    const known = new Map<string, string>()

    const first = await uploadOnce(
      uploadFile,
      known,
      json(RULES),
      Roles.Generic,
    )
    // The same list's file, written afresh for the second attempt.
    const again = await uploadOnce(
      uploadFile,
      known,
      json(RULES),
      Roles.Generic,
    )

    expect(again).toBe(first)
    expect(uploadFile).toHaveBeenCalledTimes(1)
  })

  it('uploads a file whose text changed (a badges file naming another list address)', async () => {
    const uploadFile = atlas()
    const known = new Map<string, string>()

    await uploadOnce(uploadFile, known, json({ parent: '0x1' }), Roles.Generic)
    const changed = await uploadOnce(
      uploadFile,
      known,
      json({ parent: '0x2' }),
      Roles.Generic,
    )

    expect(changed).toBe('/ipfs/Qm2')
    expect(uploadFile).toHaveBeenCalledTimes(2)
  })

  it('keeps roles apart', async () => {
    const uploadFile = atlas()
    const known = new Map<string, string>()

    await uploadOnce(uploadFile, known, json(RULES), Roles.Generic)
    await uploadOnce(uploadFile, known, json(RULES), Roles.MetaEvidence)

    expect(uploadFile).toHaveBeenCalledTimes(2)
  })

  it('remembers nothing from a refused upload or an empty answer', async () => {
    const known = new Map<string, string>()
    const refused = vi
      .fn()
      .mockRejectedValueOnce(new Error('ThrottlerException: Too Many Requests'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('/ipfs/QmLater')

    await expect(
      uploadOnce(refused, known, json(RULES), Roles.Generic),
    ).rejects.toThrow('ThrottlerException')
    expect(await uploadOnce(refused, known, json(RULES), Roles.Generic)).toBe(
      null,
    )
    expect(await uploadOnce(refused, known, json(RULES), Roles.Generic)).toBe(
      '/ipfs/QmLater',
    )
    expect(refused).toHaveBeenCalledTimes(3)
  })

  it('uploads any other file every time: only the JSON the app writes is remembered', async () => {
    const uploadFile = atlas()
    const known = new Map<string, string>()
    const logo = () =>
      new File([new Uint8Array([137, 80])], 'logo.png', { type: 'image/png' })

    await uploadOnce(uploadFile, known, logo(), Roles.Logo)
    await uploadOnce(uploadFile, known, logo(), Roles.Logo)

    expect(uploadFile).toHaveBeenCalledTimes(2)
    expect(known.size).toBe(0)
  })
})
