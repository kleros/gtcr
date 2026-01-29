import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useQuery, ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'
import {
  TCR_EXISTENCE_TEST,
  PERMANENT_REGISTRY_EXISTENCE_TEST
} from 'utils/graphql'
import { subgraphUrlPermanent, validChains } from 'config/tcr-addresses'

const useCheckLightCurate = (): {
  isLightCurate: boolean
  isClassicCurate: boolean
  isPermanentCurate: boolean
  checking: boolean
} => {
  const { tcrAddress, chainId } = useParams<{
    tcrAddress: string
    chainId: string
  }>()
  const { loading, data } = useQuery(TCR_EXISTENCE_TEST, {
    variables: {
      tcrAddress: tcrAddress.toLowerCase()
    }
  })

  // Create Apollo client for permanent subgraph
  const permanentClient = useMemo(() => {
    const url = subgraphUrlPermanent[chainId as validChains]
    if (!url) return null
    return new ApolloClient({
      link: new HttpLink({ uri: url }),
      cache: new InMemoryCache()
    })
  }, [chainId])

  // Query permanent subgraph
  const { loading: permanentLoading, data: permanentData } = useQuery(
    PERMANENT_REGISTRY_EXISTENCE_TEST,
    {
      variables: { tcrAddress: tcrAddress.toLowerCase() },
      skip: !permanentClient,
      client: permanentClient || undefined
    }
  )

  const isLightCurate = useMemo<boolean>(() => data?.lregistry ?? false, [data])
  const isClassicCurate = useMemo<boolean>(() => data?.registry ?? false, [
    data
  ])
  const isPermanentCurate = useMemo<boolean>(
    () => permanentData?.registry ?? false,
    [permanentData]
  )

  return {
    isLightCurate,
    isClassicCurate,
    isPermanentCurate,
    checking: loading || permanentLoading
  }
}

export default useCheckLightCurate
