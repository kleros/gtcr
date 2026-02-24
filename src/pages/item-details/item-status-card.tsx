import React, { useContext, useMemo } from 'react'
import { Descriptions, Skeleton, Card } from 'components/ui'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import ItemStatusBadge from 'components/item-status-badge'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import {
  itemToStatusCode,
  STATUS_CODE,
  CONTRACT_STATUS,
  SUBGRAPH_RULING,
} from 'utils/item-status'
import ETHAddress from 'components/eth-address'
import ItemActionModal from './item-action-modal'
import ItemActionButton from 'components/item-action-button'
import { TCRViewContext } from 'contexts/tcr-view-context'
import useHumanizedCountdown from 'hooks/countdown'
import useAppealTime from 'hooks/appeal-time'
import ETHAmount from 'components/eth-amount'
import useNativeCurrency from 'hooks/native-currency'
import { klerosAddresses } from 'config/tcr-addresses'
import { wrapWithToast } from 'utils/wrap-with-toast'
import { wagmiConfig } from 'config/wagmi'
import {
  StyledItemStatusCard,
  StyledDescriptions,
  Ruling,
} from 'pages/light-item-details/item-status-card'

interface ItemStatusCardProps {
  item: SubgraphItem
  timestamp: BigNumber
  request: SubgraphRequest
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  appealCost: BigNumber
}

const ItemStatusCard = ({
  item,
  timestamp,
  request,
  modalOpen,
  setModalOpen,
  appealCost,
}: ItemStatusCardProps) => {
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const {
    metaEvidence,
    challengePeriodDuration,
    tcrAddress,
    submissionDeposit,
    gtcrView,
  } = useContext(TCRViewContext)

  // Get remaining appeal time, if any and build countdown.
  const { appealRemainingTime, appealRemainingTimeLoser } = useAppealTime(item)
  const appealCountdown = useHumanizedCountdown(appealRemainingTime)
  const appealLoserCountdown = useHumanizedCountdown(appealRemainingTimeLoser)
  const { arbitrator: klerosAddress, uiURL } = klerosAddresses[chainId] || {}

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
  const { disputed } = item
  const statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  const bounty = request.deposit

  const executeRequest = async () => {
    try {
      const { request: req } = await simulateContract(wagmiConfig, {
        address: tcrAddress,
        abi: _gtcr,
        functionName: 'executeRequest',
        args: [item.itemID],
        account,
      })

      await wrapWithToast(() => walletClient.writeContract(req), publicClient)
    } catch (err) {
      console.error('Error executing request:', err)
    }
  }

  const onClick = () => {
    switch (statusCode) {
      case STATUS_CODE.REJECTED:
      case STATUS_CODE.REMOVED:
      case STATUS_CODE.REGISTERED:
      case STATUS_CODE.SUBMITTED:
      case STATUS_CODE.REMOVAL_REQUESTED:
      case STATUS_CODE.CROWDFUNDING:
      case STATUS_CODE.CROWDFUNDING_WINNER: {
        setModalOpen(true)
        break
      }
      case STATUS_CODE.PENDING_SUBMISSION:
      case STATUS_CODE.PENDING_REMOVAL:
        return executeRequest()
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
      <StyledItemStatusCard
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
            itemID={item?.itemID}
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
          {disputed && disputeID.toNumber() !== 0 && (
            <>
              <Descriptions.Item label="Challenger">
                <ETHAddress address={request.challenger} />
              </Descriptions.Item>
              <Descriptions.Item label="Dispute ID">
                {klerosAddress?.toLowerCase() === arbitrator?.toLowerCase() ? (
                  <a href={uiURL?.replace(':disputeID', disputeID.toString())}>
                    {disputeID.toString()}
                  </a>
                ) : (
                  disputeID.toString()
                )}
                <Descriptions.Item label="Arbitrator">
                  <ETHAddress address={arbitrator} />
                </Descriptions.Item>
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
          {!disputed && challengeRemainingTime > 0 && (
            <Descriptions.Item label="Challenge period ends">
              {challengeCountdown}
            </Descriptions.Item>
          )}
          {currentRuling === SUBGRAPH_RULING.NONE &&
            statusCode === STATUS_CODE.CROWDFUNDING && (
              <Descriptions.Item label="Remaining Time">
                {appealCountdown}
              </Descriptions.Item>
            )}
          {currentRuling !== SUBGRAPH_RULING.NONE && appealable && (
            <Descriptions.Item label="Winner Appeal Time">
              {appealCountdown}
            </Descriptions.Item>
          )}
          {currentRuling !== SUBGRAPH_RULING.NONE &&
            statusCode === STATUS_CODE.CROWDFUNDING && (
              <Descriptions.Item label="Loser Appeal Time">
                {appealLoserCountdown}
              </Descriptions.Item>
            )}
        </StyledDescriptions>
      </StyledItemStatusCard>
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

export default ItemStatusCard
