import React, { useState, useContext } from 'react'
import { Descriptions, Skeleton } from 'antd'
import ItemStatus from '../../components/item-status'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import { itemToStatusCode, STATUS_CODE } from '../../utils/item-status'
import itemPropTypes from '../../utils/item-prop-types'
import ETHAddress from '../../components/eth-address'
import ItemActionModal from './item-action-modal'
import ItemActionButton from '../../components/item-action-button'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { WalletContext } from '../../bootstrap/wallet-context'
import { abi } from '../../assets/contracts/GTCRMock.json'
import { ethers } from 'ethers'

const StyledRequestInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
`

const StyledDescriptions = styled(Descriptions)`
  max-width: 500px;
`

const ItemActions = ({ item, timestamp }) => {
  const [modalOpen, setModalOpen] = useState()
  const { pushWeb3Action, requestWeb3Auth } = useContext(WalletContext)
  const { gtcr: gtcrView, metaEvidence, challengePeriodDuration } = useContext(
    TCRViewContext
  )

  if (!item || !timestamp || !challengePeriodDuration || !metaEvidence)
    return <Skeleton active title={false} paragraph={{ rows: 2 }} />

  const { itemName } = metaEvidence
  const statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  const executeRequest = async (_, signer) => {
    const gtcr = new ethers.Contract(gtcrView.address, abi, signer)
    return {
      tx: await gtcr.executeRequest(item.ID),
      actionMessage: `Executing ${
        statusCode === STATUS_CODE.PENDING_SUBMISSION ? 'submission' : 'removal'
      }`
    }
  }

  // TODO: Only open modal if user has a wallet connected.
  const onClick = () => {
    switch (statusCode) {
      case STATUS_CODE.REJECTED:
      case STATUS_CODE.REGISTERED:
      case STATUS_CODE.SUBMITTED:
      case STATUS_CODE.REMOVAL_REQUESTED:
      case STATUS_CODE.CROWDFUNDING:
      case STATUS_CODE.CROWDFUNDING_WINNER: {
        requestWeb3Auth(() => setModalOpen(true))
        break
      }
      case STATUS_CODE.PENDING_SUBMISSION:
      case STATUS_CODE.PENDING_REMOVAL:
        return pushWeb3Action(executeRequest)
      case STATUS_CODE.CHALLENGED:
      case STATUS_CODE.WAITING_ARBITRATOR:
        return null
      default:
        throw new Error(`Unhandled status code ${statusCode}`)
    }
  }

  return (
    <StyledRequestInfo>
      <StyledDescriptions>
        <Descriptions.Item label="Status" span={2}>
          <ItemStatus
            item={item}
            challengePeriodDuration={challengePeriodDuration}
            timestamp={timestamp}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Requester">
          <ETHAddress address={item.requester} />
        </Descriptions.Item>
      </StyledDescriptions>
      <ItemActionButton
        statusCode={statusCode}
        itemName={itemName}
        itemID={item && item.ID}
        pushWeb3Action={pushWeb3Action}
        onClick={onClick}
      />
      {/* Only render modal if the item status requires it. */}
      {statusCode !== STATUS_CODE.PENDING_SUBMISSION &&
        statusCode !== STATUS_CODE.PENDING_REMOVAL &&
        statusCode !== STATUS_CODE.CHALLENGED && (
          <ItemActionModal
            statusCode={statusCode}
            itemName={itemName}
            item={item}
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        )}
    </StyledRequestInfo>
  )
}

ItemActions.propTypes = {
  item: itemPropTypes,

  // BN.js instances.
  timestamp: PropTypes.shape({})
}

ItemActions.defaultProps = {
  item: null,
  timestamp: null
}

export default ItemActions
