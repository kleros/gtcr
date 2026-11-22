import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ipfsPath } from './registry-metadata'

const CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
const CID_V1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
const URI = `/ipfs/${CID}/meta-evidence.json`
const GATEWAY_URL = `https://cdn.kleros.link/ipfs/${CID}/meta-evidence.json`
const NONE = { title: undefined, description: undefined, logoURI: undefined }

/** One distinct MetaEvidence URI per list. */
const uriOf = (index: number) => `/ipfs/${CID}/list-${index}.json`

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

interface Call {
  url: string
  signal?: AbortSignal | null
  answer: (response: Response) => void
}

/** A gateway whose answers the test gives, call by call; reads abort as fetch does. */
const gateway = () => {
  const calls: Call[] = []
  const fetchMock = vi.fn(
    (url: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        calls.push({ url, signal: init?.signal, answer: resolve })
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        )
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock, urls: () => calls.map((call) => call.url) }
}

/** Lets queued reads start: they wait on promises, not on timers. */
const settle = () => vi.advanceTimersByTimeAsync(0)

describe('ipfsPath', () => {
  it.each([
    [`/ipfs/${CID}/meta.json`, `${CID}/meta.json`],
    [`ipfs/${CID}/meta.json`, `${CID}/meta.json`],
    [`ipfs://${CID}/meta.json`, `${CID}/meta.json`],
    [`IPFS://${CID}/meta.json`, `${CID}/meta.json`],
    [CID, CID],
    [`${CID_V1}/meta.json`, `${CID_V1}/meta.json`],
    [`https://ipfs.io/ipfs/${CID}/meta.json`, `${CID}/meta.json`],
    [`http://evil.example/ipfs/${CID}/meta.json`, `${CID}/meta.json`],
    [`  /ipfs/${CID}/meta.json  `, `${CID}/meta.json`],
  ])('reads %j as %j', (uri, path) => {
    expect(ipfsPath(uri)).toBe(path)
  })

  it.each([
    ['a test placeholder', 'ipfs://registrationMetaEvidence'],
    ['a dev path', '/ipfs/dev-123/meta-evidence.json'],
    ['a web address', 'https://example.com/meta.json'],
    ['a CID too short', `/ipfs/${CID.slice(0, -1)}/meta.json`],
    ['an empty value', ''],
    ['nothing', undefined],
    ['null', null],
  ])('is null for %s', (_, uri) => {
    expect(ipfsPath(uri)).toBeNull()
  })
})

describe('readRegistryMetadata', () => {
  let readRegistryMetadata: typeof import('./registry-metadata').readRegistryMetadata

  beforeEach(async () => {
    vi.useFakeTimers()
    // A new session each time: answers, failures and the queue are per module.
    vi.resetModules()
    ;({ readRegistryMetadata } = await import('./registry-metadata'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks nothing for a URI that is not a content address', async () => {
    const { fetchMock } = gateway()
    expect(await readRegistryMetadata('ipfs://registrationMetaEvidence')).toBe(
      null,
    )
    expect(await readRegistryMetadata(undefined)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reads the list's title, description and logo through the gateway", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        metadata: {
          tcrTitle: '  Tokens  ',
          tcrDescription: 'ERC-20 tokens',
          logoURI: `/ipfs/${CID}/logo.png`,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    expect(await readRegistryMetadata(URI)).toEqual({
      title: 'Tokens',
      description: 'ERC-20 tokens',
      logoURI: `/ipfs/${CID}/logo.png`,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      GATEWAY_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it.each([
    [
      'the plain metadata keys',
      { metadata: { title: 'A', description: 'B', logo: 'C' } },
      { title: 'A', description: 'B', logoURI: 'C' },
    ],
    [
      'the top-level keys of older files',
      { tcrTitle: 'A', description: 'B', logoURI: 'C' },
      { title: 'A', description: 'B', logoURI: 'C' },
    ],
    [
      'a registryTitle',
      { registryTitle: 'A', tcrDescription: 'B' },
      { title: 'A', description: 'B', logoURI: undefined },
    ],
    [
      'a file wrapped in "data"',
      { data: { metadata: { tcrTitle: 'A' } } },
      { title: 'A', description: undefined, logoURI: undefined },
    ],
  ])('reads %s', async (_, file, metadata) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(file)),
    )
    expect(await readRegistryMetadata(URI)).toEqual(metadata)
  })

  it('reads "-" and blank text as no title or description', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({ metadata: { tcrTitle: '-', tcrDescription: '   ' } }),
      ),
    )
    expect(await readRegistryMetadata(URI)).toEqual(NONE)
  })

  it.each([
    [
      'fields that are not text',
      {
        metadata: {
          tcrTitle: { toString: 1 },
          tcrDescription: 5,
          logoURI: ['x'],
        },
      },
    ],
    ['metadata that is text', { metadata: 'Tokens' }],
    ['metadata that is null', { metadata: null, data: null }],
    ['null', null],
    ['an array', [{ metadata: { tcrTitle: 'A' } }]],
    ['a number', 42],
    ['text', 'Tokens'],
  ])('invents nothing from a file holding %s', async (_, file) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(file)),
    )
    expect(await readRegistryMetadata(URI)).toEqual(NONE)
  })

  it('is null for a file that is not JSON, and keeps that answer', async () => {
    const fetchMock = vi.fn(
      async () => new Response('¢dag-cbor', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    expect(await readRegistryMetadata(URI)).toBeNull()
    expect(await readRegistryMetadata(URI)).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('is null for a file the gateway does not have, and keeps that answer', async () => {
    const fetchMock = vi.fn(async () => json({ error: 'not found' }, 404))
    vi.stubGlobal('fetch', fetchMock)
    expect(await readRegistryMetadata(URI)).toBeNull()
    expect(await readRegistryMetadata(URI)).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('reads each path once a session, whatever shape its URI takes', async () => {
    const fetchMock = vi.fn(async () => json({ metadata: { tcrTitle: 'A' } }))
    vi.stubGlobal('fetch', fetchMock)
    await readRegistryMetadata(URI)
    await readRegistryMetadata(`ipfs://${CID}/meta-evidence.json`)
    await readRegistryMetadata(`https://ipfs.io/ipfs/${CID}/meta-evidence.json`)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('shares one read between callers asking at the same time', async () => {
    const { calls, fetchMock } = gateway()
    const first = readRegistryMetadata(URI)
    const second = readRegistryMetadata(`ipfs/${CID}/meta-evidence.json`, {
      urgent: true,
    })
    await settle()
    calls[0].answer(json({ metadata: { tcrTitle: 'A' } }))
    expect(await first).toEqual({ ...NONE, title: 'A' })
    expect(await second).toBe(await first)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.each([500, 502, 503, 504, 408, 429])(
    'throws when the gateway answers %i, so the caller can retry',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => json({}, status)),
      )
      await expect(readRegistryMetadata(URI)).rejects.toThrow(
        `Gateway ${status}`,
      )
    },
  )

  it('waits longer after each failure in a row, up to ten minutes', async () => {
    const fetchMock = vi.fn(async () => json({}, 503))
    vi.stubGlobal('fetch', fetchMock)
    const pauses = [30, 60, 120, 240, 480, 600, 600].map((s) => s * 1000)
    for (const pause of pauses) {
      await expect(readRegistryMetadata(URI)).rejects.toThrow('Gateway 503')
      await vi.advanceTimersByTimeAsync(pause - 1)
      // Refused at once, without asking the gateway again.
      await expect(readRegistryMetadata(URI)).rejects.toThrow('failed recently')
      await vi.advanceTimersByTimeAsync(1)
    }
    expect(fetchMock).toHaveBeenCalledTimes(pauses.length)
  })

  it('keeps a success that follows a failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValue(json({ metadata: { tcrTitle: 'A' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(readRegistryMetadata(URI)).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await readRegistryMetadata(URI)).toEqual({ ...NONE, title: 'A' })
    expect(await readRegistryMetadata(URI)).toEqual({ ...NONE, title: 'A' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up on a gateway that hangs after 8 seconds, as a failure', async () => {
    const { calls, fetchMock } = gateway()
    const read = readRegistryMetadata(URI).catch((err: Error) => err.name)
    await settle()
    await vi.advanceTimersByTimeAsync(7_999)
    expect(calls[0].signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await read).toBe('AbortError')
    await expect(readRegistryMetadata(URI)).rejects.toThrow('failed recently')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('reads at most six lists at once; the rest wait their turn', async () => {
    const { calls, urls } = gateway()
    const reads = Array.from({ length: 8 }, (_, index) =>
      readRegistryMetadata(uriOf(index)),
    )
    await settle()
    expect(calls).toHaveLength(6)
    calls[0].answer(json({}))
    await settle()
    expect(calls).toHaveLength(7)
    expect(urls()[6]).toContain('list-6.json')
    for (const call of calls.slice(1)) call.answer(json({}))
    await settle()
    calls[7].answer(json({}))
    await expect(Promise.all(reads)).resolves.toHaveLength(8)
  })

  it('starts a list on screen before lists read in the background', async () => {
    const { calls, urls } = gateway()
    const reads = Array.from({ length: 6 }, (_, index) =>
      readRegistryMetadata(uriOf(index)),
    )
    reads.push(
      readRegistryMetadata(uriOf(6)),
      readRegistryMetadata(uriOf(7), { urgent: true }),
    )
    await settle()
    calls[0].answer(json({}))
    await settle()
    expect(urls()[6]).toContain('list-7.json')
    for (const call of calls.slice(1)) call.answer(json({}))
    await settle()
    for (const call of calls.slice(7)) call.answer(json({}))
    await Promise.all(reads)
  })

  it('moves a queued background read ahead once a list on screen needs it', async () => {
    const { calls, urls } = gateway()
    const reads = Array.from({ length: 8 }, (_, index) =>
      readRegistryMetadata(uriOf(index)),
    )
    // list-7 waits behind list-6, until it is asked for urgently.
    reads.push(readRegistryMetadata(uriOf(7), { urgent: true }))
    await settle()
    calls[0].answer(json({}))
    await settle()
    expect(urls()[6]).toContain('list-7.json')
    for (const call of calls.slice(1)) call.answer(json({}))
    await settle()
    for (const call of calls.slice(7)) call.answer(json({}))
    await Promise.all(reads)
  })

  it('starts the 8 seconds when a read leaves the queue, not when it joins it', async () => {
    const { calls } = gateway()
    const reads = Array.from({ length: 7 }, (_, index) =>
      readRegistryMetadata(uriOf(index)).catch(() => 'failed'),
    )
    await settle()
    expect(calls).toHaveLength(6)
    // The first six time out; only then does the seventh go.
    await vi.advanceTimersByTimeAsync(8_000)
    expect(calls).toHaveLength(7)
    await vi.advanceTimersByTimeAsync(7_999)
    expect(calls[6].signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls[6].signal?.aborted).toBe(true)
    expect(await Promise.all(reads)).toEqual(new Array(7).fill('failed'))
  })
})
