import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'
import { getGraphQLClient } from 'utils/graphql-client'
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

  const client = useMemo(
    () => (chainId ? getGraphQLClient(chainId) : null),
    [chainId],
  )

  const {
    isLoading: loading,
    data,
    error: queryError,
  } = useQuery({
    queryKey: ['tcrExistence', tcrAddress, chainId],
    queryFn: () =>
      client!.request(TCR_EXISTENCE_TEST, {
        tcrAddress: tcrAddress.toLowerCase(),
      }),
    enabled: !!client && !!tcrAddress,
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
