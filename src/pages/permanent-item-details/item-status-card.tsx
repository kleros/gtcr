import React, { useMemo, useState } from 'react'
import { Descriptions, Skeleton, Card, Button, Badge } from 'components/ui'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import ItemStatusBadge, {
  badgeStatus,
  ItemStatusBadgeWrap,
  ItemStatusIcon,
} from 'components/permanent-item-status-badge'
import styled from 'styled-components'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import {
  itemToStatusCode,
  STATUS_CODE,
  PARTY,
  CONTRACT_STATUS,
  SUBGRAPH_RULING,
} from 'utils/permanent-item-status'
import ETHAddress from 'components/eth-address'
import ItemActionModal from './item-action-modal'
import ItemActionButton from 'components/permanent-item-action-button'
import useHumanizedCountdown from 'hooks/countdown'
import useAppealTime from 'hooks/appeal-time'
import ETHAmount from 'components/eth-amount'
import useTokenSymbol from 'hooks/token-symbol'
import { klerosAddresses } from 'config/tcr-addresses'
import { wrapWithToast } from 'utils/wrap-with-toast'
import { wagmiConfig } from 'config/wagmi'
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

  .ui-skeleton-title {
    margin: -3px 0;
  }
`

export const StyledItemStatusCard = styled(Card)`
  display: flex;
  flex-direction: column;

  .ui-card-head {
    background: ${({ theme }) => theme.cardHeaderGradient};
    color: white;
    border-color: ${({ theme }) =>
      theme.name === 'dark' ? theme.borderColor : 'transparent'};
  }

  .ui-card-head-wrapper {
    flex-wrap: wrap;
    gap: 16px 16px;
    padding: 16px 0;

    .ui-card-head-title {
      overflow: visible;
      padding: 0;
      color: white;
    }
    .ui-card-extra {
      margin-left: 0;
      padding: 0;
      color: white;
    }
  }
`

interface RulingProps {
  currentRuling: string | null
}

export const Ruling = ({ currentRuling }: RulingProps) => {
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

interface ItemStatusCardProps {
  item: SubgraphItem
  registry: SubgraphRegistry
  timestamp: BigNumber
  metaEvidence: MetaEvidence
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  appealCost: BigNumber
  arbitrationCost: BigNumber
}

const ItemStatusCard = ({
  item,
  registry,
  timestamp,
  metaEvidence,
  modalOpen,
  setModalOpen,
  appealCost,
  arbitrationCost,
}: ItemStatusCardProps) => {
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const { symbol: tokenSymbol } = useTokenSymbol(registry?.token)

  // Get remaining appeal time, if any and build countdown.
  const { appealRemainingTime, appealRemainingTimeLoser } = useAppealTime(
    item,
    false,
  )
  const appealCountdown = useHumanizedCountdown(appealRemainingTime)
  const appealLoserCountdown = useHumanizedCountdown(appealRemainingTimeLoser)
  const { arbitrator: klerosAddress, uiURL } = klerosAddresses[chainId] || {}
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

  const executeWithdrawal = async () => {
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: registry.id,
        abi: _gtcr,
        functionName: 'withdrawItem',
        args: [item.itemID],
        account,
      })

      await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )
    } catch (err) {
      console.error('Error executing withdrawal:', err)
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
        setModalOpen(true)
        break
      }
      case STATUS_CODE.PENDING_WITHDRAWAL:
        return executeWithdrawal()
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
                    displayUnit={` ${tokenSymbol}`}
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
                  {klerosAddress?.toLowerCase() ===
                  arbitrator?.toLowerCase() ? (
                    <a
                      href={uiURL?.replace(':disputeID', disputeID.toString())}
                    >
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
          {validRemainingTime && (
            <Descriptions.Item
              label={`Item valid ${
                statusCode === STATUS_CODE.ACCEPTED ? 'since' : 'in'
              }`}
            >
              {validCountdown}
            </Descriptions.Item>
          )}
          {isWithdrawing &&
            (statusCode === STATUS_CODE.PENDING ||
              statusCode === STATUS_CODE.ACCEPTED) &&
            withdrawingRemainingTime && (
              <Descriptions.Item label="Withdrawal in">
                {withdrawingCountdown}
              </Descriptions.Item>
            )}
          {round &&
            round.ruling === SUBGRAPH_RULING.NONE &&
            statusCode === STATUS_CODE.CROWDFUNDING && (
              <Descriptions.Item label="Remaining Time">
                {appealCountdown}
              </Descriptions.Item>
            )}
          {round && round.ruling !== SUBGRAPH_RULING.NONE && appealable && (
            <Descriptions.Item label="Winner Appeal Time">
              {appealCountdown}
            </Descriptions.Item>
          )}
          {round &&
            round.ruling !== PARTY.NONE &&
            statusCode === STATUS_CODE.CROWDFUNDING && (
              <Descriptions.Item label="Loser Appeal Time">
                {appealLoserCountdown}
              </Descriptions.Item>
            )}
        </StyledDescriptions>
      </StyledItemStatusCard>
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
