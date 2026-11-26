import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmStored } from './confirm-stored'

/*
 * A file just uploaded is read back before anything points to it, and only
 * the answer's status is wanted: the download stops there, since the file
 * can be a policy PDF of several megabytes.
 */

const signals: AbortSignal[] = []

beforeEach(() => {
  signals.length = 0
  // Called through, so fake timers installed later are the ones used.
  vi.stubGlobal('window', {
    setTimeout: (run: () => void, ms: number) => setTimeout(run, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('confirmStored', () => {
  it('stops the download once the gateway answers', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal)
      return new Response('%PDF-1.4 …', { status: 200 })
    })
    await confirmStored('/ipfs/QmPolicy/policy.pdf')
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(true)
  })

  it('asks again while the gateway is behind, and refuses when it never answers', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal)
      return new Response('not found', { status: 404 })
    })
    const confirmed = confirmStored('/ipfs/QmMissing/file.json')
    const refused = expect(confirmed).rejects.toThrow(/could not be read back/)
    await vi.runAllTimersAsync()
    await refused
    expect(signals).toHaveLength(4)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })
})
