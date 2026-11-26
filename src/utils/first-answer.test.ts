import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { firstAnswer } from './first-answer'

/** An endpoint the test answers by hand, with when it was asked. */
interface Asked {
  endpoint: string
  at: number
  answer: (value: string | null) => void
  fail: () => void
}

const endpoints = () => {
  const asked: Asked[] = []
  const ask = vi.fn(
    (endpoint: string) =>
      new Promise<string | null>((resolve, reject) => {
        asked.push({
          endpoint,
          at: Date.now(),
          answer: resolve,
          fail: () => reject(new Error('down')),
        })
      }),
  )
  return { asked, ask }
}

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('firstAnswer', () => {
  it('asks only the first endpoint when it answers in time', async () => {
    const { asked, ask } = endpoints()
    const read = firstAnswer(['a', 'b'], ask, 1000)
    await advance(999)
    asked[0].answer('from a')
    expect(await read).toBe('from a')
    await advance(5000)
    expect(ask).toHaveBeenCalledOnce()
  })

  it('asks the next endpoint at once when one fails', async () => {
    const { asked, ask } = endpoints()
    const read = firstAnswer(['a', 'b', 'c'], ask, 1000)
    await advance(10)
    asked[0].fail()
    await advance(0)
    expect(asked.map((a) => a.endpoint)).toEqual(['a', 'b'])
    asked[1].answer(null)
    await advance(0)
    expect(asked.map((a) => a.endpoint)).toEqual(['a', 'b', 'c'])
    asked[2].answer('from c')
    expect(await read).toBe('from c')
  })

  it('asks the next endpoint as well when one is slow, and takes the first answer', async () => {
    const { asked, ask } = endpoints()
    const read = firstAnswer(['a', 'b'], ask, 1000)
    await advance(999)
    expect(asked).toHaveLength(1)
    await advance(1)
    expect(asked.map((a) => a.endpoint)).toEqual(['a', 'b'])
    asked[1].answer('from b')
    expect(await read).toBe('from b')
    // The slow one answering later changes nothing.
    asked[0].answer('from a')
    await advance(0)
    expect(await read).toBe('from b')
  })

  it('still takes the slow endpoint when it answers first', async () => {
    const { asked, ask } = endpoints()
    const read = firstAnswer(['a', 'b'], ask, 1000)
    await advance(1000)
    asked[0].answer('from a')
    expect(await read).toBe('from a')
  })

  it('waits for an endpoint still running when the last one fails', async () => {
    const { asked, ask } = endpoints()
    const read = firstAnswer(['a', 'b'], ask, 1000)
    await advance(1000)
    asked[1].fail()
    await advance(0)
    const pending = Symbol('pending')
    expect(await Promise.race([read, advance(0).then(() => pending)])).toBe(
      pending,
    )
    asked[0].answer('from a')
    expect(await read).toBe('from a')
  })

  it('is null once every endpoint failed', async () => {
    const { asked, ask } = endpoints()
    const read = firstAnswer(['a', 'b'], ask, 1000)
    await advance(1000)
    asked[0].answer(null)
    asked[1].fail()
    expect(await read).toBeNull()
  })

  it('is null with no endpoint, asking nothing', async () => {
    const { ask } = endpoints()
    expect(await firstAnswer([], ask)).toBeNull()
    expect(ask).not.toHaveBeenCalled()
  })
})
