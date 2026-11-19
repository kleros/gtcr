import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getNativeCurrency } from 'config/chains'
import {
  coinKey,
  readUsdPrices,
  type PricedCoin,
  type UsdPrice,
} from './prices'
import type { BountyCoin } from './view'

/*
 * The dollar prices behind the dashboard's two converted figures, in a query
 * of their own.
 *
 * They are deliberately NOT part of the dashboard load: saved-load.ts keeps
 * that load in IndexedDB for up to 24 hours and repaints it on the next visit,
 * so a price carried in it would be painted as current when it is a day old —
 * which is the one way a figure here turns into a lie. This query has no saved
 * copy and no module-level cache of its own: React Query owns how long a price
 * lives, so nothing else can disagree about its age.
 *
 * It asks only for the coins actually on screen, and only while there is at
 * least one of them. The key is the chain scope plus the coins' own keys,
 * sorted: the load hands the coins back in a different order on a refresh,
 * and sorting their keys means only a coin arriving or leaving changes the
 * key, so a refresh does not re-read the feeds while a new coin (a Stake
 * token the first read did not know) gets its price at once instead of at
 * the next five-minute tick. The prices already held stay on screen while
 * the new key reads (keepPreviousData), so a coin appearing does not blink
 * the others' dollars out.
 *
 * The dollars lead the figure they convert (DESIGN.md, Data rules), so the
 * caller also has to know when to stop waiting for them, or the figure would
 * paint the coin amount large and swap it for dollars a second later, under
 * the reader. `settled` says that: true once the first read has answered or
 * failed, when no coin needs a price, or PRICE_HOLD_MS after the read began,
 * whichever comes first. Until then the caller holds its money figures as
 * skeletons; a price that answers after the hold fades in on its own.
 *
 * What it hands back is not quite what the chain answered: a price that has
 * passed its own `staleAfter` is taken out, so what the caller holds is only
 * ever current. That gate cannot live in the read alone, because a price goes
 * stale with nothing happening — see the clock below.
 */

const PRICES_REFRESH_MS = 5 * 60_000

/**
 * How long the money figures wait for a first price before they lead with
 * the coin instead. A cap, not a delay: a cached or quick read settles the
 * moment it answers.
 */
const PRICE_HOLD_MS = 1_500

const nowSeconds = () => Math.floor(Date.now() / 1000)

/** The coins two figures are in: the collateral per chain, and the bounties. */
export const useUsdPrices = ({
  chains,
  coins,
  deposits,
}: {
  /** The page's scope, which is what the query is keyed by. */
  chains: number[]
  /** The bounty coins, as view.ts built them (their own keys are reused). */
  coins?: BountyCoin[]
  /** The in-window collateral per chain, in wei: the chains' own coins. */
  deposits?: Record<number, bigint>
}): {
  /** The prices still current, by coin key; undefined until a read answers. */
  prices: Record<string, UsdPrice> | undefined
  /** The figures may paint: the read answered, failed, or ran out its hold. */
  settled: boolean
} => {
  const wanted = useMemo<PricedCoin[]>(() => {
    const list: PricedCoin[] = []
    for (const [chainId, wei] of Object.entries(deposits ?? {})) {
      if (wei <= 0n) continue
      const id = Number(chainId)
      list.push({
        key: coinKey(id),
        chainId: id,
        decimals: getNativeCurrency(id).decimals,
      })
    }
    for (const coin of coins ?? []) {
      // No decimals means no amount on screen, so there is nothing to
      // convert; a Stake token that never loaded has no identity to price.
      if (coin.decimals === undefined || coin.amount <= 0n) continue
      if (coin.stake && !coin.token) continue
      list.push({
        key: coin.key,
        chainId: coin.chainId,
        token: coin.token,
        decimals: coin.decimals,
      })
    }
    return list
  }, [coins, deposits])

  const enabled = wanted.length > 0
  const scope = chains.join(',')
  const query = useQuery({
    queryKey: [
      'curateUsdPrices',
      scope,
      wanted
        .map((coin) => coin.key)
        .sort()
        .join(','),
    ],
    queryFn: () => readUsdPrices(wanted),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: PRICES_REFRESH_MS,
    refetchInterval: PRICES_REFRESH_MS,
    /*
     * The app refetches nothing when a tab comes back (bootstrap/app.tsx),
     * which is right for a figure an indexer measured and wrong for the one
     * value here that expires. The interval skips every tick while the tab is
     * hidden, so without this a reader returning to the page would wait up to
     * PRICES_REFRESH_MS for a current answer, with no dollars beside the coin
     * figures until it came.
     */
    refetchOnWindowFocus: true,
    retry: 1,
  })

  // The hold: restarted whenever there is a new scope to price, or the first
  // coin needing a price turns up.
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    setTimedOut(false)
    if (!enabled) return undefined
    const timer = setTimeout(() => setTimedOut(true), PRICE_HOLD_MS)
    return () => clearTimeout(timer)
  }, [enabled, scope])

  /*
   * The prices still current, judged against the clock rather than against
   * the last read.
   *
   * A price expires with nothing happening: the feed's answer simply gets
   * older, and the gate inside the read only runs when a read runs. A page
   * left open would therefore keep painting an answer from hours ago, which
   * DESIGN.md's Data rules say is not shown at all. So this keeps the second
   * it last judged the prices by and schedules the moment the earliest price
   * on screen stops being current — which takes that price out, schedules
   * the next, and ends when none is left to expire.
   */
  const prices = query.data
  const [judged, setJudged] = useState(nowSeconds)
  const current = useMemo(() => {
    if (!prices) return undefined
    const live: Record<string, UsdPrice> = {}
    for (const [key, price] of Object.entries(prices))
      if (judged <= price.staleAfter) live[key] = price
    return live
  }, [prices, judged])

  useEffect(() => {
    const gates = Object.values(current ?? {}).map((price) => price.staleAfter)
    if (gates.length === 0) return
    // A second past the earliest gate, so the stamp this sets is certainly
    // past it and that price certainly leaves the map: landing exactly on it
    // could set the same second twice, which changes nothing and stops here.
    const timer = setTimeout(
      () => setJudged(nowSeconds()),
      Math.max(0, (Math.min(...gates) + 1 - nowSeconds()) * 1_000),
    )
    return () => clearTimeout(timer)
  }, [current])

  return {
    prices: current,
    settled:
      !enabled || query.data !== undefined || query.isFetched || timedOut,
  }
}
