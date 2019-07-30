import { Spin, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { useDebounce } from 'use-debounce'
import StyledLayoutContent from '../layout-content'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import _GTCR from '../../assets/contracts/ItemMock.json'

const StyledSpin = styled(Spin)`
  left: 50%;
  position: absolute;
  transform: translate(-50%, 0);
`

const Items = ({
  match: {
    params: { tcrAddress }
  }
}) => {
  const { abi } = _GTCR
  const { library, active } = useWeb3Context()
  const [errored, setErrored] = useState()
  const [metaEvidencePath, setMetaEvidencePath] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [debouncedMetaEvidencePath] = useDebounce(metaEvidencePath, 1000)

  // Fetch meta evidence logs.
  useEffect(() => {
    ;(async () => {
      if (!library || !active || !tcrAddress) return
      try {
        const tcr = new ethers.Contract(tcrAddress, abi, library)
        tcr.on('MetaEvidence', (_, metaEvidencePath) => {
          setMetaEvidencePath(metaEvidencePath)
        })
        const blockNumber = await tcr.prevBlockNumber()
        library.resetEventsBlock(blockNumber) // Reset provider to fetch logs.
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [library, active, tcrAddress, abi])

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

  if (!tcrAddress || errored)
    return (
      <ErrorPage
        code="400"
        message="A TCR was not found at this address. Are you in the correct network?"
      />
    )

  return (
    <StyledLayoutContent>
      <div>
        {!metaEvidence && <StyledSpin />}
        {metaEvidence && (
          <Typography.Title ellipsis>{metaEvidence.title}</Typography.Title>
        )}
        {metaEvidence && (
          <Typography.Text ellipsis type="secondary">
            {metaEvidence.description}
          </Typography.Text>
        )}
      </div>
    </StyledLayoutContent>
  )
}

Items.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.objectOf(PropTypes.string)
  }).isRequired
}

export default Items
