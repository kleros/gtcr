import React, { useState, useContext } from 'react'
import { Descriptions, Skeleton } from 'antd'
import ItemStatusBadge from '../../components/item-status-badge'
import styled from 'styled-components/macro'
import {
  itemToStatusCode,
  STATUS_CODE,
  DISPUTE_STATUS,
  PARTY
} from '../../utils/item-status'
import itemPropTypes from '../../prop-types/item'
import ETHAddress from '../../components/eth-address'
import ItemActionModal from './item-action-modal'
import ItemActionButton from '../../components/item-action-button'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { WalletContext } from '../../bootstrap/wallet-context'
import { abi } from '../../assets/contracts/GTCRMock.json'
import { ethers } from 'ethers'
import BNPropType from '../../prop-types/bn'

const StyledRequestInfo = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: space-between;

  @media (max-width: 575px) {
    flex-direction: column;
  }
`

const StyledDescriptions = styled(Descriptions)`
  flex-wrap: wrap;
  justify-content: space-between;
  flex-direction: column;
  margin-right: 16px;
  max-width: 991px;
`
const SkeletonTitleProps = { width: 60 }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`

const DisputeStatus = ({ disputeStatus }) => {
  if (!disputeStatus)
    return (
      <StyledSkeleton active paragraph={false} title={SkeletonTitleProps} />
    )

  switch (disputeStatus) {
    case DISPUTE_STATUS.SOLVED:
      return 'Resolved.'
    case DISPUTE_STATUS.APPEALABLE:
      return 'Appealable'
    default:
      throw new Error(`Unhandled dispute status ${disputeStatus}`)
  }
}

const Ruling = ({ currentRuling }) => {
  if (!currentRuling)
    return (
      <StyledSkeleton active paragraph={false} title={SkeletonTitleProps} />
    )

  switch (currentRuling) {
    case PARTY.NONE:
      return 'The arbitrator refused to rule.'
    case PARTY.REQUESTER:
      return 'The arbitrator ruled in favor of the requester.'
    case PARTY.CHALLENGER:
      return 'The arbitrator ruled in favor of the challenger.'
    default:
      throw new Error(`Unhandled ruling ${currentRuling}`)
  }
}

const ItemStatus = ({ item, timestamp }) => {
  const [modalOpen, setModalOpen] = useState()
  const { pushWeb3Action, requestWeb3Auth } = useContext(WalletContext)
  const { gtcr: gtcrView, metaEvidence, challengePeriodDuration } = useContext(
    TCRViewContext
  )

  if (!item || !timestamp || !challengePeriodDuration || !metaEvidence)
    return <Skeleton active title={false} paragraph={{ rows: 2 }} />

  const { itemName } = metaEvidence
  const { disputeStatus, currentRuling } = item
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
      <StyledDescriptions
        column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}
      >
        <Descriptions.Item label="Status">
          <ItemStatusBadge
            item={item}
            challengePeriodDuration={challengePeriodDuration}
            timestamp={timestamp}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Requester">
          <ETHAddress address={item.requester} />
        </Descriptions.Item>
        {disputeStatus !== DISPUTE_STATUS.WAITING && (
          <Descriptions.Item label="Dispute Status">
            <DisputeStatus disputeStatus={disputeStatus} />
          </Descriptions.Item>
        )}
        {disputeStatus !== DISPUTE_STATUS.WAITING && (
          <Descriptions.Item label="Ruling">
            <Ruling currentRuling={currentRuling} />
          </Descriptions.Item>
        )}
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

ItemStatus.propTypes = {
  item: itemPropTypes,
  timestamp: BNPropType
}

ItemStatus.defaultProps = {
  item: null,
  timestamp: null
}

export default ItemStatus
