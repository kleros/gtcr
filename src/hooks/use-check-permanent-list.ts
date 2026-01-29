import { useMemo } from 'react'
import { useQuery, ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'
import { PERMANENT_REGISTRY_EXISTENCE_TEST } from 'utils/graphql'
import { subgraphUrlPermanent, validChains } from 'config/tcr-addresses'

const useCheckPermanentList = (
  address: string | null,
  chainId: string
): { isPermanentList: boolean; checking: boolean } => {
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
  const { loading, data } = useQuery(PERMANENT_REGISTRY_EXISTENCE_TEST, {
    variables: { tcrAddress: (address || '').toLowerCase() },
    skip: !address || !permanentClient,
    client: permanentClient || undefined
  })

  const isPermanentList = useMemo<boolean>(
    () => !loading && !!address && !!data?.registry,
    [loading, address, data]
  )

  return { isPermanentList, checking: loading }
}

export default useCheckPermanentList
