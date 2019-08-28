import React, { createContext, useState, useEffect, useMemo } from 'react'
import { useWeb3Context } from 'web3-react'
import { useDebounce } from 'use-debounce'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { abi as _GTCRView } from '@kleros/tcr/build/contracts/GeneralizedTCRView.json'
import { abi as _arbitrator } from '@kleros/tcr/build/contracts/Arbitrator.json'
import { ethers } from 'ethers'
import PropTypes from 'prop-types'
import useGtcrView from '../hooks/gtcr-view'

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const useTcrView = tcrAddress => {
  const { library, active } = useWeb3Context()
  const ARBITRABLE_TCR_VIEW_ADDRESS = useGtcrView()
  const [metaEvidencePath, setMetaEvidencePath] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [debouncedMetaEvidencePath] = useDebounce(metaEvidencePath, 300)
  const [errored, setErrored] = useState(false)
  const [arbitrableTCRData, setArbitrableTCRData] = useState()
  const [arbitrationCost, setArbitrationCost] = useState()
  const [requestDeposit, setRequestDeposit] = useState()
  const [challengeDeposit, setChallengeDeposit] = useState()

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
      console.error(err)
      setErrored(true)
    }
  }, [ARBITRABLE_TCR_VIEW_ADDRESS, active, library])

  const gtcr = useMemo(() => {
    if (!library || !active || !tcrAddress) return
    try {
      return new ethers.Contract(tcrAddress, _gtcr, library)
    } catch (err) {
      console.error(err)
      setErrored(true)
    }
  }, [active, library, tcrAddress])

  // Get TCR data.
  useEffect(() => {
    if (!gtcrView || !tcrAddress) return
    ;(async () => {
      try {
        setArbitrableTCRData(await gtcrView.fetchArbitrable(tcrAddress))
      } catch (err) {
        console.error(err)
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
          requesterBaseDeposit,
          challengerBaseDeposit,
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

        // Request deposit = requester base deposit + arbitration cost + fee stake
        // fee stake = requester deposit * shared stake multiplier / multiplier divisor
        const requestDeposit = requesterBaseDeposit
          .add(arbitrationCost)
          .add(
            requesterBaseDeposit
              .mul(sharedStakeMultiplier)
              .div(MULTIPLIER_DIVISOR)
          )

        // Challenge deposit = challenger base deposit + arbitration cost + fee stake
        // fee stake = requester deposit * shared stake multiplier / multiplier divisor
        const challengeDeposit = challengerBaseDeposit
          .add(arbitrationCost)
          .add(
            requesterBaseDeposit
              .mul(sharedStakeMultiplier)
              .div(MULTIPLIER_DIVISOR)
          )

        setArbitrationCost(arbitrationCost)
        setRequestDeposit(requestDeposit)
        setChallengeDeposit(challengeDeposit)
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [
    arbitrableTCRData,
    setArbitrationCost,
    library,
    arbitrationCost,
    setErrored,
    setChallengeDeposit
  ])

  // Fetch meta evidence logs.
  useEffect(() => {
    if (!gtcr || !library) return
    try {
      gtcr.on(gtcr.filters.MetaEvidence(), (_, metaEvidencePath) => {
        setMetaEvidencePath(metaEvidencePath)
      })
      library.resetEventsBlock(0) // Reset provider to fetch logs.
    } catch (err) {
      console.error(err)
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
        const file = await (await fetch(
          process.env.REACT_APP_IPFS_GATEWAY + debouncedMetaEvidencePath
        )).json()
        setMetaEvidence(file)
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [debouncedMetaEvidencePath, setMetaEvidence])

  return {
    gtcr,
    metaEvidence,
    tcrErrored: errored,
    arbitrationCost,
    requestDeposit,
    challengeDeposit,
    tcrAddress,
    gtcrView,
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
