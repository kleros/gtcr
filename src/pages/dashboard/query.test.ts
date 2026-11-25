import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DASHBOARD_LIVE_MS,
  DASHBOARD_QUERY_KEY,
  DASHBOARD_REFRESH_MS,
  TESTNET_DASHBOARD_QUERY_KEY,
  dashboardRefreshIn,
  isLiveLoad,
} from './query'

const NOW = Date.UTC(2026, 10, 22, 12)
const MINUTE = 60_000

const loaded = (data?: { generatedAt?: number; failedChains?: unknown[] }) => ({
  state: { data },
})

describe('dashboardRefreshIn', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits a whole refresh period when there is no load yet', () => {
    expect(dashboardRefreshIn(loaded())).toBe(DASHBOARD_REFRESH_MS)
    expect(dashboardRefreshIn(loaded({ failedChains: [] }))).toBe(
      DASHBOARD_REFRESH_MS,
    )
  })

  it('counts from the load’s own time, not from when the page opened', () => {
    expect(dashboardRefreshIn(loaded({ generatedAt: NOW }))).toBe(
      DASHBOARD_REFRESH_MS,
    )
    // A load saved four minutes ago is refreshed a minute from now.
    expect(dashboardRefreshIn(loaded({ generatedAt: NOW - 4 * MINUTE }))).toBe(
      DASHBOARD_REFRESH_MS - 4 * MINUTE,
    )
  })

  it('never asks again sooner than 15 seconds', () => {
    const generatedAt = NOW - DASHBOARD_REFRESH_MS + 5000
    expect(dashboardRefreshIn(loaded({ generatedAt }))).toBe(15_000)
  })

  it.each([
    ['due right now', NOW - DASHBOARD_REFRESH_MS],
    ['overdue', NOW - 3 * DASHBOARD_REFRESH_MS],
  ])(
    'tries again in a minute, not at once, when the refresh is %s',
    (_name, generatedAt) => {
      expect(dashboardRefreshIn(loaded({ generatedAt }))).toBe(MINUTE)
    },
  )

  it('asks again in a minute when a chain is missing, however fresh', () => {
    expect(
      dashboardRefreshIn(loaded({ generatedAt: NOW, failedChains: [100] })),
    ).toBe(MINUTE)
  })
})

describe('isLiveLoad', () => {
  const nowSeconds = NOW / 1000

  // A refresh period (five minutes) and a minute of slack for the load itself.
  it.each([
    ['just read', NOW, true],
    ['one refresh old', NOW - 5 * MINUTE, true],
    ['at the end of the slack', NOW - 6 * MINUTE, true],
    ['past the slack', NOW - 6 * MINUTE - 1, false],
    ['a day old', NOW - 24 * 60 * MINUTE, false],
  ])('a load %s is live: %s', (_name, generatedAt, live) => {
    expect(isLiveLoad(generatedAt, nowSeconds)).toBe(live)
  })

  it('agrees with the period the page refreshes on', () => {
    expect(isLiveLoad(NOW - DASHBOARD_REFRESH_MS, nowSeconds)).toBe(true)
    expect(isLiveLoad(NOW - DASHBOARD_LIVE_MS - 1, nowSeconds)).toBe(false)
  })
})

describe('the load keys', () => {
  it('keep the mainnet and testnet loads apart under one scope', () => {
    // saved-load.ts saves every load whose key starts with this scope, by name.
    expect(TESTNET_DASHBOARD_QUERY_KEY[0]).toBe(DASHBOARD_QUERY_KEY[0])
    expect(TESTNET_DASHBOARD_QUERY_KEY[1]).not.toBe(DASHBOARD_QUERY_KEY[1])
  })
})
