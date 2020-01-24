import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  useContext
} from 'react'
import { useWeb3Context } from 'web3-react'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { abi as _GTCRView } from '@kleros/tcr/build/contracts/GeneralizedTCRView.json'
import { abi as _arbitrator } from '@kleros/tcr/build/contracts/IArbitrator.json'
import { ethers } from 'ethers'
import PropTypes from 'prop-types'
import useNetworkEnvVariable from '../hooks/network-env'
import { gtcrDecode } from '../utils/encoder'
import localforage from 'localforage'
import { WalletContext } from './wallet-context'

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const useTcrView = tcrAddress => {
  const { latestBlock } = useContext(WalletContext)
  const { library, active, networkId } = useWeb3Context()
  const [metaEvidence, setMetaEvidence] = useState()
  const [error, setError] = useState(false)
  const [arbitrableTCRData, setArbitrableTCRData] = useState()
  const [arbitrationCost, setArbitrationCost] = useState()
  const [submissionDeposit, setSubmissionDeposit] = useState()
  const [submissionChallengeDeposit, setSubmissionChallengeDeposit] = useState()
  const [removalDeposit, setRemovalDeposit] = useState()
  const [removalChallengeDeposit, setRemovalChallengeDeposit] = useState()
  const [itemSubmissionLogs, setItemSubmissionLogs] = useState({})
  const [connectedTCRAddr, setConnectedTCRAddr] = useState()
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
      return new ethers.Contract(tcrAddress, _gtcr, library)
    } catch (err) {
      console.error('Error instantiating gtcr contract', err)
      setError('Error setting up this TCR')
    }
  }, [active, library, networkId, tcrAddress])

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
        setError('Error computing arbitration cost')
      }
    })()
  }, [arbitrableTCRData, arbitrationCost, library])

  // Fetch meta evidence.
  useEffect(() => {
    if (
      !gtcr ||
      !library ||
      gtcr.address !== tcrAddress ||
      (metaEvidence && metaEvidence.tcrAddress === tcrAddress)
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

        const { _evidence: metaEvidencePath } = logs[0].values
        const file = await (
          await fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath)
        ).json()

        setMetaEvidence({ ...file, tcrAddress })
        localforage.setItem(META_EVIDENCE_CACHE_KEY, { ...file, tcrAddress })
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
      metaEvidence.tcrAddress !== tcrAddress
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
            .map(submissionLog => ({
              ...submissionLog,
              decodedData: gtcrDecode({ columns, values: submissionLog.data }),
              columns,
              tcrAddress
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
