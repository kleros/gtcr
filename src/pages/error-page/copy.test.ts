import { afterEach, describe, expect, it, vi } from 'vitest'
import * as copy from './copy'
import { INDEXING_GRACE_MS, justSubmitted, missingEntryPollMs } from './copy'

const NOW = Date.UTC(2026, 10, 22, 12)

/** Every wait a reader sits through before the page settles on "not found". */
const waits = (recentlySubmitted: boolean): number[] => {
  const all: number[] = []
  for (let answers = 0; ; answers += 1) {
    const wait = missingEntryPollMs(answers, recentlySubmitted)
    if (wait === false) return all
    all.push(wait)
  }
}

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0)

describe('missingEntryPollMs', () => {
  it.each([
    [0, 10_000],
    [11, 10_000],
    [12, false],
    [40, false],
  ])('looks for a linked entry every 10 s (answer %i: %s)', (answers, wait) => {
    expect(missingEntryPollMs(answers, false)).toBe(wait)
  })

  it('tries a link for two minutes in all', () => {
    expect(sum(waits(false))).toBe(2 * 60_000)
  })

  it.each([
    [0, 5000],
    [23, 5000],
    [24, 30_000],
    [49, 30_000],
    [50, false],
  ])(
    'looks for a just-submitted entry often, then less (answer %i: %s)',
    (answers, wait) => {
      expect(missingEntryPollMs(answers, true)).toBe(wait)
    },
  )

  it('polls a just-submitted entry every 5 s for its first two minutes', () => {
    const fast = waits(true).filter((wait) => wait === 5000)
    expect(sum(fast)).toBe(2 * 60_000)
  })

  it('keeps looking for a just-submitted entry until the grace runs out', () => {
    expect(sum(waits(true))).toBe(INDEXING_GRACE_MS)
  })
})

describe('justSubmitted', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['a submission a minute ago', { submittedAt: NOW - 60_000 }, true],
    [
      'a submission just inside the grace',
      { submittedAt: NOW - INDEXING_GRACE_MS + 1 },
      true,
    ],
    [
      'a submission exactly the grace ago',
      { submittedAt: NOW - INDEXING_GRACE_MS },
      false,
    ],
    ['an old submission', { submittedAt: NOW - 3_600_000 }, false],
    ['a time that is not a number', { submittedAt: String(NOW) }, false],
    ['no submission time', {}, false],
    ['no state', null, false],
    ['an undefined state', undefined, false],
  ])('%s', (_name, state, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    expect(justSubmitted(state)).toBe(expected)
  })
})

describe('the page copy', () => {
  const failures = [
    copy.ENTRY_LOAD_FAILED,
    copy.LIST_LOAD_FAILED,
    copy.LIST_FILE_FAILED,
    copy.LIST_SETTINGS_FAILED,
  ]
  const missing = [copy.ENTRY_LINK_TIP, copy.ENTRY_MISSING_TIP]
  const every = [
    ...failures,
    ...missing,
    copy.ENTRY_INDEXING_TITLE,
    copy.ENTRY_INDEXING_MESSAGE,
  ]

  it('offers to try again where a read failed', () => {
    for (const text of failures) expect(text).toMatch(/Try again/)
  })

  it('says what to check, not to try again, where nothing is there', () => {
    for (const text of missing) {
      expect(text).toMatch(/Check the link/)
      expect(text).not.toMatch(/try again/i)
    }
  })

  it('never blames the wallet or its network', () => {
    for (const text of every) expect(text).not.toMatch(/wallet|network/i)
  })

  it('says list, not registry, and has no exclamation marks', () => {
    for (const text of every) {
      expect(text).not.toMatch(/registr|\bTCR\b/i)
      expect(text).not.toContain('!')
    }
  })
})
