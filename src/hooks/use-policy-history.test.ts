import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The policy history cache keeps one localStorage entry per list and mode.
 * Entries nothing reads any more are swept once a page load: the ones under
 * the key used before v2, and v2 ones past their day.
 */

vi.mock('utils/fetch-policy-history', () => ({ fetchPolicyHistory: vi.fn() }))

// eslint-disable-next-line import/first
import { resetPolicyCacheSweep, sweepPolicyCache } from './use-policy-history'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_795_700_000_000

/** localStorage as a browser keeps it, in memory. */
const memoryStorage = () => {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  }
}

const entry = (timestamp: number) => JSON.stringify({ data: [], timestamp })

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  resetPolicyCacheSweep()
})

describe('sweepPolicyCache', () => {
  it('removes the former entries and the expired ones, and nothing else', () => {
    localStorage.setItem('policyHistory-full-standard-100-0xa', entry(NOW))
    localStorage.setItem('policyHistory-latest-permanent-1-0xb', entry(NOW))
    localStorage.setItem(
      'policyHistory.v2-full-standard-100-0xc',
      entry(NOW - DAY - 1),
    )
    localStorage.setItem('policyHistory.v2-latest-standard-100-0xd', 'oops')
    localStorage.setItem(
      'policyHistory.v2-full-standard-100-0xe',
      entry(NOW - 60_000),
    )
    localStorage.setItem('tcrState@100@3.0.0', '{"draft":true}')
    localStorage.setItem('curatevision-hero-bounty:v1', 'true')

    sweepPolicyCache(NOW)

    const left = Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index),
    ).sort((a, b) => (a! < b! ? -1 : a! > b! ? 1 : 0))
    expect(left).toEqual([
      'curatevision-hero-bounty:v1',
      'policyHistory.v2-full-standard-100-0xe',
      'tcrState@100@3.0.0',
    ])
  })

  it('sweeps once a page load', () => {
    sweepPolicyCache(NOW)
    localStorage.setItem('policyHistory-full-standard-100-0xa', entry(NOW))
    sweepPolicyCache(NOW)
    expect(
      localStorage.getItem('policyHistory-full-standard-100-0xa'),
    ).not.toBeNull()
  })

  it('does nothing when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      get length(): number {
        throw new Error('SecurityError')
      },
    })
    expect(() => sweepPolicyCache(NOW)).not.toThrow()
  })
})
