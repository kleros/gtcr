import { ethers } from 'ethers'
import useUrlChainId from 'hooks/use-url-chain-id'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'

const { getAddress } = ethers.utils

/**
 * Check if a TCR address exists in a subgraph by querying an entity.
 * @param {string} subgraphUrl - The subgraph endpoint URL
 * @param {string} queryTemplate - GraphQL query string (use $address placeholder)
 * @param {string} entityKey - The key to check in the response data
 */
const checkRegistryExists = async (
  subgraphEndpoint: string,
  queryTemplate: string,
  entityKey: string,
  tcrAddress: string,
): Promise<boolean> => {
  if (!tcrAddress) return false
  let checksumAddress: string
  try {
    checksumAddress = getAddress(tcrAddress)
  } catch {
    return false
  }

  const query = {
    query: queryTemplate.replace('$address', checksumAddress.toLowerCase()),
  }
  const { data } = await (
    await fetch(subgraphEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    })
  ).json()

  return !!data[entityKey]
}

const useFactory = () => {
  const urlChainId = useUrlChainId()
  const GTCR_SUBGRAPH_URL = urlChainId ? subgraphUrl[urlChainId] : undefined
  const PGTCR_SUBGRAPH_URL = urlChainId
    ? subgraphUrlPermanent[urlChainId]
    : undefined

  const deployedWithLightFactory = (tcrAddress) =>
    checkRegistryExists(
      GTCR_SUBGRAPH_URL,
      '{ lregistry:LRegistry_by_pk(id: "$address") { id } }',
      'lregistry',
      tcrAddress,
    )

  const deployedWithFactory = (tcrAddress) =>
    checkRegistryExists(
      GTCR_SUBGRAPH_URL,
      '{ registry:Registry_by_pk(id: "$address") { id } }',
      'registry',
      tcrAddress,
    )

  const deployedWithPermanentFactory = (tcrAddress) =>
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
