import { parse, print } from 'graphql'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// From vitest.config.ts: the Envio (Standard) indexer batches, Stake does not.
const STANDARD = 'https://standard.indexer.test/100'
const STANDARD_MAINNET = 'https://standard.indexer.test/1'
const STAKE = 'https://stake.indexer.test/100'
const QUERY = 'query Items($first: Int) { items(first: $first) { id } }'

type Module = typeof import('./indexer-request')
let request: Module['request']
let IndexerError: Module['IndexerError']

interface Sent {
  query: string
  variables?: Record<string, unknown>
}

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

type FetchMock = ReturnType<typeof stubFetch>

const stubFetch = (answer: (body: unknown) => Response | Promise<Response>) => {
  const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) =>
    answer(JSON.parse(String(init?.body))),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** An indexer that answers each query with its own variables. */
const echoingIndexer = () =>
  stubFetch((body) =>
    respond(
      Array.isArray(body)
        ? body.map((sent: Sent) => ({ data: { echo: sent.variables } }))
        : { data: { echo: (body as Sent).variables } },
    ),
  )

const sentIn = (fetchMock: FetchMock, call = 0): Sent[] =>
  JSON.parse(String(fetchMock.mock.calls[call][1]?.body))

/** A read's outcome, held so a rejection is never left unhandled. */
const outcome = (promise: Promise<unknown>) =>
  promise.then(
    (value) => ({ value, error: undefined }),
    (error: unknown) => ({ value: undefined, error }),
  )

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms)

beforeEach(async () => {
  vi.useFakeTimers()
  // The module schedules with window.setTimeout; Node has no window.
  vi.stubGlobal('window', globalThis)
  // Fresh queues and backoff for each test.
  vi.resetModules()
  ;({ request, IndexerError } = await import('./indexer-request'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('batching on the Standard indexer', () => {
  it('sends what is asked within 12 ms as one request, each caller getting its own answer', async () => {
    const fetchMock = echoingIndexer()
    const answers = Promise.all([
      request(STANDARD, QUERY, { first: 1 }),
      request(STANDARD, QUERY, { first: 2 }),
      request({ url: STANDARD, document: QUERY, variables: { first: 3 } }),
    ])
    await advance(11)
    expect(fetchMock).not.toHaveBeenCalled()
    await advance(1)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(STANDARD)
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
    })
    expect(sentIn(fetchMock)).toEqual([
      { query: QUERY, variables: { first: 1 } },
      { query: QUERY, variables: { first: 2 } },
      { query: QUERY, variables: { first: 3 } },
    ])
    expect(await answers).toEqual([
      { echo: { first: 1 } },
      { echo: { first: 2 } },
      { echo: { first: 3 } },
    ])
  })

  it('sends what is asked after the window in a request of its own', async () => {
    const fetchMock = echoingIndexer()
    const first = request(STANDARD, QUERY, { first: 1 })
    await advance(12)
    const second = request(STANDARD, QUERY, { first: 2 })
    await advance(12)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await first).toEqual({ echo: { first: 1 } })
    expect(await second).toEqual({ echo: { first: 2 } })
  })

  it('sends identical reads once and answers every caller', async () => {
    const fetchMock = echoingIndexer()
    const reads = [
      request(STANDARD, QUERY, { first: 1 }),
      request(STANDARD, QUERY, { first: 1 }),
      request(STANDARD, QUERY, { first: 2 }),
    ]
    await advance(12)
    expect(sentIn(fetchMock)).toHaveLength(2)
    expect(await Promise.all(reads)).toEqual([
      { echo: { first: 1 } },
      { echo: { first: 1 } },
      { echo: { first: 2 } },
    ])
  })

  it('sends a full batch of 12 at once, and the rest in the next request', async () => {
    const fetchMock = echoingIndexer()
    const reads = Array.from({ length: 13 }, (_, index) =>
      request(STANDARD, QUERY, { first: index }),
    )
    await advance(0)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(sentIn(fetchMock)).toHaveLength(12)
    await advance(12)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentIn(fetchMock, 1)).toEqual([
      { query: QUERY, variables: { first: 12 } },
    ])
    expect(await Promise.all(reads)).toHaveLength(13)
  })

  it('prints a parsed document as the query text', async () => {
    const fetchMock = echoingIndexer()
    const document = parse('query Registries { registries(first: 1) { id } }')
    const read = request({ url: STANDARD, document })
    await advance(12)
    expect(sentIn(fetchMock)).toEqual([{ query: print(document) }])
    await read
  })

  it('keeps one queue per indexer URL', async () => {
    const fetchMock = echoingIndexer()
    const reads = [
      request(STANDARD, QUERY, { first: 1 }),
      request(STANDARD_MAINNET, QUERY, { first: 1 }),
    ]
    await advance(12)
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
      STANDARD_MAINNET,
      STANDARD,
    ])
    await Promise.all(reads)
  })
})

describe('errors on the Standard indexer', () => {
  it("rejects only the query the indexer answered with errors, with the indexer's words", async () => {
    stubFetch(() =>
      respond([
        { data: { items: [] } },
        { errors: [{ message: 'Cannot query field "x"' }] },
        {},
        null,
      ]),
    )
    const [ok, refused, empty, missing] = [1, 2, 3, 4].map((first) =>
      outcome(request(STANDARD, QUERY, { first })),
    )
    await advance(12)
    expect((await ok).value).toEqual({ items: [] })
    const { error } = await refused
    expect(error).toBeInstanceOf(IndexerError)
    expect(error).toMatchObject({
      name: 'IndexerError',
      message: 'Cannot query field "x"',
      errors: [{ message: 'Cannot query field "x"' }],
    })
    for (const read of [empty, missing])
      expect((await read).error).toMatchObject({
        message: 'The indexer returned no data.',
      })
  })

  it('rejects every query of a request the indexer refused, with its status', async () => {
    stubFetch(() => respond({ error: 'unavailable' }, 503))
    const reads = [1, 2].map((first) =>
      outcome(request(STANDARD, QUERY, { first })),
    )
    await advance(12)
    for (const { error } of await Promise.all(reads)) {
      expect(error).toBeInstanceOf(IndexerError)
      expect(error).toMatchObject({
        message: 'The indexer answered 503.',
        status: 503,
      })
    }
  })

  it.each([
    ['not a list', { data: { items: [] } }],
    ['one answer short', [{ data: { items: [] } }]],
  ])('rejects every query when the answer is %s', async (_, body) => {
    stubFetch(() => respond(body))
    const reads = [1, 2].map((first) =>
      outcome(request(STANDARD, QUERY, { first })),
    )
    await advance(12)
    for (const { error } of await Promise.all(reads))
      expect(error).toMatchObject({
        name: 'IndexerError',
        message: 'The indexer answered in an unexpected shape.',
      })
  })

  it('passes on the error of a request that never reached the indexer', async () => {
    const failure = new TypeError('Failed to fetch')
    stubFetch(() => Promise.reject(failure))
    const read = outcome(request(STANDARD, QUERY, { first: 1 }))
    await advance(12)
    expect((await read).error).toBe(failure)
  })
})

describe('backing off after a refusal', () => {
  it('holds the next requests back longer after each refusal, up to 30 seconds', async () => {
    const fetchMock = stubFetch(() => Promise.reject(new TypeError('Failed')))
    void outcome(request(STANDARD, QUERY, { first: 0 }))
    await advance(12)
    expect(fetchMock).toHaveBeenCalledOnce()
    for (const pause of [1, 2, 4, 8, 16, 30, 30].map((s) => s * 1000)) {
      const sent = fetchMock.mock.calls.length
      void outcome(request(STANDARD, QUERY, { first: sent }))
      await advance(pause - 1)
      expect(fetchMock).toHaveBeenCalledTimes(sent)
      await advance(1)
      expect(fetchMock).toHaveBeenCalledTimes(sent + 1)
    }
  })

  it('stops holding back once the indexer answers again', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed'))
      .mockResolvedValueOnce(respond([{ data: {} }]))
      .mockRejectedValueOnce(new TypeError('Failed'))
      .mockResolvedValue(respond([{ data: {} }]))
    vi.stubGlobal('fetch', fetchMock)
    void outcome(request(STANDARD, QUERY, { first: 1 }))
    await advance(12)
    // Refused: the next request waits a second, then is answered.
    const second = outcome(request(STANDARD, QUERY, { first: 2 }))
    await advance(1000)
    expect((await second).error).toBeUndefined()
    // Answered: no pause, just the batching window.
    void outcome(request(STANDARD, QUERY, { first: 3 }))
    await advance(12)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    // Refused again: the pause starts over at one second.
    void outcome(request(STANDARD, QUERY, { first: 4 }))
    await advance(999)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await advance(1)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('does not hold back another indexer URL', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url === STANDARD
        ? Promise.reject(new TypeError('Failed'))
        : respond([{ data: {} }]),
    )
    vi.stubGlobal('fetch', fetchMock)
    void outcome(request(STANDARD, QUERY, { first: 1 }))
    await advance(12)
    const other = outcome(request(STANDARD_MAINNET, QUERY, { first: 1 }))
    await advance(12)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((await other).error).toBeUndefined()
  })

  // Regression: schedule() and flush() in indexer-request.ts. A query asked while
  // a request is in flight arms its 12 ms window before the refusal is
  // known; when the refusal lands inside that window, the timer still fires
  // and flush() never checks pausedUntil, so the batch leaves at once. The
  // pause the comment on `pausedUntil` promises ("No request leaves before
  // this time") does not cover it.
  it('holds back a read that was waiting for its window when the indexer refused', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => {
        // The indexer refuses 5 ms after the request leaves.
        await new Promise((resolve) => setTimeout(resolve, 5))
        throw new TypeError('Failed to fetch')
      })
      .mockImplementation(async () => respond([{ data: {} }]))
    vi.stubGlobal('fetch', fetchMock)
    const first = outcome(request(STANDARD, QUERY, { first: 1 }))
    await advance(12) // t=12: the first request leaves
    const second = outcome(request(STANDARD, QUERY, { first: 2 })) // window ends at t=24
    // t=17: refused, so held back until t=1017.
    await advance(15) // t=27
    expect(fetchMock).toHaveBeenCalledOnce()
    await advance(1000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await Promise.all([first, second])
  })
})

describe('aborted reads', () => {
  const abortError = { name: 'AbortError' }

  it('refuses at once a read whose signal is already aborted', async () => {
    const fetchMock = echoingIndexer()
    const controller = new AbortController()
    controller.abort()
    const read = outcome(
      request({ url: STANDARD, document: QUERY, signal: controller.signal }),
    )
    await advance(12)
    expect((await read).error).toMatchObject(abortError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('drops a read aborted while it waits; the others still go', async () => {
    const fetchMock = echoingIndexer()
    const controller = new AbortController()
    const dropped = outcome(
      request({
        url: STANDARD,
        document: QUERY,
        variables: { first: 1 },
        signal: controller.signal,
      }),
    )
    const kept = request(STANDARD, QUERY, { first: 2 })
    await advance(5)
    controller.abort()
    await advance(7)
    expect((await dropped).error).toMatchObject(abortError)
    expect(sentIn(fetchMock)).toEqual([
      { query: QUERY, variables: { first: 2 } },
    ])
    expect(await kept).toEqual({ echo: { first: 2 } })
  })

  it('sends nothing when the only read waiting is aborted', async () => {
    const fetchMock = echoingIndexer()
    const controller = new AbortController()
    const read = outcome(
      request({ url: STANDARD, document: QUERY, signal: controller.signal }),
    )
    controller.abort()
    await advance(12)
    expect((await read).error).toMatchObject(abortError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops waiting once aborted, even after the request left', async () => {
    let answer = (_: Response) => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve
          }),
      ),
    )
    const controller = new AbortController()
    const read = outcome(
      request({ url: STANDARD, document: QUERY, signal: controller.signal }),
    )
    await advance(12)
    controller.abort()
    expect((await read).error).toMatchObject(abortError)
    answer(respond([{ data: {} }]))
    await advance(0)
  })
})

describe('other endpoints', () => {
  it('sends a Stake indexer query on its own, without waiting', async () => {
    const fetchMock = echoingIndexer()
    const reads = [
      request(STAKE, QUERY, { first: 1 }),
      request({ url: STAKE, document: QUERY, variables: { first: 2 } }),
    ]
    expect(await Promise.all(reads)).toEqual([
      { echo: { first: 1 } },
      { echo: { first: 2 } },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toBe(STAKE)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      query: QUERY,
      variables: { first: 1 },
    })
  })

  it('rejects a Stake indexer query answered with errors', async () => {
    stubFetch(() => respond({ errors: [{ message: 'Unknown field "x"' }] }))
    await expect(request(STAKE, QUERY, { first: 1 })).rejects.toThrow(
      'Unknown field "x"',
    )
  })
})
