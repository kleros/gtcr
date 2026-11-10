import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { request } from 'graphql-request'
import { PERMANENT_REGISTRY_EXISTENCE_TEST } from 'utils/graphql'
import { subgraphUrlPermanent } from 'config/tcr-addresses'
import { STALE_TIME } from 'consts'

const useCheckPermanentList = (
  address: string | null,
  chainId: number | string | null,
  shouldCheck: boolean = true,
): {
  isPermanentList: boolean
  checking: boolean
  error: boolean
  retry: () => void
} => {
  const {
    isLoading: loading,
    data,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['permanentRegistryExistence', address, chainId],
    queryFn: () => {
      const url = subgraphUrlPermanent[chainId!]
      if (!url)
        throw new Error(`No permanent subgraph URL for chain ${chainId}`)

      return request(url, PERMANENT_REGISTRY_EXISTENCE_TEST, {
        tcrAddress: (address || '').toLowerCase(),
      })
    },
    enabled: shouldCheck && !!address && !!chainId,
    retry: 2,
    staleTime: STALE_TIME,
  })

  const isPermanentList = useMemo<boolean>(
    () => !loading && !!address && !!data?.registry,
    [loading, address, data],
  )

  return {
    isPermanentList,
    checking: loading,
    error: !!queryError,
    retry: () => void refetch(),
  }
}

export default useCheckPermanentList
