/*
 * One read from a list of endpoints in the app's order (config/rpc.ts:
 * getRpcUrls), first useful answer wins.
 *
 * The next endpoint is asked as soon as one fails, and also when one has not
 * answered within `hedgeMs`: a node that stalls (public RPCs do, now and
 * then) then costs that long, not its whole timeout. On 2026-11-25 Gnosis's
 * public RPC sat on a challenge-period read for 3.8 s before its timeout let
 * the next node answer in 0.15 s, and the dashboard, Browse and the profiles
 * waited for it. A node that answers late, after the next one was asked,
 * still wins if its answer comes first; the others are simply not used.
 */

/** How long a node may take before the next one is asked as well. */
export const HEDGE_MS = 1_000

/**
 * The first answer `ask` gives that is not null, asking the endpoints in
 * order as above. Null when every endpoint failed (`ask` gave null or threw).
 */
export const firstAnswer = <T>(
  endpoints: string[],
  ask: (endpoint: string) => Promise<T | null>,
  hedgeMs = HEDGE_MS,
): Promise<T | null> =>
  new Promise((resolve) => {
    let next = 0
    let running = 0
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const stopHedge = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    }

    const finish = (answer: T | null) => {
      settled = true
      stopHedge()
      resolve(answer)
    }

    const launch = () => {
      stopHedge()
      if (settled || next >= endpoints.length) return
      const endpoint = endpoints[next]
      next += 1
      running += 1
      if (next < endpoints.length) timer = setTimeout(launch, hedgeMs)
      void (async () => {
        let answer: T | null = null
        try {
          answer = await ask(endpoint)
        } catch {
          answer = null
        }
        running -= 1
        if (settled) return
        if (answer !== null) finish(answer)
        else if (next < endpoints.length) launch()
        else if (running === 0) finish(null)
      })()
    }

    if (endpoints.length === 0) resolve(null)
    else launch()
  })
