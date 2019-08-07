import { Layout } from 'antd'
import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import ItemDetailsCard from '../../components/item-details-card'
import { abi } from '../../assets/contracts/GTCRMock.json'
import { useWeb3Context } from 'web3-react'
import { useDebounce } from 'use-debounce'
import { ethers } from 'ethers'
import { typeToSolidity } from '../../utils/item-types'
import web3EthAbi from 'web3-eth-abi'
import { itemToStatusCode } from '../../utils/item-status'

const {
  utils: { bigNumberify }
} = ethers

const StyledLayoutContent = styled(Layout.Content)`
  background: white;
  padding: 42px 9.375vw 42px;
  display: flex;
  flex-direction: column;
`

const ItemDetails = ({
  match: {
    params: { tcrAddress, itemID }
  }
}) => {
  const { library, active } = useWeb3Context()
  const [errored, setErrored] = useState()
  const [metaEvidencePath, setMetaEvidencePath] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [itemStatus, setItemStatus] = useState()
  const [debouncedMetaEvidencePath] = useDebounce(metaEvidencePath, 200)
  const [tcr, setTcr] = useState()
  const [item, setItem] = useState()

  // Wire up the TCR.
  useEffect(() => {
    if (!library || !active || !tcrAddress) return
    setTcr(new ethers.Contract(tcrAddress, abi, library))
  }, [setTcr, library, active, tcrAddress])

  // Fetch meta evidence logs and current time.
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

  // Fetch item.
  useEffect(() => {
    ;(async () => {
      if (!metaEvidence || !tcr || !itemID || !library) return
      const { columns } = metaEvidence
      const types = columns.map(column => typeToSolidity[column.type])
      try {
        const item = await tcr.getItem(itemID)
        item.data = web3EthAbi.decodeParameters(types, item.data)
        const timestamp = bigNumberify((await library.getBlock()).timestamp)
        const challengePeriodDuration = await tcr.challengePeriodDuration()

        setItem(item)
        setItemStatus(
          itemToStatusCode(item, timestamp, challengePeriodDuration)
        )
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [setItem, metaEvidence, tcr, itemID, library])

  if (!tcrAddress || !itemID || errored)
    return (
      <ErrorPage
        code="400"
        message="This item could not be found."
        tip="Is your wallet set to the correct network?"
      />
    )

  return (
    <StyledLayoutContent>
      <ItemDetailsCard
        columns={metaEvidence && metaEvidence.columns}
        data={item && item.data}
        loading={!metaEvidence || !item}
        statusCode={itemStatus}
      />
    </StyledLayoutContent>
  )
}

ItemDetails.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      tcrAddress: PropTypes.string,
      itemID: PropTypes.string
    })
  }).isRequired
}

export default ItemDetails
