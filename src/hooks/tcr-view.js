import { useState, useEffect, useMemo } from 'react'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import localforage from 'localforage'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { abi as _GTCRView } from '@kleros/tcr/build/contracts/GeneralizedTCRView.json'
import getNetworkEnv from '../utils/network-env'
import { gtcrDecode } from '@kleros/gtcr-encoder'
import useNotificationWeb3 from './notifications-web3'
import { getAddress } from 'ethers/utils'
import takeLower from '../utils/lower-limit'
import useGetLogs from './get-logs'

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const useTcrView = tcrAddress => {
  const [metaEvidence, setMetaEvidence] = useState()
  const [error, setError] = useState(false)
  const [arbitrableTCRData, setArbitrableTCRData] = useState()
  const [arbitrationCost, setArbitrationCost] = useState()
  const [submissionDeposit, setSubmissionDeposit] = useState()
  const [submissionChallengeDeposit, setSubmissionChallengeDeposit] = useState()
  const [removalDeposit, setRemovalDeposit] = useState()
  const [removalChallengeDeposit, setRemovalChallengeDeposit] = useState()
  const [itemSubmissionLogs, setItemSubmissionLogs] = useState()
  const [connectedTCRAddr, setConnectedTCRAddr] = useState()
  const [depositFor, setDepositFor] = useState()
  const [metadataByTime, setMetadataByTime] = useState()

  const { latestBlock } = useNotificationWeb3()
  const { library, active, networkId } = useWeb3Context()
  const arbitrableTCRViewAddr = getNetworkEnv(
    'REACT_APP_GTCRVIEW_ADDRESSES',
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
        console.error('Error fetching arbitrable TCR data:', err)
        setError('Error fetching arbitrable TCR data')
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
      (metaEvidence && metaEvidence.address === tcrAddress) ||
      !getLogs
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
                timestamp: block.timestamp
              }
            } catch (err) {
              console.warn('Failed to process meta evidence')
              return { err }
            }
          })
        )

        const metadataTime = {
          byTimestamp: {},
          address: logs[0].address
        }
        metaEvidenceFiles.forEach(file => {
          if (file.error) return
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
    if (!getLogs) return
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

  // Fetch and decode item submission logs.
  useEffect(() => {
    if (
      !gtcr ||
      !library ||
      gtcr.address !== tcrAddress ||
      !metadataByTime ||
      metadataByTime.address !== tcrAddress ||
      !getLogs
    )
      return
    ;(async () => {
      try {
        setItemSubmissionLogs(
          (
            await getLogs({
              ...gtcr.filters.ItemSubmitted(),
              fromBlock: 0
            })
          )
            .map(log => ({
              ...log,
              data: gtcr.interface.parseLog(log).values._data,
              itemID: gtcr.interface.parseLog(log).values._itemID,
              submitter: gtcr.interface.parseLog(log).values._submitter
            }))
            .map(submissionLog => {
              let decodedData
              const errors = []
              const file =
                metadataByTime.byBlockNumber[
                  takeLower(
                    Object.keys(metadataByTime.byBlockNumber),
                    submissionLog.blockNumber
                  )
                ]
              const { columns } = file.metadata
              try {
                decodedData = gtcrDecode({
                  columns,
                  values: submissionLog.data
                })
              } catch (err) {
                console.warn(
                  `Error decoding ${submissionLog._itemID} of TCR at ${tcrAddress}`,
                  err
                )
                errors.push(
                  `Error decoding ${submissionLog._itemID} of TCR at ${tcrAddress}`
                )
              }
              return {
                ...submissionLog,
                decodedData,
                columns,
                tcrAddress,
                address: tcrAddress,
                errors
              }
            })
            .map(submissionLog => ({
              ...submissionLog,
              columns: submissionLog.columns.map((col, i) => ({
                ...col,
                value: submissionLog.decodedData && submissionLog.decodedData[i]
              }))
            }))
            .map(submissionLog => ({
              ...submissionLog,
              keys: submissionLog.columns
                .filter(col => col.isIdentifier)
                .map(col => col.value)
            }))
        )
      } catch (err) {
        console.error('Error fetching submission logs', err)
        setError('Error fetching submission logs')
      }
    })()
  }, [gtcr, library, metaEvidence, metadataByTime, tcrAddress, getLogs])

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
    itemSubmissionLogs,
    latestBlock,
    connectedTCRAddr,
    metadataByTime,
    ...arbitrableTCRData
  }
}

export default useTcrView
