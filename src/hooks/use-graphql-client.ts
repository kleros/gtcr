import { useMemo } from 'react'
import { ApolloClient, InMemoryCache } from '@apollo/client'
import { HttpLink } from '@apollo/client/link/http'
import { subgraphUrl, validChains } from 'config/tcr-addresses'

const useApolloClientFactory = (networkId: number | Empty) => {
  const client = useMemo(() => {
    if (!networkId) return null

    const GTCR_SUBGRAPH_URL = subgraphUrl[networkId as validChains]

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
