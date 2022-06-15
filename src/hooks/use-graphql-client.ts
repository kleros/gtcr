import { useMemo } from 'react'
import { ApolloClient, InMemoryCache } from '@apollo/client'
import { HttpLink } from '@apollo/client/link/http'
import getNetworkEnv from 'utils/helpers/network-env'

const useApolloClientFactory = (networkId: number | Empty) => {
  const client = useMemo(() => {
    if (!networkId) return null

    const GTCR_SUBGRAPH_URL = getNetworkEnv('REACT_APP_SUBGRAPH_URL', networkId)

    if (!GTCR_SUBGRAPH_URL) return null

    const httpLink = new HttpLink({
      uri: GTCR_SUBGRAPH_URL
    })

    return new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache()
    })
  }, [networkId])

  return client
}

export default useApolloClientFactory
