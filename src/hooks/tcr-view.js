import { useState, useEffect, useMemo } from 'react'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import localforage from 'localforage'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { abi as _GTCRView } from '@kleros/tcr/build/contracts/GeneralizedTCRView.json'
import { abi as _arbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import useNetworkEnvVariable from './network-env'
import { gtcrDecode } from '../utils/encoder'
import useNotificationWeb3 from './notifications-web3'

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const useTcrView = tcrAddress => {
  const { latestBlock } = useNotificationWeb3()
  const { library, active, networkId } = useWeb3Context()
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
  const arbitrableTCRViewAddr = useNetworkEnvVariable(
    'REACT_APP_GTCRVIEW_ADDRESSES',
    networkId
  )

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
        setArbitrableTCRData(await gtcrView.fetchArbitrable(tcrAddress))
      } catch (err) {
        console.error('Error fetching arbitrable TCR data:', err)
        setError('Error fetching arbitrable TCR data')
      }
    })()
  }, [gtcrView, tcrAddress])

  // Get the current arbitration cost to calculate request and challenge deposits.
  useEffect(() => {
    ;(async () => {
      if (!arbitrableTCRData || tcrAddress === depositFor) return
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

        const arbitrationCost = await arbitrator.arbitrationCost(
          arbitratorExtraData
        )

        // Submission deposit = submitter base deposit + arbitration cost
        const submissionDeposit = submissionBaseDeposit.add(arbitrationCost)

        // Removal deposit = removal base deposit + arbitration cost
        const removalDeposit = removalBaseDeposit.add(arbitrationCost)

        // Challenge deposit = submission challenge base deposit + arbitration cost
        const submissionChallengeDeposit = submissionChallengeBaseDeposit.add(
          arbitrationCost
        )

        // Challenge deposit = removal challenge base deposit + arbitration cost
        const removalChallengeDeposit = removalChallengeBaseDeposit.add(
          arbitrationCost
        )

        setArbitrationCost(arbitrationCost)
        setSubmissionDeposit(submissionDeposit)
        setSubmissionChallengeDeposit(submissionChallengeDeposit)
        setRemovalDeposit(removalDeposit)
        setRemovalChallengeDeposit(removalChallengeDeposit)
        setDepositFor(arbitrableTCRData.tcrAddress)
      } catch (err) {
        console.error('Error computing arbitration cost:', err)
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
          await library.getLogs({
            ...gtcr.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => gtcr.interface.parseLog(log))
        if (logs.length === 0) return

        // Take the penultimate item. This is the most recent meta evidence
        // for registration requests.
        const { _evidence: metaEvidencePath } = logs[logs.length - 2].values
        const file = await (
          await fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath)
        ).json()

        setMetaEvidence({ ...file, address: tcrAddress })
        localforage.setItem(META_EVIDENCE_CACHE_KEY, {
          ...file,
          address: tcrAddress
        })
      } catch (err) {
        console.error('Error fetching meta evidence', err)
        setError('Error fetching meta evidence')
      }
    })()

    return () => {
      gtcr.removeAllListeners(gtcr.filters.MetaEvidence())
    }
  }, [META_EVIDENCE_CACHE_KEY, gtcr, library, metaEvidence, tcrAddress])

  // Fetch the Related TCR address
  useEffect(() => {
    if (!gtcr || !library || gtcr.address !== tcrAddress) return
    ;(async () => {
      const logs = (
        await library.getLogs({
          ...gtcr.filters.ConnectedTCRSet(),
          fromBlock: 0
        })
      ).map(log => gtcr.interface.parseLog(log))
      if (logs.length === 0) return

      setConnectedTCRAddr(logs[logs.length - 1].values._connectedTCR)
    })()
  }, [gtcr, library, connectedTCRAddr, tcrAddress])

  // Fetch and decode item submission logs.
  useEffect(() => {
    if (
      !gtcr ||
      !library ||
      gtcr.address !== tcrAddress ||
      !metaEvidence ||
      !metaEvidence.metadata ||
      metaEvidence.address !== tcrAddress
    )
      return

    const { columns } = metaEvidence.metadata
    ;(async () => {
      try {
        setItemSubmissionLogs(
          (
            await library.getLogs({
              ...gtcr.filters.ItemSubmitted(),
              fromBlock: 0
            })
          )
            .map(log => ({
              data: gtcr.interface.parseLog(log).values._data,
              itemID: gtcr.interface.parseLog(log).values._itemID,
              submitter: gtcr.interface.parseLog(log).values._submitter
            }))
            .map(submissionLog => {
              let decodedData
              const errors = []
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
  }, [gtcr, library, metaEvidence, tcrAddress])

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
    ...arbitrableTCRData
  }
}

export default useTcrView
