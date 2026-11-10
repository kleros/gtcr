import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { request } from 'graphql-request'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'
import useCheckPermanentList from './use-check-permanent-list'
import useUrlChainId from 'hooks/use-url-chain-id'
import { subgraphUrl } from 'config/tcr-addresses'
import { STALE_TIME } from 'consts'

const useCheckLightCurate = (): {
  isLightCurate: boolean
  isClassicCurate: boolean
  isPermanentCurate: boolean
  checking: boolean
  error: boolean
  /** Asks again whichever check failed. */
  retry: () => void
} => {
  const { tcrAddress } = useParams<{
    tcrAddress: string
  }>()
  const chainId = useUrlChainId()

  const {
    isLoading: loading,
    data,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['tcrExistence', tcrAddress, chainId],
    queryFn: async () => {
      const url = subgraphUrl[chainId!]
      if (!url) throw new Error(`No subgraph URL for chain ${chainId}`)

      return request(url, TCR_EXISTENCE_TEST, {
        tcrAddress: tcrAddress?.toLowerCase(),
      })
    },
    enabled: !!chainId && !!tcrAddress,
    retry: 2,
    staleTime: STALE_TIME,
  })

  const isLightCurate = useMemo<boolean>(() => data?.lregistry ?? false, [data])
  const isClassicCurate = useMemo<boolean>(
    () => data?.registry ?? false,
    [data],
  )

  // Only check Goldsky (permanent) after Envio responds with no match.
  // This prevents the slow Goldsky query from being batched together with
  // the fast Envio query, which would block the entire page render.
  const envioFoundNothing =
    !loading && !queryError && !isLightCurate && !isClassicCurate
  const {
    isPermanentList,
    checking: permanentChecking,
    error: permanentError,
    retry: permanentRetry,
  } = useCheckPermanentList(tcrAddress ?? null, chainId, envioFoundNothing)

  return {
    isLightCurate,
    isClassicCurate,
    isPermanentCurate: isPermanentList,
    checking: loading || (envioFoundNothing && permanentChecking),
    error: !!queryError || (envioFoundNothing && permanentError),
    retry: () => {
      if (queryError) void refetch()
      else if (permanentError) permanentRetry()
    },
  }
}

export default useCheckLightCurate
