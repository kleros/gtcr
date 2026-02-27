import { useState, useMemo, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useUrlChainId from 'hooks/use-url-chain-id'
import { ethers, BigNumber } from 'ethers'
import _gtcr from '../assets/abis/LightGeneralizedTCR.json'
import _GTCRView from '../assets/abis/LightGeneralizedTCRView.json'
import { WalletContext } from '../contexts/wallet-context'
import { lightGtcrViewAddresses, subgraphUrl } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
import { fetchMetaEvidenceViaRPC } from './tcr-view'

export const fetchMetaEvidence = async (
  tcr: string,
  networkId: number,
): Promise<FetchMetaEvidenceResult> => {
  const query = {
    query: `{
      lregistry:LRegistry_by_pk(id: "${tcr.toLowerCase()}") {
        registrationMetaEvidence {
          uri
        }
        connectedTCR
      }
    }`,
  }

  try {
    const response = await fetch(subgraphUrl[networkId], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    })

    const { data } = await response.json()
    return {
      metaEvidenceURI: data.lregistry.registrationMetaEvidence.uri,
      connectedTCR: data.lregistry.connectedTCR,
    }
  } catch (err) {
    console.warn(
      'Light subgraph MetaEvidence fetch failed, falling back to RPC',
      err,
    )
    const result = await fetchMetaEvidenceViaRPC(tcr, networkId)
    if (!result) throw new Error('MetaEvidence not found via RPC fallback')
    return result
  }
}

const useLightTcrView = (tcrAddress: string) => {
  const [error, setError] = useState<string | false>(false)

  const latestBlock = useContext(WalletContext)?.latestBlock

  // Use the URL chain for provider & lookups (not the wagmi/wallet chain).
  const urlChainId = useUrlChainId()
  const networkId = urlChainId ?? undefined
  const library = useEthersProvider({ chainId: networkId })

  const arbitrableTCRViewAddr = lightGtcrViewAddresses[networkId]

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
    queryKey: ['metaEvidence', 'light', tcrAddress, networkId],
    queryFn: async () => {
      const fetchedData = await fetchMetaEvidence(tcrAddress, networkId!)
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
    queryKey: ['arbitrableTCRData', 'light', tcrAddress, networkId],
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

export default useLightTcrView
