import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PERMANENT_REGISTRY_QUERY } from 'utils/graphql'
import { getPermanentGraphQLClient } from 'utils/graphql-client'

const useCheckPermanentList = (
  address: string | null,
  chainId: string
): { isPermanentList: boolean; checking: boolean; error: boolean } => {
  const client = useMemo(() => getPermanentGraphQLClient(chainId), [chainId])

  // Use the full registry query instead of the lightweight existence test.
  // This pre-populates the TanStack Query cache with the same key that
  // the permanent-items page uses, eliminating a second roundtrip.
  const { isLoading: loading, data, error: queryError } = useQuery({
    queryKey: ['permanentRegistry', address, chainId],
    queryFn: () =>
      client!.request(PERMANENT_REGISTRY_QUERY, {
        lowerCaseTCRAddress: (address || '').toLowerCase()
      }),
    enabled: !!address && !!client
  })

  const isPermanentList = useMemo<boolean>(
    () => !loading && !!address && !!data?.registry,
    [loading, address, data]
  )

  return { isPermanentList, checking: loading, error: !!queryError }
}

export default useCheckPermanentList
