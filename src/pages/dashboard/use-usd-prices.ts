import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
 * least one of them. The key is the chain scope rather than the coin list,
 * because the coin set shuffles on every refresh of the load and keying on it
 * would re-read the feeds each time; the current list is passed through the
 * query function instead.
 *
 * What it hands back is not quite what the chain answered: a price that has
 * passed its own `staleAfter` is taken out, so what the caller holds is only
 * ever current. That gate cannot live in the read alone, because a price goes
 * stale with nothing happening — see the clock below.
 */

const PRICES_REFRESH_MS = 5 * 60_000

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
}): Record<string, UsdPrice> | undefined => {
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

  const query = useQuery({
    queryKey: ['curateUsdPrices', chains.join(',')],
    queryFn: () => readUsdPrices(wanted),
    enabled: wanted.length > 0,
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

  return current
}
