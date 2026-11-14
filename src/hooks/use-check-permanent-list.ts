import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isPermanentRegistry } from 'utils/permanent-registry-check'
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
    // Every row of a list of lists asks this: the checks asked together
    // travel as one query (utils/permanent-registry-check.ts).
    queryFn: async () => {
      const id = (address || '').toLowerCase()
      const exists = await isPermanentRegistry(chainId!, id)
      return { registry: exists ? { id } : null }
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
    // A failed refetch keeps the answer already shown.
    error: !!queryError && !data,
    retry: () => void refetch(),
  }
}

export default useCheckPermanentList
