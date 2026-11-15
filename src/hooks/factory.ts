import { ethers } from 'ethers'
import useUrlChainId from 'hooks/use-url-chain-id'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'
import { request } from 'utils/indexer-request'

const { getAddress } = ethers.utils

/**
 * The answer's data. Light and Classic lists come from the Envio indexer,
 * whose requests count against a limit the whole app shares: those reads go
 * through the batcher, like every other. A read that gets no answer throws,
 * so it is never taken for "not deployed here".
 */
const readIndexer = async (
  endpoint: string,
  query: string,
): Promise<Record<string, unknown>> => {
  if (Object.values(subgraphUrl).includes(endpoint))
    return request<Record<string, unknown>>(endpoint, query)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!response.ok) throw new Error(`The indexer answered ${response.status}.`)
  const { data, errors } = await response.json()
  if (!data)
    throw new Error(errors?.[0]?.message ?? 'The indexer returned no data.')
  return data
}

/**
 * Check if a TCR address exists in a subgraph by querying an entity.
 * @param {string} subgraphUrl - The subgraph endpoint URL
 * @param {string} queryTemplate - GraphQL query string (use $address placeholder)
 * @param {string} entityKey - The key to check in the response data
 */
const checkRegistryExists = async (
  subgraphEndpoint: string | undefined,
  queryTemplate: string,
  entityKey: string,
  tcrAddress: string,
): Promise<boolean> => {
  if (!tcrAddress || !subgraphEndpoint) return false
  let checksumAddress: string
  try {
    checksumAddress = getAddress(tcrAddress)
  } catch {
    return false
  }

  const data = await readIndexer(
    subgraphEndpoint,
    queryTemplate.replace('$address', checksumAddress.toLowerCase()),
  )

  return !!data[entityKey]
}

const useFactory = () => {
  const urlChainId = useUrlChainId()
  const GTCR_SUBGRAPH_URL = urlChainId ? subgraphUrl[urlChainId] : undefined
  const PGTCR_SUBGRAPH_URL = urlChainId
    ? subgraphUrlPermanent[urlChainId]
    : undefined

  const deployedWithLightFactory = (tcrAddress: string) =>
    checkRegistryExists(
      GTCR_SUBGRAPH_URL,
      '{ lregistry:LRegistry_by_pk(id: "$address") { id } }',
      'lregistry',
      tcrAddress,
    )

  const deployedWithFactory = (tcrAddress: string) =>
    checkRegistryExists(
      GTCR_SUBGRAPH_URL,
      '{ registry:Registry_by_pk(id: "$address") { id } }',
      'registry',
      tcrAddress,
    )

  const deployedWithPermanentFactory = (tcrAddress: string) =>
    checkRegistryExists(
      PGTCR_SUBGRAPH_URL,
      '{ registry(id: "$address") { id } }',
      'registry',
      tcrAddress,
    )

  return {
    deployedWithLightFactory,
    deployedWithFactory,
    deployedWithPermanentFactory,
  }
}

export default useFactory
