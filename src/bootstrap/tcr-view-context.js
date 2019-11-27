import React, { createContext, useState, useEffect, useMemo } from 'react'
import { useWeb3Context } from 'web3-react'
import { useDebounce } from 'use-debounce'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { abi as _GTCRView } from '@kleros/tcr/build/contracts/GeneralizedTCRView.json'
import { abi as _arbitrator } from '@kleros/tcr/build/contracts/Arbitrator.json'
import { ethers } from 'ethers'
import PropTypes from 'prop-types'
import useNetworkEnvVariable from '../hooks/network-env'
import { gtcrDecode } from '../utils/encoder'
import localforage from 'localforage'

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const useTcrView = tcrAddress => {
  const { library, active, networkId } = useWeb3Context()
  const [metaEvidencePath, setMetaEvidencePath] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [debouncedMetaEvidencePath] = useDebounce(metaEvidencePath, 300)
  const [metaEvidencePaths, setMetaEvidencePaths] = useState([])
  const [errored, setErrored] = useState(false)
  const [arbitrableTCRData, setArbitrableTCRData] = useState()
  const [arbitrationCost, setArbitrationCost] = useState()
  const [submissionDeposit, setSubmissionDeposit] = useState()
  const [submissionChallengeDeposit, setSubmissionChallengeDeposit] = useState()
  const [removalDeposit, setRemovalDeposit] = useState()
  const [removalChallengeDeposit, setRemovalChallengeDeposit] = useState()
  const [submissionLogs, setSubmissionLogs] = useState([])
  const ARBITRABLE_TCR_VIEW_ADDRESS = useNetworkEnvVariable(
    'REACT_APP_GTCRVIEW_ADDRESSES',
    networkId
  )

  // Wire up the TCR.
  const gtcrView = useMemo(() => {
    if (!library || !active || !ARBITRABLE_TCR_VIEW_ADDRESS) return
    try {
      return new ethers.Contract(
        ARBITRABLE_TCR_VIEW_ADDRESS,
        _GTCRView,
        library
      )
    } catch (err) {
      console.error('Error instantiating gtcr view contract', err)
      setErrored(true)
    }
  }, [ARBITRABLE_TCR_VIEW_ADDRESS, active, library])

  const gtcr = useMemo(() => {
    if (!library || !active || !tcrAddress) return
    try {
      return new ethers.Contract(tcrAddress, _gtcr, library)
    } catch (err) {
      console.error('Error instantiating gtcr contract', err)
      setErrored(true)
    }
  }, [active, library, tcrAddress])

  const META_EVIDENCE_CACHE_KEY = useMemo(() => {
    if (!tcrAddress || typeof networkId === 'undefined') return null
    return `metaEvidence-${tcrAddress}@networkID-${networkId}`
  }, [networkId, tcrAddress])

  // Use cached meta evidence, if any is available.
  // It will be overwritten by the latest once it has been fetched.
  useEffect(() => {
    if (!META_EVIDENCE_CACHE_KEY) return
    localforage
      .getItem(META_EVIDENCE_CACHE_KEY)
      .then(file => setMetaEvidence(file))
      .catch(err => {
        console.error('Error fetching meta evidence file from cache')
        console.error(err)
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
        setErrored(true)
      }
    })()
  }, [setArbitrableTCRData, gtcrView, tcrAddress, setErrored])

  // Get the current arbitration cost to calculate request and challenge deposits.
  useEffect(() => {
    ;(async () => {
      // We also check that arbitrationCost != null to prevent the effect
      // from running more than once.
      if (!arbitrableTCRData || arbitrationCost != null) return
      try {
        const {
          arbitrator: arbitratorAddress,
          arbitratorExtraData,
          submissionBaseDeposit,
          removalBaseDeposit,
          submissionChallengeBaseDeposit,
          removalChallengeBaseDeposit,
          sharedStakeMultiplier,
          MULTIPLIER_DIVISOR
        } = arbitrableTCRData

        const arbitrator = new ethers.Contract(
          arbitratorAddress,
          _arbitrator,
          library
        )

        const arbitrationCost = await arbitrator.arbitrationCost(
          arbitratorExtraData
        )

        // Submission deposit = submitter base deposit + arbitration cost + fee stake
        // fee stake = arbitration cost * shared stake multiplier / multiplier divisor
        const submissionDeposit = submissionBaseDeposit
          .add(arbitrationCost)
          .add(
            arbitrationCost.mul(sharedStakeMultiplier).div(MULTIPLIER_DIVISOR)
          )

        // Removal deposit = removal base deposit + arbitration cost + fee stake
        // fee stake = arbitration cost * shared stake multiplier / multiplier divisor
        const removalDeposit = removalBaseDeposit
          .add(arbitrationCost)
          .add(
            arbitrationCost.mul(sharedStakeMultiplier).div(MULTIPLIER_DIVISOR)
          )

        // Challenge deposit = submission challenge base deposit + arbitration cost + fee stake
        // fee stake = arbitration cost * shared stake multiplier / multiplier divisor
        const submissionChallengeDeposit = submissionChallengeBaseDeposit
          .add(arbitrationCost)
          .add(
            arbitrationCost.mul(sharedStakeMultiplier).div(MULTIPLIER_DIVISOR)
          )

        // Challenge deposit = removal challenge base deposit + arbitration cost + fee stake
        // fee stake = arbitration cost * shared stake multiplier / multiplier divisor
        const removalChallengeDeposit = removalChallengeBaseDeposit
          .add(arbitrationCost)
          .add(
            arbitrationCost.mul(sharedStakeMultiplier).div(MULTIPLIER_DIVISOR)
          )

        setArbitrationCost(arbitrationCost)
        setSubmissionDeposit(submissionDeposit)
        setSubmissionChallengeDeposit(submissionChallengeDeposit)
        setRemovalDeposit(removalDeposit)
        setRemovalChallengeDeposit(removalChallengeDeposit)
      } catch (err) {
        console.error('Error computing arbitration cost:', err)
        setErrored(true)
      }
    })()
  }, [
    arbitrableTCRData,
    setArbitrationCost,
    library,
    arbitrationCost,
    setErrored
  ])

  // Fetch meta evidence and item submission logs.
  useEffect(() => {
    if (!gtcr || !library) return
    try {
      gtcr.on(gtcr.filters.MetaEvidence(), (_, metaEvidencePath) => {
        setMetaEvidencePath(metaEvidencePath)
        setMetaEvidencePaths(paths => [...paths, metaEvidencePath])
      })
      gtcr.on(gtcr.filters.ItemSubmitted(), (itemID, submitter, data) => {
        setSubmissionLogs(submissionLogs => [
          ...submissionLogs,
          { itemID, submitter, data }
        ])
      })
      library.resetEventsBlock(0) // Reset provider to fetch logs.
    } catch (err) {
      console.error('Error fetching meta evidence', err)
      setErrored(true)
    }

    return () => {
      gtcr.removeAllListeners(gtcr.filters.MetaEvidence())
    }
  }, [gtcr, library])

  // Fetch latest meta evidence file.
  useEffect(() => {
    ;(async () => {
      if (!debouncedMetaEvidencePath) return
      try {
        const file = await (
          await fetch(
            process.env.REACT_APP_IPFS_GATEWAY + debouncedMetaEvidencePath
          )
        ).json()
        setMetaEvidence(file)
        localforage.setItem(META_EVIDENCE_CACHE_KEY, file)
      } catch (err) {
        console.error('Error fetching meta evidence files', err)
        setErrored(true)
      }
    })()
  }, [
    META_EVIDENCE_CACHE_KEY,
    debouncedMetaEvidencePath,
    networkId,
    setMetaEvidence,
    tcrAddress
  ])

  const decodedSubmissionLogs = useMemo(() => {
    if (!metaEvidence || submissionLogs.length === 0) return []
    const { columns } = metaEvidence
    return submissionLogs
      .map(submissionLog => ({
        ...submissionLog,
        decodedData: gtcrDecode({ columns, values: submissionLog.data }),
        columns
      }))
      .map(submissionLog => ({
        ...submissionLog,
        columns: submissionLog.columns.map((col, i) => ({
          ...col,
          value: submissionLog.decodedData[i]
        }))
      }))
      .map(submissionLog => ({
        ...submissionLog,
        keys: submissionLog.columns
          .filter(col => col.isIdentifier)
          .map(col => col.value)
      }))
  }, [metaEvidence, submissionLogs])

  return {
    gtcr,
    metaEvidence,
    tcrErrored: errored,
    arbitrationCost,
    submissionDeposit,
    submissionChallengeDeposit,
    removalDeposit,
    removalChallengeDeposit,
    tcrAddress,
    gtcrView,
    metaEvidencePaths,
    decodedSubmissionLogs,
    ...arbitrableTCRData
  }
}

const TCRViewContext = createContext()
const TCRViewProvider = ({ children, tcrAddress }) => (
  <TCRViewContext.Provider value={{ ...useTcrView(tcrAddress) }}>
    {children}
  </TCRViewContext.Provider>
)

TCRViewProvider.propTypes = {
  children: PropTypes.node.isRequired,
  tcrAddress: PropTypes.string.isRequired
}

export { TCRViewContext, TCRViewProvider }
