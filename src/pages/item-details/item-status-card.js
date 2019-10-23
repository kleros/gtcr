import React, { useState, useContext, useMemo } from 'react'
import { Descriptions, Skeleton, Card } from 'antd'
import ItemStatusBadge from '../../components/item-status-badge'
import styled from 'styled-components/macro'
import {
  itemToStatusCode,
  STATUS_CODE,
  DISPUTE_STATUS,
  PARTY,
  CONTRACT_STATUS,
  hasPendingRequest
} from '../../utils/item-status'
import itemPropTypes from '../../prop-types/item'
import ETHAddress from '../../components/eth-address'
import ItemActionModal from './item-action-modal'
import ItemActionButton from '../../components/item-action-button'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { WalletContext } from '../../bootstrap/wallet-context'
import { abi } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { ethers } from 'ethers'
import BNPropType from '../../prop-types/bn'
import useHumanizedCountdown from '../../hooks/countdown'

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
  if (disputeStatus == null)
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
  if (currentRuling == null)
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

const ItemStatusCard = ({ item, timestamp }) => {
  const [modalOpen, setModalOpen] = useState()
  const { pushWeb3Action, requestWeb3Auth } = useContext(WalletContext)
  const { gtcr: gtcrView, metaEvidence, challengePeriodDuration } = useContext(
    TCRViewContext
  )

  // Get remaining appeal time, if any and build countdown.
  const { appealRemainingTime, appealRemainingTimeLoser } = useMemo(() => {
    if (!item || item.disputeStatus !== DISPUTE_STATUS.APPEALABLE) return {}
    const { appealEnd } = item
    const appealRemainingTime = appealEnd.toNumber() * 1000 - Date.now()
    return {
      appealRemainingTime,
      appealRemainingTimeLoser: appealRemainingTime / 2
    }
  }, [item])
  const appealCountdown = useHumanizedCountdown(appealRemainingTime)
  const appealLoserCountdown = useHumanizedCountdown(appealRemainingTimeLoser)

  // Get remaining challenge period, if applicable and build countdown.
  const challengeRemainingTime = useMemo(() => {
    if (
      !item ||
      item.disputed ||
      !item.submissionTime ||
      !challengePeriodDuration
    )
      return

    const { submissionTime } = item
    const deadline =
      submissionTime.add(challengePeriodDuration).toNumber() * 1000
    return deadline - Date.now()
  }, [challengePeriodDuration, item])
  const challengeCountdown = useHumanizedCountdown(challengeRemainingTime)

  if (!item || !timestamp || !challengePeriodDuration)
    return (
      <Card hoverable>
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      </Card>
    )

  const { disputeStatus, currentRuling, disputed } = item
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
    <>
      <Card
        hoverable
        title={
          <ItemStatusBadge
            item={item}
            challengePeriodDuration={challengePeriodDuration}
            timestamp={timestamp}
            dark
          />
        }
        extra={
          <ItemActionButton
            statusCode={statusCode}
            itemName={metaEvidence && metaEvidence.itemName}
            itemID={item && item.ID}
            pushWeb3Action={pushWeb3Action}
            onClick={onClick}
          />
        }
        bodyStyle={
          !hasPendingRequest(item.status)
            ? { display: 'none' }
            : { display: '?' }
        }
      >
        <StyledDescriptions
          column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}
        >
          {hasPendingRequest(item.status) && (
            <Descriptions.Item label="Request Type">
              {item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? `Submission`
                : `Removal request`}
            </Descriptions.Item>
          )}
          {hasPendingRequest(item.status) && (
            <Descriptions.Item label="Requester">
              <ETHAddress address={item.requester} />
            </Descriptions.Item>
          )}
          {disputeStatus === DISPUTE_STATUS.APPEALABLE &&
            statusCode !== STATUS_CODE.WAITING_ENFORCEMENT && (
              <Descriptions.Item label="Dispute Status">
                <DisputeStatus disputeStatus={disputeStatus} />
              </Descriptions.Item>
            )}
          {disputed && disputeStatus !== DISPUTE_STATUS.WAITING && (
            <Descriptions.Item label="Ruling">
              <Ruling currentRuling={currentRuling} />
            </Descriptions.Item>
          )}
          {/*
            Period countdowns.
            The code below could be refactored to avoid
            repeating ifs, but it was not done because that requires
            react fragments, which did not play well with the antd
            Descriptions component.
          */}
          {/* Display challenge period countdown, if applicable. */}
          {!disputed && challengeRemainingTime > 0 && (
            <Descriptions.Item label="Challenge period ends in">
              {challengeCountdown}
            </Descriptions.Item>
          )}
          {/* Display appeal countdowns, if applicable. */}
          {/* Indecisive ruling countdown. */}
          {currentRuling === PARTY.NONE &&
            statusCode === STATUS_CODE.CROWDFUNDING && (
              <Descriptions.Item label="Remaining Time">
                {appealCountdown}
              </Descriptions.Item>
            )}
          {/* Decisive ruling winner countdown. */}
          {currentRuling !== PARTY.NONE &&
            (statusCode === STATUS_CODE.CROWDFUNDING ||
              statusCode === STATUS_CODE.CROWDFUNDING_WINNER) && (
              <Descriptions.Item label="Winner Appeal Time">
                {appealCountdown}
              </Descriptions.Item>
            )}
          {/* Decisive ruling loser countdown. */}
          {currentRuling !== PARTY.NONE &&
            statusCode === STATUS_CODE.CROWDFUNDING && (
              <Descriptions.Item label="Loser Appeal Time">
                {appealLoserCountdown}
              </Descriptions.Item>
            )}
        </StyledDescriptions>
      </Card>
      {/* Only render modal if the item status requires it. */}
      {statusCode !== STATUS_CODE.PENDING_SUBMISSION &&
        statusCode !== STATUS_CODE.PENDING_REMOVAL &&
        statusCode !== STATUS_CODE.CHALLENGED && (
          <ItemActionModal
            statusCode={statusCode}
            itemName={metaEvidence ? metaEvidence.itemName : 'item'}
            item={item}
            fileURI={metaEvidence && metaEvidence.fileURI}
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        )}
    </>
  )
}

ItemStatusCard.propTypes = {
  item: itemPropTypes,
  timestamp: BNPropType
}

ItemStatusCard.defaultProps = {
  item: null,
  timestamp: null
}

export default ItemStatusCard