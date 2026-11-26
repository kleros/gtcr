import { useEffect, useState } from 'react'
import { getNativeCurrency } from 'config/chains'
import { readStoredDraft, writeStoredDraft } from 'utils/stored-draft'
import { usdOf } from './board-rows'
import { coinKey, type UsdPrice } from './prices'

/*
 * The hero's third figure, "Up for grabs now" under Bounties won (26 Nov
 * 2026, option H1 of the harmony review): the collateral behind the requests
 * open for verification, in dollars at today's prices, a link down to them.
 * Like the hero's two totals it adds across coins (DESIGN.md, Data rules),
 * and like them it is drawn only when it is whole: every chain in scope
 * answered, every request was placed in its window, nothing stopped at a page
 * cap, and every coin has a current price. A part of the pool is never shown
 * as the pool. Nor is an old one: it is read from a live load only, never
 * from the load an earlier visit saved (up to a day old, painted while the
 * refresh runs), whose requests are not the ones open now.
 *
 * It shows from $2,000 up. Rebuilt hour by hour over the year to 25 Nov
 * 2026, the pool sat at or above that 86.5% of the time (median $3.45K), but
 * it moves in batches, so a plain cutoff would have come and gone about 2.5
 * times a week. A browser that saw it open keeps it open down to $1,500,
 * which held it 93% of the time and changed it about 0.7 times a week. The
 * choice is made once a visit, when the pool is first whole, and kept: the
 * number goes on updating, but the figure never vanishes from under a
 * reader, nor pops in beside one.
 */

/** The pool that opens the figure. */
export const OPEN_AT = 2_000
/** Once open in this browser, the pool it stays open down to. */
export const CLOSE_BELOW = 1_500
/** Whether the figure was open on this browser's last visit. */
const GATE_KEY = 'curatevision-hero-bounty:v1'

/**
 * The pool in dollars, or why there is none yet: `pending` while a part of
 * it is still being read (the load, its refresh, a challenge window, a
 * price), `blocked` when a part of it will not come in this load (a chain
 * that did not answer, a read that hit its cap, windows that could not be
 * placed, a refresh that failed).
 */
export type OpenPool =
  /** `refreshing`: what holds it is the load's refresh, not a part of it. */
  | { state: 'pending'; refreshing?: boolean }
  | { state: 'blocked' }
  | { state: 'ready'; usd: number }

export const openPool = ({
  deposits,
  live,
  refreshFailed,
  windowsKnown,
  windowsFailed,
  capped,
  partial,
  prices,
}: {
  /** The in-window deposits per chain, in wei; undefined before the load. */
  deposits?: Record<number, bigint>
  /**
   * The load is recent (query.ts isLiveLoad): not one an earlier visit
   * saved, nor one whose refresh is overdue.
   */
  live: boolean
  /** The last read of the load failed (React Query's isError). */
  refreshFailed: boolean
  /** Every request in scope was placed in its window. */
  windowsKnown: boolean
  /** The windows were read again and still could not all be placed. */
  windowsFailed: boolean
  /** The open-request read stopped at its page cap. */
  capped: boolean
  /** A chain in scope did not answer. */
  partial: boolean
  /** Current dollar prices by coin (use-usd-prices.ts). */
  prices?: Record<string, UsdPrice>
}): OpenPool => {
  if (partial || capped) return { state: 'blocked' }
  // An old load waits for its refresh; one that failed is no pool now.
  if (deposits && (!live || refreshFailed))
    return refreshFailed
      ? { state: 'blocked' }
      : { state: 'pending', refreshing: true }
  if (!windowsKnown)
    return windowsFailed ? { state: 'blocked' } : { state: 'pending' }
  if (!deposits) return { state: 'pending' }
  let usd = 0
  for (const [chainId, wei] of Object.entries(deposits)) {
    if (wei <= 0n) continue
    const id = Number(chainId)
    const price = prices?.[coinKey(id)]
    // A price can arrive after the page's short hold, or come back after
    // its feed's answer expired: wait for it rather than drop a coin.
    if (!price) return { state: 'pending' }
    usd += usdOf(wei, getNativeCurrency(id).decimals, price.usd)
  }
  return { state: 'ready', usd }
}

/** Whether a pool of `usd` opens the figure, given how the last visit left it. */
export const gateOpens = (usd: number, wasOpen: boolean): boolean =>
  usd >= OPEN_AT || (wasOpen && usd >= CLOSE_BELOW)

/** The hero's third figure, as the hook decides it. */
export interface UpForGrabs {
  /** The dollars to show; undefined draws no figure. */
  usd?: number
  /**
   * Not decided yet, but likely to open: the pool may still come whole, and
   * this browser's last visit did not close the figure. The hero holds its
   * place with a skeleton while its other figures load, so the figure that
   * follows moves nothing; a visit that closed it last time holds none.
   */
  expected: boolean
  /**
   * Not decided yet because the load on screen is an old one (an earlier
   * visit's) and its refresh is still coming: the hero, loaded already from
   * that old load, holds the figure's place until the refresh lands.
   */
  refreshing: boolean
}

/**
 * The hero's third figure. The gate is decided the first time the pool is
 * whole and kept for the visit; while a later read is pending (prices
 * refreshing) the last whole number stays, and a read that comes back partial
 * takes the figure away, since its number would no longer be the pool.
 */
export const useUpForGrabs = (pool: OpenPool): UpForGrabs => {
  const ready = pool.state === 'ready' ? pool.usd : undefined
  // How the last visit left the gate: read once, as the visit starts.
  const [wasOpen] = useState(() => readStoredDraft(GATE_KEY))
  const [open, setOpen] = useState<boolean>()
  const [last, setLast] = useState<number>()
  /*
   * Decided in render, the first time the pool is whole, so the frame that
   * first shows the pool already shows the figure or leaves it out; the
   * effect below keeps that decision for the visit and stores it.
   */
  const decided =
    open ??
    (ready !== undefined ? gateOpens(ready, wasOpen === true) : undefined)

  useEffect(() => {
    if (ready !== undefined) setLast(ready)
  }, [ready])

  useEffect(() => {
    if (open !== undefined || decided === undefined) return
    writeStoredDraft(GATE_KEY, decided)
    setOpen(decided)
  }, [open, decided])

  // Kept for the visit, except when nothing at all is open: a "$0" would
  // lead to a section that, with nothing open, has no heading to land on.
  const usd = ready ?? last
  return {
    usd:
      decided && pool.state !== 'blocked' && usd !== undefined && usd > 0
        ? usd
        : undefined,
    expected:
      decided === undefined && pool.state === 'pending' && wasOpen !== false,
    refreshing:
      decided === undefined && pool.state === 'pending' && !!pool.refreshing,
  }
}
