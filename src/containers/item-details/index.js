import { Layout } from 'antd'
import React, { useState, useEffect, useContext } from 'react'
import PropTypes from 'prop-types'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import ItemDetailsCard from '../../components/item-details-card'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { typeToSolidity } from '../../utils/item-types'
import web3EthAbi from 'web3-eth-abi'
import { itemToStatusCode } from '../../utils/item-status'
import { TCRContext } from '../../bootstrap/tcr-context'

const {
  utils: { bigNumberify }
} = ethers

const StyledLayoutContent = styled(Layout.Content)`
  background: white;
  padding: 42px 9.375vw 42px;
  display: flex;
  flex-direction: column;
`

const ItemDetails = ({ itemID, tcrAddress }) => {
  const { library } = useWeb3Context()
  const [errored, setErrored] = useState()
  const { metaEvidence, tcr, metaEvidenceError } = useContext(TCRContext)
  const [itemStatus, setItemStatus] = useState()
  const [item, setItem] = useState()

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

        setItemStatus(
          itemToStatusCode(item, timestamp, challengePeriodDuration)
        )
        setItem(item)
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [setItem, metaEvidence, tcr, itemID, library])

  if (!tcrAddress || !itemID || errored || metaEvidenceError)
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
  tcrAddress: PropTypes.string.isRequired,
  itemID: PropTypes.string.isRequired
}

export default ItemDetails
