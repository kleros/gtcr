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
import { parseIpfs } from 'utils/ipfs-parse'

export const fetchMetaEvidence = async (
  tcr: string,
  networkId: number,
): Promise<FetchMetaEvidenceResult | null> => {
  const query = {
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
  const [data, pgtcrData] = await Promise.all([
    (
      await (
        await fetch(subgraphUrl[networkId], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(query),
        })
      ).json()
    ).data,
    (
      await (
        await fetch(subgraphUrlPermanent[networkId], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pgtcrQuery),
        })
      ).json()
    ).data,
  ])
  if (!data?.registry && !data?.lregistry && !pgtcrData?.registry) return null
  else if (data.registry !== null)
    return {
      metaEvidenceURI: data.registry.registrationMetaEvidence.uri,
      connectedTCR: data.registry.connectedTCR,
    }
  else if (data.lregistry !== null)
    return {
      metaEvidenceURI: data.lregistry.registrationMetaEvidence.uri,
      connectedTCR: data.lregistry.connectedTCR,
    }
  else
    return {
      metaEvidenceURI:
        pgtcrData.registry.arbitrationSettings[0].metaEvidenceURI,
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

  // MetaEvidence is immutable — fetch once and cache for the session.
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
    staleTime: Infinity,
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
        removalChallengeDeposit: (
          removalChallengeBaseDeposit as BigNumber
        ).add(cost as BigNumber),
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
