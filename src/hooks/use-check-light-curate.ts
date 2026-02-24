import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import useCheckPermanentList from './use-check-permanent-list'
import useUrlChainId from 'hooks/use-url-chain-id'

const useCheckLightCurate = (): {
  isLightCurate: boolean
  isClassicCurate: boolean
  isPermanentCurate: boolean
  checking: boolean
  error: boolean
} => {
  const { tcrAddress } = useParams<{
    tcrAddress: string
  }>()
  const chainId = useUrlChainId()
  const { graphqlBatcher } = useGraphqlBatcher()

  const {
    isLoading: loading,
    data,
    error: queryError,
  } = useQuery({
    queryKey: ['tcrExistence', tcrAddress, chainId],
    queryFn: () =>
      graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: TCR_EXISTENCE_TEST,
        variables: { tcrAddress: tcrAddress.toLowerCase() },
        chainId: chainId!,
      }),
    enabled: !!chainId && !!tcrAddress,
    staleTime: Infinity,
  })

  const {
    isPermanentList,
    checking: permanentChecking,
    error: permanentError,
  } = useCheckPermanentList(tcrAddress, chainId)

  const isLightCurate = useMemo<boolean>(() => data?.lregistry ?? false, [data])
  const isClassicCurate = useMemo<boolean>(
    () => data?.registry ?? false,
    [data],
  )

  return {
    isLightCurate,
    isClassicCurate,
    isPermanentCurate: isPermanentList,
    checking: loading || permanentChecking,
    error: !!queryError && permanentError,
  }
}

export default useCheckLightCurate
