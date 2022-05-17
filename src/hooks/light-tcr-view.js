import { useState, useEffect, useMemo } from 'react'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import localforage from 'localforage'
import _gtcr from '../assets/abis/LightGeneralizedTCR.json'
import _GTCRView from '../assets/abis/LightGeneralizedTCRView.json'
import { abi as _arbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import getNetworkEnv from '../utils/network-env'
import useNotificationWeb3 from './notifications-web3'
import { getAddress } from 'ethers/utils'
import useGetLogs from './get-logs'

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const useLightTcrView = tcrAddress => {
  const [metaEvidence, setMetaEvidence] = useState()
  const [error, setError] = useState(false)
  const [arbitrableTCRData, setArbitrableTCRData] = useState()
  const [arbitrationCost, setArbitrationCost] = useState()
  const [submissionDeposit, setSubmissionDeposit] = useState()
  const [submissionChallengeDeposit, setSubmissionChallengeDeposit] = useState()
  const [removalDeposit, setRemovalDeposit] = useState()
  const [removalChallengeDeposit, setRemovalChallengeDeposit] = useState()
  const [connectedTCRAddr, setConnectedTCRAddr] = useState()
  const [depositFor, setDepositFor] = useState()
  const [metadataByTime, setMetadataByTime] = useState()

  const { latestBlock } = useNotificationWeb3()
  const { library, active, networkId } = useWeb3Context()
  const arbitrableTCRViewAddr = getNetworkEnv(
    'REACT_APP_LGTCRVIEW_ADDRESSES',
    networkId
  )
  const getLogs = useGetLogs(library)

  // Wire up the TCR.
  const gtcrView = useMemo(() => {
    if (!library || !active || !arbitrableTCRViewAddr || !networkId) return
    try {
      return new ethers.Contract(arbitrableTCRViewAddr, _GTCRView, library)
    } catch (err) {
      console.error('Error instantiating gtcr view contract', err)
      setError('Error instantiating view contract')
    }
  }, [arbitrableTCRViewAddr, active, library, networkId])

  const gtcr = useMemo(() => {
    if (!library || !active || !tcrAddress || !networkId) return

    try {
      ethers.utils.getAddress(tcrAddress) // Test if address is valid
      return new ethers.Contract(tcrAddress, _gtcr, library)
    } catch (err) {
      console.error('Error instantiating gtcr contract', err)
      setError('Error setting up this TCR')
    }
  }, [active, library, networkId, tcrAddress])

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
      .then(file => setMetaEvidence(file))
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
        setError('Error fetching arbitrable TCR data (light-curate)')
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
          arbitrator: arbitratorAddress,
          arbitratorExtraData,
          submissionBaseDeposit,
          removalBaseDeposit,
          submissionChallengeBaseDeposit,
          removalChallengeBaseDeposit
        } = arbitrableTCRData

        const arbitrator = new ethers.Contract(
          arbitratorAddress,
          _arbitrator,
          library
        )

        const newArbitrationCost = await arbitrator.arbitrationCost(
          arbitratorExtraData
        )

        // Submission deposit = submitter base deposit + arbitration cost
        const newSubmissionDeposit = submissionBaseDeposit.add(
          newArbitrationCost
        )

        // Removal deposit = removal base deposit + arbitration cost
        const newRemovalDeposit = removalBaseDeposit.add(newArbitrationCost)

        // Challenge deposit = submission challenge base deposit + arbitration cost
        const newSubmissionChallengeDeposit = submissionChallengeBaseDeposit.add(
          newArbitrationCost
        )

        // Challenge deposit = removal challenge base deposit + arbitration cost
        const newRemovalChallengeDeposit = removalChallengeBaseDeposit.add(
          newArbitrationCost
        )

        setArbitrationCost(newArbitrationCost)
        setSubmissionDeposit(newSubmissionDeposit)
        setSubmissionChallengeDeposit(newSubmissionChallengeDeposit)
        setRemovalDeposit(newRemovalDeposit)
        setRemovalChallengeDeposit(newRemovalChallengeDeposit)
        setDepositFor(arbitrableTCRData.tcrAddress)
      } catch (err) {
        console.error('Error computing arbitration cost:', err)
        if (err.message === 'header not found' && arbitrationCost)
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
        const logs = (
          await getLogs({
            ...gtcr.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => ({ ...log, ...gtcr.interface.parseLog(log) }))
        if (logs.length === 0) return

        const metaEvidenceFiles = await Promise.all(
          logs.map(async log => {
            try {
              const { values, blockNumber } = log
              const { _evidence: metaEvidencePath } = values

              const [response, block] = await Promise.all([
                fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath),
                library.getBlock(blockNumber)
              ])

              const file = await response.json()

              return {
                ...file,
                address: tcrAddress,
                timestamp: block.timestamp,
                blockNumber
              }
            } catch (err) {
              console.warn('Failed to process meta evidence')
              return { err }
            }
          })
        )

        const metadataTime = {
          byBlockNumber: {},
          byTimestamp: {},
          address: logs[0].address
        }
        metaEvidenceFiles.forEach(file => {
          if (file.error) return
          metadataTime.byBlockNumber[file.blockNumber] = file
          metadataTime.byTimestamp[file.timestamp] = file
        })
        setMetadataByTime(metadataTime)

        // Take the penultimate item. This is the most recent meta evidence
        // for registration requests.
        const file = metaEvidenceFiles[metaEvidenceFiles.length - 2]
        setMetaEvidence({ ...file, address: tcrAddress })
        localforage.setItem(META_EVIDENCE_CACHE_KEY, file)
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
    getLogs
  ])

  // Fetch the Related TCR address
  useEffect(() => {
    if (!gtcr || !library || gtcr.address !== tcrAddress) return
    ;(async () => {
      const logs = (
        await getLogs({
          ...gtcr.filters.ConnectedTCRSet(),
          fromBlock: 0
        })
      ).map(log => gtcr.interface.parseLog(log))
      if (logs.length === 0) return

      setConnectedTCRAddr(logs[logs.length - 1].values._connectedTCR)
    })()
  }, [gtcr, library, connectedTCRAddr, tcrAddress, getLogs])

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
    metadataByTime,
    ...arbitrableTCRData
  }
}

export default useLightTcrView
