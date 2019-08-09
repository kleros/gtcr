import React, { createContext, useState, useEffect } from 'react'
import { useWeb3Context } from 'web3-react'
import { useDebounce } from 'use-debounce'
import { abi } from '../assets/contracts/GTCRMock.json'
import { ethers } from 'ethers'
import PropTypes from 'prop-types'

const useTcrView = tcrAddress => {
  const { library, active } = useWeb3Context()
  const [metaEvidencePath, setMetaEvidencePath] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [debouncedMetaEvidencePath] = useDebounce(metaEvidencePath, 300)
  const [gtcr, setGtcr] = useState()
  const [errored, setErrored] = useState(false)
  const [challengePeriodDuration, setChallengePeriodDuration] = useState()

  // Wire up the TCR.
  useEffect(() => {
    if (!library || !active || !tcrAddress) return
    setGtcr(new ethers.Contract(tcrAddress, abi, library))
  }, [setGtcr, library, active, tcrAddress])

  // Get TCR data.
  useEffect(() => {
    if (!gtcr) return
    ;(async () => {
      // Get the challenge period duration.
      setChallengePeriodDuration(await gtcr.challengePeriodDuration())
    })()
  }, [setChallengePeriodDuration, gtcr])

  // Fetch meta evidence logs.
  useEffect(() => {
    if (!gtcr || !library) return
    const saveMetaEvidencePath = (_, metaEvidencePath) => {
      setMetaEvidencePath(metaEvidencePath)
    }
    try {
      gtcr.on('MetaEvidence', saveMetaEvidencePath)
      library.resetEventsBlock(0) // Reset provider to fetch logs.
    } catch (err) {
      console.error(err)
      setErrored(true)
    }

    return () => {
      gtcr.removeListener('MetaEvidence', saveMetaEvidencePath)
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
    challengePeriodDuration
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
