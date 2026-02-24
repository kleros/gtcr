import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PERMANENT_REGISTRY_QUERY } from 'utils/graphql'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'

const useCheckPermanentList = (
  address: string | null,
  chainId: number | null,
): { isPermanentList: boolean; checking: boolean; error: boolean } => {
  const { graphqlBatcher } = useGraphqlBatcher()

  // Use the full registry query instead of the lightweight existence test.
  // This pre-populates the TanStack Query cache with the same key that
  // the permanent-items page uses, eliminating a second roundtrip.
  const {
    isLoading: loading,
    data,
    error: queryError,
  } = useQuery({
    queryKey: ['permanentRegistry', address, chainId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: PERMANENT_REGISTRY_QUERY,
        variables: { lowerCaseTCRAddress: (address || '').toLowerCase() },
        chainId: chainId!,
        isPermanent: true,
      }),
    enabled: !!address && !!chainId,
    staleTime: Infinity,
  })

  const isPermanentList = useMemo<boolean>(
    () => !loading && !!address && !!data?.registry,
    [loading, address, data],
  )

  return { isPermanentList, checking: loading, error: !!queryError }
}

export default useCheckPermanentList
