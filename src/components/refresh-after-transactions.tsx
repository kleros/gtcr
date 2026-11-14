import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onTxConfirmed } from 'utils/tx-events'

/*
 * After a confirmed transaction, the entry or list in view refetches a few
 * times while the indexers catch up (seconds on Envio, up to a couple of
 * minutes on the Stake subgraph), so a challenge, a piece of evidence or a
 * contribution shows up without a reload. Only data a transaction can change
 * is refetched; anything matching that is not on screen is marked stale and
 * reloads when it is next shown.
 */
const REFRESHED = new Set([
  'lightItemDetails',
  'classicItemDetails',
  'permanentItemDetails',
  'lightItems',
  'classicItems',
  'permanentItems',
  'permanentRegistry',
  'permanentRegistrySummary',
  'permanentRegistryContract',
  'permanentRegistrySubmit',
  'arbitrableTCRData',
  'arbitrationCost',
  'policyHistory',
  'badges',
])

const DELAYS_MS = [
  2_000, 5_000, 10_000, 20_000, 35_000, 60_000, 90_000, 120_000,
]

const RefreshAfterTransactions = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
    let timers: number[] = []
    const clear = () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers = []
    }
    const refresh = () => {
      queryClient.invalidateQueries({
        predicate: (query) => REFRESHED.has(String(query.queryKey[0])),
        refetchType: 'active',
      })
    }
    const unsubscribe = onTxConfirmed(() => {
      clear()
      timers = DELAYS_MS.map((ms) => window.setTimeout(refresh, ms))
    })
    return () => {
      unsubscribe()
      clear()
    }
  }, [queryClient])

  return null
}

export default RefreshAfterTransactions
