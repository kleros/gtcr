import React, { useContext, useMemo } from 'react'
import { Descriptions, Skeleton, Card } from 'antd'
import PropTypes from 'prop-types'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import ItemStatusBadge from 'components/item-status-badge'
import styled from 'styled-components/macro'
import { ethers } from 'ethers'
import {
  itemToStatusCode,
  STATUS_CODE,
  PARTY,
  CONTRACT_STATUS,
  SUBGRAPH_RULING
} from 'utils/item-status'
import itemPropTypes from 'prop-types/item'
import ETHAddress from 'components/eth-address'
import ItemActionModal from './item-action-modal'
import ItemActionButton from 'components/item-action-button'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import { WalletContext } from 'contexts/wallet-context'
import BNPropType from 'prop-types/bn'
import useHumanizedCountdown from 'hooks/countdown'
import useAppealTime from 'hooks/appeal-time'
import ETHAmount from 'components/eth-amount'
import useNativeCurrency from 'hooks/native-currency'
import { klerosAddresses } from 'config/tcr-addresses'

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

const Ruling = ({ currentRuling }) => {
  if (currentRuling == null)
    return (
      <StyledSkeleton active paragraph={false} title={SkeletonTitleProps} />
    )

  switch (currentRuling) {
    case 'None':
      return 'The arbitrator refused to rule.'
    case 'Accept':
      return 'The arbitrator ruled in favor of the requester.'
    case 'Reject':
      return 'The arbitrator ruled in favor of the challenger.'
    default:
      throw new Error(`Unhandled ruling ${currentRuling}`)
  }
}

const ItemStatusCard = ({
  item,
  timestamp,
  request,
  modalOpen,
  setModalOpen,
  appealCost
}) => {
  const { pushWeb3Action, requestWeb3Auth, networkId } = useContext(
    WalletContext
  )
  const {
    metaEvidence,
    challengePeriodDuration,
    tcrAddress,
    submissionDeposit,
    gtcrView
  } = useContext(LightTCRViewContext)

  // Get remaining appeal time, if any and build countdown.
  const { appealRemainingTime, appealRemainingTimeLoser } = useAppealTime(item)
  const appealCountdown = useHumanizedCountdown(appealRemainingTime)
  const appealLoserCountdown = useHumanizedCountdown(appealRemainingTimeLoser)
  const { arbitrator: klerosAddress, uiURL } = klerosAddresses[networkId] || {}

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
  const nativeCurrency = useNativeCurrency()

  if (!item || !timestamp || !challengePeriodDuration || !request)
    return (
      <Card id="item-status-card">
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      </Card>
    )

  const currentRuling = item.requests[0].rounds[0].ruling
  const { disputed } = request
  const statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  const bounty = request.deposit

  const executeRequest = async (_, signer) => {
    const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
    return {
      tx: await gtcr.executeRequest(item.itemID),
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

  const { disputeID, arbitrator, resolved } = request || {}
  const { metadata, fileURI } = metaEvidence || {}
  const { itemName } = metadata || {}

  const appealable =
    statusCode === STATUS_CODE.CROWDFUNDING_WINNER ||
    statusCode === STATUS_CODE.CROWDFUNDING
  return (
    <>
      <Card
        id="item-status-card"
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
            itemName={itemName}
            itemID={item && item.itemID}
            pushWeb3Action={pushWeb3Action}
            onClick={onClick}
            type="secondary"
          />
        }
      >
        <StyledDescriptions
          column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}
        >
          {(statusCode === STATUS_CODE.SUBMITTED ||
            statusCode === STATUS_CODE.REMOVAL_REQUESTED) && (
            <>
              <Descriptions.Item label="Bounty">
                <ETHAmount
                  amount={bounty}
                  decimals={3}
                  displayUnit={` ${nativeCurrency}`}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Request Type">
                {item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED
                  ? `Submission`
                  : `Removal`}
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="Requester">
            <ETHAddress address={request.requester} />
          </Descriptions.Item>
          {disputed && Number(disputeID) !== 0 && (
            <>
              <Descriptions.Item label="Challenger">
                <ETHAddress address={request.challenger} />
              </Descriptions.Item>
              <Descriptions.Item label="Dispute ID">
                {klerosAddress.toLowerCase() === arbitrator.toLowerCase() ? (
                  <a href={uiURL.replace(':disputeID', disputeID.toString())}>
                    {disputeID.toString()}
                  </a>
                ) : (
                  disputeID.toString()
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Arbitrator">
                <ETHAddress address={arbitrator} />
              </Descriptions.Item>
            </>
          )}
          {appealable && (
            <Descriptions.Item label="Dispute Status">
              Appealable
            </Descriptions.Item>
          )}
          {disputed && (resolved || appealable) && (
            <Descriptions.Item label={appealable ? 'Current Ruling' : 'Ruling'}>
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
            <Descriptions.Item label="Challenge period ends">
              {challengeCountdown}
            </Descriptions.Item>
          )}
          {/* Display appeal countdowns, if applicable. */}
          {/* Indecisive ruling countdown. */}
          {currentRuling === SUBGRAPH_RULING.NONE &&
            statusCode === STATUS_CODE.CROWDFUNDING && (
              <Descriptions.Item label="Remaining Time">
                {appealCountdown}
              </Descriptions.Item>
            )}
          {/* Decisive ruling winner countdown. */}
          {currentRuling !== SUBGRAPH_RULING.NONE && appealable && (
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
            itemName={itemName || 'item'}
            item={item}
            fileURI={fileURI}
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            submissionDeposit={submissionDeposit}
            tcrAddress={tcrAddress}
            metaEvidence={metaEvidence}
            challengePeriodDuration={challengePeriodDuration}
            gtcrView={gtcrView}
            appealCost={appealCost}
          />
        )}
    </>
  )
}

ItemStatusCard.propTypes = {
  item: itemPropTypes,
  timestamp: BNPropType,
  request: PropTypes.shape({
    disputeID: BNPropType.isRequired,
    arbitrator: PropTypes.string.isRequired
  }),
  modalOpen: PropTypes.bool,
  setModalOpen: PropTypes.func.isRequired
}

ItemStatusCard.defaultProps = {
  item: null,
  timestamp: null,
  request: null,
  modalOpen: null
}

export default ItemStatusCard
