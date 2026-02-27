import { useState, useMemo, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useUrlChainId from 'hooks/use-url-chain-id'
import { ethers, BigNumber } from 'ethers'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { abi as _GTCRView } from '@kleros/tcr/build/contracts/GeneralizedTCRView.json'
import { WalletContext } from '../contexts/wallet-context'
import {
  gtcrViewAddresses,
  subgraphUrl,
  subgraphUrlPermanent,
} from 'config/tcr-addresses'
import { getAlchemyRpcUrl } from 'config/rpc'
import { parseIpfs } from 'utils/ipfs-parse'

/**
 * Last-resort fallback: fetch MetaEvidence URI from on-chain event logs
 * when all subgraphs are unavailable. Uses the same pattern as the badges
 * component (src/pages/item-details/badges/index.tsx).
 */
export const fetchMetaEvidenceViaRPC = async (
  tcr: string,
  networkId: number,
): Promise<FetchMetaEvidenceResult | null> => {
  const rpcUrl = getAlchemyRpcUrl(networkId)
  if (!rpcUrl) return null

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const contract = new ethers.Contract(tcr, _gtcr, provider)

  const logs = (
    await provider.getLogs({
      ...contract.filters.MetaEvidence(),
      fromBlock: 0,
    })
  ).map((log) => contract.interface.parseLog(log))

  if (logs.length === 0) return null

  return {
    metaEvidenceURI: logs[logs.length - 1].args._evidence,
  }
}

export const fetchMetaEvidence = async (
  tcr: string,
  networkId: number,
): Promise<FetchMetaEvidenceResult | null> => {
  const envioQuery = {
    query: `{
    registry:Registry_by_pk(id: "${tcr.toLowerCase()}") {
      registrationMetaEvidence {
        uri
      }
      connectedTCR
    }
    lregistry:LRegistry_by_pk(id: "${tcr.toLowerCase()}") {
      registrationMetaEvidence {
        uri
      }
      connectedTCR
    }
  }`,
    variables: {},
  }

  const pgtcrQuery = {
    query: `{
    registry(id: "${tcr.toLowerCase()}") {
      arbitrationSettings(orderBy: timestamp, orderDirection: desc, first: 1) {
        metaEvidenceURI
      }
    }
  }`,
    variables: {},
  }

  try {
    // 1. Try Envio first (fast) — covers Classic + Light TCRs.
    const envioData = (
      await (
        await fetch(subgraphUrl[networkId], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(envioQuery),
        })
      ).json()
    ).data

    if (envioData?.registry)
      return {
        metaEvidenceURI: envioData.registry.registrationMetaEvidence.uri,
        connectedTCR: envioData.registry.connectedTCR,
      }
    if (envioData?.lregistry)
      return {
        metaEvidenceURI: envioData.lregistry.registrationMetaEvidence.uri,
        connectedTCR: envioData.lregistry.connectedTCR,
      }

    // 2. Only try Goldsky if Envio didn't find it (rare — permanent TCRs).
    const pgtcrData = (
      await (
        await fetch(subgraphUrlPermanent[networkId], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pgtcrQuery),
        })
      ).json()
    ).data

    if (pgtcrData?.registry)
      return {
        metaEvidenceURI:
          pgtcrData.registry.arbitrationSettings[0].metaEvidenceURI,
      }

    return null
  } catch (err) {
    // 3. Both subgraphs failed — fall back to RPC event logs.
    console.warn('Subgraph MetaEvidence fetch failed, falling back to RPC', err)
    return fetchMetaEvidenceViaRPC(tcr, networkId)
  }
}

const useTcrView = (tcrAddress: string) => {
  const [error, setError] = useState<string | false>(false)

  const latestBlock = useContext(WalletContext)?.latestBlock

  // Use the URL chain for provider & lookups (not the wagmi/wallet chain).
  const urlChainId = useUrlChainId()
  const networkId = urlChainId ?? undefined
  const library = useEthersProvider({ chainId: networkId })

  const arbitrableTCRViewAddr = gtcrViewAddresses[networkId]
  const gtcrView = useMemo(() => {
    if (!library || !arbitrableTCRViewAddr || !networkId) return
    try {
      return new ethers.Contract(arbitrableTCRViewAddr, _GTCRView, library)
    } catch (err) {
      console.error('Error instantiating gtcr view contract', err)
      setError('Error instantiating view contract')
    }
  }, [arbitrableTCRViewAddr, library, networkId])

  const gtcr = useMemo(() => {
    if (!library || !tcrAddress || !networkId) return

    try {
      ethers.utils.getAddress(tcrAddress) // Test if address is valid
      return new ethers.Contract(tcrAddress, _gtcr, library)
    } catch (err) {
      console.error('Error instantiating gtcr contract', err)
      setError('Error setting up this TCR')
    }
  }, [library, networkId, tcrAddress])

  // Cached for 1 day (meta evidence rarely changes but is not immutable).
  const metaEvidenceQuery = useQuery({
    queryKey: ['metaEvidence', 'classic', tcrAddress, networkId],
    queryFn: async () => {
      const fetchedData = await fetchMetaEvidence(tcrAddress, networkId!)
      if (!fetchedData) return null
      const response = await fetch(parseIpfs(fetchedData.metaEvidenceURI))
      const file = await response.json()
      return {
        metaEvidence: { ...file, address: tcrAddress } as MetaEvidence,
        connectedTCR: fetchedData.connectedTCR,
      }
    },
    enabled: !!tcrAddress && !!networkId,
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  })

  const metaEvidence = metaEvidenceQuery.data?.metaEvidence
  const connectedTCRAddr = metaEvidenceQuery.data?.connectedTCR

  // On-chain TCR params (deposits, costs) — cached, rarely changes.
  const arbitrableQuery = useQuery({
    queryKey: ['arbitrableTCRData', 'classic', tcrAddress, networkId],
    queryFn: async () => {
      const data = await gtcrView!.fetchArbitrable(tcrAddress)
      return { ...data, tcrAddress }
    },
    enabled: !!gtcrView && !!tcrAddress,
    staleTime: Infinity,
  })

  const arbitrableTCRData = arbitrableQuery.data

  // Derive deposits from arbitrable data (pure computation, no network).
  const deposits = useMemo(() => {
    if (!arbitrableTCRData) return {}

    try {
      const {
        submissionBaseDeposit,
        removalBaseDeposit,
        submissionChallengeBaseDeposit,
        removalChallengeBaseDeposit,
        arbitrationCost: cost,
      } = arbitrableTCRData

      return {
        arbitrationCost: cost as BigNumber,
        submissionDeposit: (submissionBaseDeposit as BigNumber).add(
          cost as BigNumber,
        ),
        removalDeposit: (removalBaseDeposit as BigNumber).add(
          cost as BigNumber,
        ),
        submissionChallengeDeposit: (
          submissionChallengeBaseDeposit as BigNumber
        ).add(cost as BigNumber),
        removalChallengeDeposit: (removalChallengeBaseDeposit as BigNumber).add(
          cost as BigNumber,
        ),
      }
    } catch (err) {
      console.error('Error computing arbitration cost:', err)
      return {}
    }
  }, [arbitrableTCRData])

  return {
    gtcr,
    metaEvidence,
    tcrError:
      error ||
      (metaEvidenceQuery.error ? 'Error fetching meta evidence' : false),
    arbitrationCost: deposits.arbitrationCost,
    submissionDeposit: deposits.submissionDeposit,
    submissionChallengeDeposit: deposits.submissionChallengeDeposit,
    removalDeposit: deposits.removalDeposit,
    removalChallengeDeposit: deposits.removalChallengeDeposit,
    tcrAddress,
    gtcrView,
    latestBlock,
    connectedTCRAddr,
    ...arbitrableTCRData,
  }
}

export default useTcrView
