import React, { createContext, useState, useEffect } from 'react'
import { useWeb3Context } from 'web3-react'
import { useDebounce } from 'use-debounce'
import { abi as _gtcr } from '../assets/contracts/GTCRMock.json'
import { abi as _arbitrableTCRView } from '../assets/contracts/ArbitrableTCRView.json'
import { ethers } from 'ethers'
import PropTypes from 'prop-types'
import useArbitrableTCRView from '../hooks/arbitrable-tcr-view'

const useTcrView = tcrAddress => {
  const { library, active } = useWeb3Context()
  const ARBITRABLE_TCR_VIEW_ADDRESS = useArbitrableTCRView()
  const [metaEvidencePath, setMetaEvidencePath] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [debouncedMetaEvidencePath] = useDebounce(metaEvidencePath, 300)
  const [gtcr, setGtcr] = useState()
  const [arbitrableTCRView, setArbitrableTCRView] = useState()
  const [errored, setErrored] = useState(false)
  const [arbitrableTCRData, setArbitrableTCRData] = useState()

  // Wire up the TCR.
  useEffect(() => {
    if (!library || !active || !tcrAddress) return
    setGtcr(new ethers.Contract(tcrAddress, _gtcr, library))
    setArbitrableTCRView(
      new ethers.Contract(
        ARBITRABLE_TCR_VIEW_ADDRESS,
        _arbitrableTCRView,
        library
      )
    )
  }, [
    setGtcr,
    setArbitrableTCRView,
    library,
    active,
    tcrAddress,
    ARBITRABLE_TCR_VIEW_ADDRESS
  ])

  // Get TCR data.
  useEffect(() => {
    if (!arbitrableTCRView || !tcrAddress) return
    ;(async () => {
      setArbitrableTCRData(await arbitrableTCRView.fetchData(tcrAddress))
    })()
  }, [setArbitrableTCRData, arbitrableTCRView, tcrAddress])

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
