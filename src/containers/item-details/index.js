import { Layout, Divider, Card } from 'antd'
import React, { useState, useEffect, useContext } from 'react'
import PropTypes from 'prop-types'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import ItemDetailsCard from '../../components/item-details-card'
import ItemActions from './item-actions'
import { useWeb3Context } from 'web3-react'
import { typeToSolidity } from '../../utils/item-types'
import web3EthAbi from 'web3-eth-abi'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { bigNumberify } from 'ethers/utils'

const StyledLayoutContent = styled(Layout.Content)`
  background: white;
  padding: 42px 9.375vw 42px;
  display: flex;
  flex-direction: column;
`

const ItemDetails = ({ itemID, tcrAddress }) => {
  const { library } = useWeb3Context()
  const [errored, setErrored] = useState()
  const {
    metaEvidence,
    gtcr,
    tcrErrored,
    challengePeriodDuration
  } = useContext(TCRViewContext)
  const [item, setItem] = useState()
  const [timestamp, setTimestamp] = useState()

  // Fetch item.
  useEffect(() => {
    ;(async () => {
      if (!metaEvidence || !gtcr || !itemID || !library) return
      const { columns } = metaEvidence
      const types = columns.map(column => typeToSolidity[column.type])
      try {
        const item = { ...(await gtcr.getItem(itemID)) } // Spread to convert from array to object.
        item.data = web3EthAbi.decodeParameters(types, item.data)
        setTimestamp(bigNumberify((await library.getBlock()).timestamp))
        setItem(item)
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [setItem, metaEvidence, gtcr, itemID, library])

  if (!tcrAddress || !itemID || errored || tcrErrored)
    return (
      <ErrorPage
        code="400"
        message="This item could not be found."
        tip="Is your wallet set to the correct network?"
      />
    )

  return (
    <StyledLayoutContent>
      <Card>
        <ItemActions item={item} timestamp={timestamp} />
      </Card>
      <Divider />
      <ItemDetailsCard
        columns={metaEvidence && metaEvidence.columns}
        loading={!metaEvidence || !item}
        item={item}
        timestamp={timestamp}
        challengePeriodDuration={challengePeriodDuration}
      />
    </StyledLayoutContent>
  )
}

ItemDetails.propTypes = {
  tcrAddress: PropTypes.string.isRequired,
  itemID: PropTypes.string.isRequired
}

export default ItemDetails
