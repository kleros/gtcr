import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useEthersProvider } from 'hooks/ethers-adapters'
import { ethers, BigNumber } from 'ethers'
import localforage from 'localforage'
import _gtcr from '../assets/abis/LightGeneralizedTCR.json'
import _GTCRView from '../assets/abis/LightGeneralizedTCRView.json'
import useNotificationWeb3 from './notifications-web3'
import { lightGtcrViewAddresses, subgraphUrl } from 'config/tcr-addresses'
import { parseIpfs } from 'utils/ipfs-parse'
const { getAddress } = ethers.utils

export const fetchMetaEvidence = async (tcr: string, networkId: number): Promise<FetchMetaEvidenceResult> => {
  const query = {
    query: `{
      lregistry:LRegistry_by_pk(id: "${tcr.toLowerCase()}") {
        registrationMetaEvidence {
          uri
        }
        connectedTCR
      }
    }`
  }

  const response = await fetch(subgraphUrl[networkId], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  })

  const { data } = await response.json()
  return {
    metaEvidenceURI: data.lregistry.registrationMetaEvidence.uri,
    connectedTCR: data.lregistry.connectedTCR
  }
}

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const useLightTcrView = (tcrAddress: string) => {
  const [metaEvidence, setMetaEvidence] = useState<MetaEvidence | undefined>(undefined)
  const [error, setError] = useState<string | false>(false)
  const [arbitrableTCRData, setArbitrableTCRData] = useState<Record<string, unknown> | undefined>(undefined)
  const [arbitrationCost, setArbitrationCost] = useState<BigNumber | undefined>()
  const [submissionDeposit, setSubmissionDeposit] = useState<BigNumber | undefined>()
  const [submissionChallengeDeposit, setSubmissionChallengeDeposit] = useState<BigNumber | undefined>()
  const [removalDeposit, setRemovalDeposit] = useState<BigNumber | undefined>()
  const [removalChallengeDeposit, setRemovalChallengeDeposit] = useState<BigNumber | undefined>()
  const [connectedTCRAddr, setConnectedTCRAddr] = useState<string | undefined>()
  const [depositFor, setDepositFor] = useState<string | undefined>()

  const { latestBlock } = useNotificationWeb3()

  // Use the URL chain for provider & lookups (not the wagmi/wallet chain).
  const { chainId: urlChainId } = useParams()
  const networkId = urlChainId ? Number(urlChainId) : undefined
  const library = useEthersProvider({ chainId: networkId })

  const arbitrableTCRViewAddr = lightGtcrViewAddresses[networkId]

  // Wire up the TCR.
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

  const META_EVIDENCE_CACHE_KEY = useMemo(() => {
    if (!gtcr || typeof networkId === 'undefined') return null
    return `metaEvidence-${gtcr.address}@networkID-${networkId}`
  }, [networkId, gtcr])

  // Use cached meta evidence, if any is available.
  // It will be overwritten by the latest once it has been fetched.
  useEffect(() => {
    if (!META_EVIDENCE_CACHE_KEY) return
    localforage
      .getItem(META_EVIDENCE_CACHE_KEY)
      .then(file => setMetaEvidence(file as MetaEvidence | undefined))
      .catch(err => {
        console.error('Error fetching meta evidence file from cache', err)
      })
  }, [META_EVIDENCE_CACHE_KEY])

  // Get TCR data.
  useEffect(() => {
    if (!gtcrView || !tcrAddress) return
    ;(async () => {
      try {
        setArbitrableTCRData({
          ...(await gtcrView.fetchArbitrable(tcrAddress)),
          tcrAddress
        })
      } catch (err) {
        console.error('Error fetching arbitrable TCR data (light-curate):', err)
        // Non-fatal: items still load from subgraph. Deposit/challenge features
        // will be unavailable but the page remains browsable.
      }
    })()
  }, [gtcrView, tcrAddress])

  // Get the current arbitration cost to calculate request and challenge deposits.
  useEffect(() => {
    ;(async () => {
      if (
        !arbitrableTCRData ||
        tcrAddress === depositFor ||
        (arbitrationCost && depositFor && tcrAddress === depositFor)
      )
        return

      try {
        // Check that both urls are valid.
        getAddress(tcrAddress)
        if (depositFor) getAddress(depositFor)
      } catch (_) {
        // No-op
        return
      }

      try {
        const {
          submissionBaseDeposit,
          removalBaseDeposit,
          submissionChallengeBaseDeposit,
          removalChallengeBaseDeposit,
          arbitrationCost: newArbitrationCost
        } = arbitrableTCRData

        // Submission deposit = submitter base deposit + arbitration cost
        const newSubmissionDeposit = (submissionBaseDeposit as BigNumber).add(
          newArbitrationCost as BigNumber
        )

        // Removal deposit = removal base deposit + arbitration cost
        const newRemovalDeposit = (removalBaseDeposit as BigNumber).add(newArbitrationCost as BigNumber)

        // Challenge deposit = submission challenge base deposit + arbitration cost
        const newSubmissionChallengeDeposit = (submissionChallengeBaseDeposit as BigNumber).add(
          newArbitrationCost as BigNumber
        )

        // Challenge deposit = removal challenge base deposit + arbitration cost
        const newRemovalChallengeDeposit = (removalChallengeBaseDeposit as BigNumber).add(
          newArbitrationCost as BigNumber
        )

        setArbitrationCost(newArbitrationCost as BigNumber)
        setSubmissionDeposit(newSubmissionDeposit)
        setSubmissionChallengeDeposit(newSubmissionChallengeDeposit)
        setRemovalDeposit(newRemovalDeposit)
        setRemovalChallengeDeposit(newRemovalChallengeDeposit)
        setDepositFor(arbitrableTCRData.tcrAddress as string | undefined)
      } catch (err) {
        console.error('Error computing arbitration cost:', err)
        if ((err as Error).message === 'header not found' && arbitrationCost)
          // No-op, arbitration cost was already set when metamask threw.
          return

        setError('Error computing arbitration cost')
      }
    })()
  }, [arbitrableTCRData, arbitrationCost, depositFor, library, tcrAddress])

  // Fetch meta evidence.
  useEffect(() => {
    if (
      !gtcr ||
      !library ||
      gtcr.address !== tcrAddress ||
      (metaEvidence && metaEvidence.address === tcrAddress)
    )
      return
    ;(async () => {
      try {
        // Take the latest meta evidence.
        const fetchedData = await fetchMetaEvidence(tcrAddress, networkId!)
        setConnectedTCRAddr(fetchedData.connectedTCR)

        const response = await fetch(parseIpfs(fetchedData.metaEvidenceURI))

        const file = await response.json()

        setMetaEvidence({ ...file, address: tcrAddress })
        localforage.setItem(META_EVIDENCE_CACHE_KEY!, file)
      } catch (err) {
        console.error('Error fetching meta evidence', err)
        setError('Error fetching meta evidence')
      }
    })()

    return () => {
      gtcr.removeAllListeners(gtcr.filters.MetaEvidence())
    }
  }, [
    META_EVIDENCE_CACHE_KEY,
    gtcr,
    library,
    metaEvidence,
    tcrAddress,
    networkId
  ])

  return {
    gtcr,
    metaEvidence,
    tcrError: error,
    arbitrationCost,
    submissionDeposit,
    submissionChallengeDeposit,
    removalDeposit,
    removalChallengeDeposit,
    tcrAddress,
    gtcrView,
    latestBlock,
    connectedTCRAddr,
    ...arbitrableTCRData
  }
}

export default useLightTcrView
