import React, { useContext, useMemo, useState } from 'react'
import { Descriptions, Skeleton, Card, Button, Badge } from 'antd'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import ItemStatusBadge, {
  badgeStatus,
  ItemStatusBadgeWrap,
  ItemStatusIcon
} from 'components/permanent-item-status-badge'
import styled from 'styled-components'
import { ethers } from 'ethers'
import {
  itemToStatusCode,
  STATUS_CODE,
  PARTY,
  CONTRACT_STATUS,
  SUBGRAPH_RULING
} from 'utils/permanent-item-status'
import ETHAddress from 'components/eth-address'
import ItemActionModal from './item-action-modal'
import ItemActionButton from 'components/permanent-item-action-button'
import { WalletContext } from 'contexts/wallet-context'
import { useWeb3Context } from 'web3-react'
import useHumanizedCountdown from 'hooks/countdown'
import useAppealTime from 'hooks/appeal-time'
import ETHAmount from 'components/eth-amount'
// import useNativeCurrency from 'hooks/native-currency'
import { klerosAddresses } from 'config/tcr-addresses'
import WithdrawModal from './modals/withdraw'

export const StyledDescriptions = styled(Descriptions)`
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

export const StyledItemStatusCard = styled(Card)`
  display: flex;
  flex-direction: column;

  .ant-card-head-wrapper {
    flex-wrap: wrap;
    gap: 16px 16px;
    padding: 16px 0;

    .ant-card-head-title {
      overflow: visible;
      padding: 0;
    }
    .ant-card-extra {
      margin-left: 0;
      padding: 0;
    }
  }
`

export const Ruling = ({ currentRuling }) => {
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
  registry,
  timestamp,
  metaEvidence,
  modalOpen,
  setModalOpen,
  appealCost,
  arbitrationCost
}) => {
  const { pushWeb3Action, requestWeb3Auth, networkId } = useContext(
    WalletContext
  )
  const { account } = useWeb3Context()
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)

  // Get remaining appeal time, if any and build countdown.
  const { appealRemainingTime, appealRemainingTimeLoser } = useAppealTime(
    item,
    false
  )
  const appealCountdown = useHumanizedCountdown(appealRemainingTime)
  const appealLoserCountdown = useHumanizedCountdown(appealRemainingTimeLoser)
  const { arbitrator: klerosAddress, uiURL } = klerosAddresses[networkId] || {}
  // Get period until valid, if applicable, and build countdown.
  const validRemainingTime = useMemo(() => {
    if (
      !item ||
      item.status === CONTRACT_STATUS.ABSENT ||
      item.status === CONTRACT_STATUS.DISPUTED ||
      !item.includedAt ||
      !registry.submissionPeriod ||
      !registry.reinclusionPeriod
    )
      return

    const { includedAt, status } = item
    if (status === CONTRACT_STATUS.SUBMITTED) {
      const deadline =
        Number(includedAt) * 1000 + Number(registry.submissionPeriod) * 1000
      return deadline - Date.now()
    } else {
      // status === CONTRACT_STATUS.REINCLUDED
      const deadline =
        Number(includedAt) * 1000 + Number(registry.reinclusionPeriod) * 1000
      return deadline - Date.now()
    }
  }, [registry, item])

  const validCountdown = useHumanizedCountdown(validRemainingTime)
  // Calculate withdrawing remaining time, if applicable, and build countdown.
  const withdrawingRemainingTime = useMemo(() => {
    if (
      !item ||
      item.status === CONTRACT_STATUS.ABSENT ||
      !item.withdrawingTimestamp ||
      item.withdrawingTimestamp === '0' ||
      !registry.withdrawingPeriod
    )
      return

    const deadline =
      Number(item.withdrawingTimestamp) * 1000 +
      Number(registry.withdrawingPeriod) * 1000
    return deadline - Date.now()
  }, [registry, item])

  const withdrawingCountdown = useHumanizedCountdown(withdrawingRemainingTime)

  // const nativeCurrency = useNativeCurrency()

  if (!item || !timestamp || !registry)
    return (
      <Card id="item-status-card">
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      </Card>
    )
  const statusCode = itemToStatusCode(item, timestamp, registry)

  const isWithdrawing =
    statusCode !== STATUS_CODE.REJECTED &&
    statusCode !== STATUS_CODE.REMOVED &&
    item.withdrawingTimestamp !== '0'

  const bounty = item.stake

  // Check if item is withdrawable: not absent and withdrawingTimestamp === "0"
  const isWithdrawable =
    statusCode !== STATUS_CODE.REJECTED &&
    statusCode !== STATUS_CODE.REMOVED &&
    item.withdrawingTimestamp === '0'
  // Check if current user is the submitter
  const isSubmitter =
    account &&
    item.submitter &&
    account.toLowerCase() === item.submitter.toLowerCase()

  const executeRequest = async (_, signer) => {
    const gtcr = new ethers.Contract(registry.id, _gtcr, signer)
    return {
      tx: await gtcr.withdrawItem(item.itemID),
      actionMessage: 'Executing withdrawal'
    }
  }

  const onClick = () => {
    switch (statusCode) {
      case STATUS_CODE.REJECTED:
      case STATUS_CODE.REMOVED:
      case STATUS_CODE.PENDING:
      case STATUS_CODE.ACCEPTED:
      case STATUS_CODE.CROWDFUNDING:
      case STATUS_CODE.CROWDFUNDING_WINNER: {
        requestWeb3Auth(() => setModalOpen(true))
        break
      }
      case STATUS_CODE.PENDING_WITHDRAWAL:
        return pushWeb3Action(executeRequest)
      case STATUS_CODE.DISPUTED:
      case STATUS_CODE.WAITING_ARBITRATOR:
        return null
      default:
        throw new Error(`Unhandled status code ${statusCode}`)
    }
  }
  const challenge = item.challenges[0]
  const arbitrator = registry.arbitrator.id
  const { disputeID } = challenge || {}
  const round = challenge ? challenge.rounds[0] : undefined
  const { metadata } = metaEvidence || {}
  const { itemName } = metadata || {}
  const appealable =
    statusCode === STATUS_CODE.CROWDFUNDING_WINNER ||
    statusCode === STATUS_CODE.CROWDFUNDING
  return (
    <>
      <StyledItemStatusCard
        id="item-status-card"
        title={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ItemStatusBadge
              item={item}
              statusCode={statusCode}
              registry={registry}
              timestamp={timestamp}
              dark
            />
            {isWithdrawing &&
              (statusCode === STATUS_CODE.PENDING ||
                statusCode === STATUS_CODE.ACCEPTED) && (
                <ItemStatusBadgeWrap>
                  <Badge
                    status={badgeStatus(STATUS_CODE.PENDING_WITHDRAWAL)}
                    text="Withdrawing"
                    style={{ color: 'white' }}
                  />
                  <ItemStatusIcon statusCode={STATUS_CODE.PENDING_WITHDRAWAL} />
                </ItemStatusBadgeWrap>
              )}
          </div>
        }
        extra={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isWithdrawable && isSubmitter && (
              <Button type="default" onClick={() => setWithdrawModalOpen(true)}>
                Withdraw
              </Button>
            )}
            <ItemActionButton
              statusCode={statusCode}
              itemName={itemName}
              itemID={item && item.itemID}
              pushWeb3Action={pushWeb3Action}
              onClick={onClick}
              type="secondary"
            />
          </div>
        }
      >
        <StyledDescriptions
          column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}
        >
          {statusCode !== STATUS_CODE.REJECTED &&
            statusCode !== STATUS_CODE.REMOVED && (
              <>
                <Descriptions.Item label="Bounty">
                  <ETHAmount
                    amount={bounty}
                    decimals={3}
                    displayUnit={` sDAI`}
                  />
                </Descriptions.Item>
              </>
            )}
          <Descriptions.Item label="Submitter">
            <ETHAddress address={item.submitter} />
          </Descriptions.Item>
          {challenge &&
            item.status === CONTRACT_STATUS.DISPUTED &&
            Number(disputeID) !== 0 && (
              <>
                <Descriptions.Item label="Challenger">
                  <ETHAddress address={challenge.challenger} />
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
          {item.status === CONTRACT_STATUS.DISPUTED && appealable && (
            <Descriptions.Item label="Current Ruling">
              <Ruling currentRuling={round.ruling} />
            </Descriptions.Item>
          )}
          {/*
            Period countdowns.
            The code below could be refactored to avoid
            repeating ifs, but it was not done because that requires
            react fragments, which did not play well with the antd
            Descriptions component.
          */}
          {/* Display acceptance period countdown, if applicable. */}
          {validRemainingTime && (
            <Descriptions.Item
              label={`Item valid ${
                statusCode === STATUS_CODE.ACCEPTED ? 'since' : 'in'
              }`}
            >
              {validCountdown}
            </Descriptions.Item>
          )}
          {/* Display withdrawing countdown, if applicable and not disputed. */}
          {isWithdrawing &&
            (statusCode === STATUS_CODE.PENDING ||
              statusCode === STATUS_CODE.ACCEPTED) &&
            withdrawingRemainingTime && (
              <Descriptions.Item label="Withdrawal in">
                {withdrawingCountdown}
              </Descriptions.Item>
            )}
          {/* Display appeal countdowns, if applicable. */}
          {/* Indecisive ruling countdown. */}
          {round &&
            round.ruling === SUBGRAPH_RULING.NONE &&
            statusCode === STATUS_CODE.CROWDFUNDING && (
              <Descriptions.Item label="Remaining Time">
                {appealCountdown}
              </Descriptions.Item>
            )}
          {/* Decisive ruling winner countdown. */}
          {round && round.ruling !== SUBGRAPH_RULING.NONE && appealable && (
            <Descriptions.Item label="Winner Appeal Time">
              {appealCountdown}
            </Descriptions.Item>
          )}
          {/* Decisive ruling loser countdown. */}
          {round &&
            round.ruling !== PARTY.NONE &&
            statusCode === STATUS_CODE.CROWDFUNDING && (
              <Descriptions.Item label="Loser Appeal Time">
                {appealLoserCountdown}
              </Descriptions.Item>
            )}
        </StyledDescriptions>
      </StyledItemStatusCard>
      {/* Only render modal if the item status requires it. */}
      {statusCode !== STATUS_CODE.DISPUTED &&
        statusCode !== STATUS_CODE.WAITING_ARBITRATOR && (
          <ItemActionModal
            statusCode={statusCode}
            itemName={itemName || 'item'}
            item={item}
            registry={registry}
            metaEvidence={metaEvidence}
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            appealCost={appealCost}
            arbitrationCost={arbitrationCost}
          />
        )}
      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={withdrawModalOpen}
        onCancel={() => setWithdrawModalOpen(false)}
        item={item}
        registry={registry}
        itemName={itemName || 'item'}
      />
    </>
  )
}

export default ItemStatusCard
