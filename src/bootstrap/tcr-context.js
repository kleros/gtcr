import React, { createContext, useState, useEffect } from 'react'
import { useWeb3Context } from 'web3-react'
import { useDebounce } from 'use-debounce'
import { abi } from '../assets/contracts/GTCRMock.json'
import { ethers } from 'ethers'
import PropTypes from 'prop-types'

const useTcr = tcrAddress => {
  const { library, active } = useWeb3Context()
  const [metaEvidencePath, setMetaEvidencePath] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [debouncedMetaEvidencePath] = useDebounce(metaEvidencePath, 300)
  const [tcr, setTcr] = useState()
  const [errored, setErrored] = useState(false)

  // Wire up the TCR.
  useEffect(() => {
    if (!library || !active || !tcrAddress) return
    setTcr(new ethers.Contract(tcrAddress, abi, library))
  }, [setTcr, library, active, tcrAddress])

  // Fetch meta evidence logs.
  useEffect(() => {
    if (!tcr || !library) return
    const saveMetaEvidencePath = (_, metaEvidencePath) => {
      setMetaEvidencePath(metaEvidencePath)
    }
    try {
      tcr.on('MetaEvidence', saveMetaEvidencePath)
      library.resetEventsBlock(0) // Reset provider to fetch logs.
    } catch (err) {
      console.error(err)
      setErrored(true)
    }

    return () => {
      tcr.removeListener('MetaEvidence', saveMetaEvidencePath)
    }
  }, [tcr, library])

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

  return { metaEvidence, tcr, errored }
}

const TCRContext = createContext()
const TCRProvider = ({ children, tcrAddress }) => (
  <TCRContext.Provider value={{ ...useTcr(tcrAddress) }}>
    {children}
  </TCRContext.Provider>
)

TCRProvider.propTypes = {
  children: PropTypes.node.isRequired,
  tcrAddress: PropTypes.string.isRequired
}

export { TCRContext, TCRProvider }
