import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CLOSE_BELOW,
  OPEN_AT,
  gateOpens,
  openPool,
  useUpForGrabs,
  type OpenPool,
  type UpForGrabs,
} from './open-bounty'
import type { UsdPrice } from './prices'

const price = (usd: number): UsdPrice => ({
  usd,
  updatedAt: 1_795_600_000,
  staleAfter: 1_795_700_000,
  pair: 'TEST / USD',
})
const xdai = (amount: number) => BigInt(amount) * 10n ** 18n
const whole = {
  windowsKnown: true,
  windowsFailed: false,
  capped: false,
  partial: false,
}
const GATE_KEY = 'curatevision-hero-bounty:v1'

describe('openPool', () => {
  it('adds every coin in dollars once each has a price', () => {
    expect(
      openPool({
        ...whole,
        deposits: { 100: xdai(5_610), 1: 5n * 10n ** 17n },
        prices: { '100:native': price(1), '1:native': price(1_700) },
      }),
    ).toEqual({ state: 'ready', usd: 5_610 + 850 })
  })

  it('is whole and zero when nothing is open', () => {
    expect(openPool({ ...whole, deposits: { 100: 0n }, prices: {} })).toEqual({
      state: 'ready',
      usd: 0,
    })
  })

  it('waits for the load, the windows and every price', () => {
    expect(openPool({ ...whole, prices: {} })).toEqual({ state: 'pending' })
    expect(
      openPool({ ...whole, windowsKnown: false, deposits: { 100: xdai(1) } }),
    ).toEqual({ state: 'pending' })
    expect(
      openPool({
        ...whole,
        deposits: { 100: xdai(5_000), 1: 1n },
        prices: { '100:native': price(1) },
      }),
    ).toEqual({ state: 'pending' })
  })

  it('is never drawn from part of the pool', () => {
    const deposits = { 100: xdai(5_000) }
    const prices = { '100:native': price(1) }
    expect(openPool({ ...whole, deposits, prices, partial: true })).toEqual({
      state: 'blocked',
    })
    expect(openPool({ ...whole, deposits, prices, capped: true })).toEqual({
      state: 'blocked',
    })
    expect(
      openPool({
        ...whole,
        deposits,
        prices,
        windowsKnown: false,
        windowsFailed: true,
      }),
    ).toEqual({ state: 'blocked' })
  })
})

describe('gateOpens', () => {
  it(`opens from ${OPEN_AT} dollars`, () => {
    expect(gateOpens(OPEN_AT, false)).toBe(true)
    expect(gateOpens(OPEN_AT - 1, false)).toBe(false)
  })

  it(`stays open down to ${CLOSE_BELOW} for a browser that saw it open`, () => {
    expect(gateOpens(CLOSE_BELOW, true)).toBe(true)
    expect(gateOpens(CLOSE_BELOW - 1, true)).toBe(false)
  })
})

describe('useUpForGrabs', () => {
  const ready = (usd: number): OpenPool => ({ state: 'ready', usd })
  const hook = (initialProps: OpenPool) =>
    renderHook((pool: OpenPool) => useUpForGrabs(pool), { initialProps })

  it('shows nothing until the pool is whole, and holds its place', () => {
    const { result } = hook({ state: 'pending' })
    expect(result.current).toEqual({ usd: undefined, expected: true })
    expect(window.localStorage.getItem(GATE_KEY)).toBeNull()
  })

  it('holds no place when the last visit closed it, or the pool cannot be whole', () => {
    expect(hook({ state: 'blocked' }).result.current.expected).toBe(false)
    window.localStorage.setItem(GATE_KEY, 'false')
    expect(hook({ state: 'pending' }).result.current.expected).toBe(false)
  })

  it('opens from $2,000 in the first frame that has the pool, and remembers it', () => {
    // Every render's answer, the first one included: no frame without it.
    const seen: UpForGrabs[] = []
    renderHook(() => {
      const grabs = useUpForGrabs(ready(5_610))
      seen.push(grabs)
      return grabs
    })
    expect(seen[0]).toEqual({ usd: 5_610, expected: false })
    expect(seen.every((grabs) => grabs.usd === 5_610)).toBe(true)
    expect(window.localStorage.getItem(GATE_KEY)).toBe('true')
  })

  it('stays shut under $2,000 on a first visit, and remembers that', () => {
    const { result } = hook(ready(1_800))
    expect(result.current).toEqual({ usd: undefined, expected: false })
    expect(window.localStorage.getItem(GATE_KEY)).toBe('false')
  })

  it('stays open down to $1,500 when the last visit had it open', () => {
    window.localStorage.setItem(GATE_KEY, 'true')
    expect(hook(ready(1_600)).result.current.usd).toBe(1_600)
  })

  it('decides once a visit: the figure neither vanishes nor pops in', () => {
    const opened = hook(ready(2_500))
    opened.rerender(ready(900))
    expect(opened.result.current.usd).toBe(900)

    window.localStorage.clear()
    const shut = hook(ready(1_200))
    shut.rerender(ready(9_000))
    expect(shut.result.current.usd).toBeUndefined()
  })

  it('draws no figure once nothing at all is open', () => {
    const { result, rerender } = hook(ready(4_000))
    rerender(ready(0))
    expect(result.current.usd).toBeUndefined()
  })

  it('keeps the last whole figure while a read is pending, and drops a partial one', () => {
    const { result, rerender } = hook(ready(3_000))
    rerender({ state: 'pending' })
    expect(result.current.usd).toBe(3_000)
    rerender({ state: 'blocked' })
    expect(result.current.usd).toBeUndefined()
  })
})
