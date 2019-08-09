import React, { useState, useContext } from 'react'
import { Descriptions, Button, Skeleton } from 'antd'
import ItemStatus from '../../components/item-status'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import { itemToStatusCode, STATUS_CODE } from '../../utils/item-status'
import itemPropTypes from '../../utils/item-prop-types'
import ETHAddress from '../../components/eth-address'
import ItemActionModal from '../../components/item-action-modal'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { WalletContext } from '../../bootstrap/wallet-context'
import { abi } from '../../assets/contracts/GTCRMock.json'
import { ethers } from 'ethers'

const ItemActionButton = ({ statusCode, itemName, itemID, pushWeb3Action }) => {
  const { gtcr: gtcrView } = useContext(TCRViewContext)
  const executeRequest = async (_, signer) => {
    const gtcr = new ethers.Contract(gtcrView.address, abi, signer)
    return {
      tx: await gtcr.executeRequest(itemID),
      actionMessage: `Executing ${
        statusCode === STATUS_CODE.PENDING_SUBMISSION ? 'submission' : 'removal'
      }.`
    }
  }
  const challengeRequest = async (_, signer) => {
    const gtcr = new ethers.Contract(gtcrView.address, abi, signer)
    return {
      tx: await gtcr.challengeRequest(itemID),
      actionMessage: `Challenging ${
        statusCode.SUBMITTED ? 'submission' : 'removal'
      }.`
    }
  }

  if (!statusCode || !itemName || !itemID)
    return (
      <Button type="primary" disabled loading>
        Loading...
      </Button>
    )

  switch (statusCode) {
    case STATUS_CODE.REJECTED:
      return <Button type="primary">Resubmit {itemName}</Button>
    case STATUS_CODE.REGISTERED:
      return <Button type="primary">Remove {itemName}</Button>
    case STATUS_CODE.SUBMITTED:
      return (
        <Button
          size="large"
          type="primary"
          onClick={() => pushWeb3Action(challengeRequest)}
        >
          Challenge Submission
        </Button>
      )
    case STATUS_CODE.REMOVAL_REQUESTED:
      return (
        <Button
          size="large"
          type="primary"
          onClick={() => pushWeb3Action(challengeRequest)}
        >
          Challenge Removal
        </Button>
      )
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return <Button type="primary">Fund Appeal</Button>
    case STATUS_CODE.PENDING_SUBMISSION:
      return (
        <Button type="primary" onClick={() => pushWeb3Action(executeRequest)}>
          Execute Submission
        </Button>
      )
    case STATUS_CODE.PENDING_REMOVAL:
      return (
        <Button type="primary" onClick={() => pushWeb3Action(executeRequest)}>
          Execute Removal
        </Button>
      )
    case STATUS_CODE.CHALLENGED:
    case STATUS_CODE.WAITING_ARBITRATOR:
      return (
        <Button type="primary" disabled>
          Waiting Arbitrator
        </Button>
      )
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

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
  const { pushWeb3Action } = useContext(WalletContext)
  const { gtcr, metaEvidence, challengePeriodDuration } = useContext(
    TCRViewContext
  )

  if (!item || !timestamp || !challengePeriodDuration || !metaEvidence)
    return <Skeleton active title={false} paragraph={{ rows: 2 }} />

  const { itemName } = metaEvidence
  const statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

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
        gtcr={gtcr}
      />
      {/* Only render modal if the item status requires it. */}
      {statusCode !== STATUS_CODE.PENDING_SUBMISSION &&
        statusCode !== STATUS_CODE.PENDING_REMOVAL && (
          <ItemActionModal
            statusCode={statusCode}
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
