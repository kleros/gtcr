import { GraphQLClient } from 'graphql-request'
import {
  subgraphUrl,
  subgraphUrlPermanent,
  validChains,
} from 'config/tcr-addresses'

const clients: Record<string, GraphQLClient> = {}

const createGraphQLClient = (
  chainId: string | number,
  urlMap: Record<string, string>,
  keyPrefix = '',
): GraphQLClient | null => {
  const key = `${keyPrefix}${chainId}`
  const url = urlMap[String(chainId) as validChains]
  if (!url) return null
  if (!clients[key]) clients[key] = new GraphQLClient(url)

  return clients[key]
}

export const getGraphQLClient = (
  chainId: string | number,
): GraphQLClient | null => createGraphQLClient(chainId, subgraphUrl)

export const getPermanentGraphQLClient = (
  chainId: string | number,
): GraphQLClient | null =>
  createGraphQLClient(chainId, subgraphUrlPermanent, 'permanent-')
