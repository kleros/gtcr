import React, { useState, useContext, useMemo } from 'react'
import {
  Descriptions,
  Button,
  Row,
  Col,
  Slider,
  InputNumber,
  Typography,
  Divider,
} from 'components/ui'
import { STATUS_CODE, PARTY, SUBGRAPH_RULING } from 'utils/item-status'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import { ethers, BigNumber } from 'ethers'

const { formatEther, parseEther } = ethers.utils
import EnsureAuth from 'components/ensure-auth'
import ETHAmount from 'components/eth-amount'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress } from 'viem'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import useRequiredFees from 'hooks/required-fees'
import useNativeCurrency from 'hooks/native-currency'
import { parseIpfs } from 'utils/ipfs-parse'
import { wrapWithToast } from 'utils/wrap-with-toast'
import { wagmiConfig } from 'config/wagmi'
import { StyledSpin, StyledModal } from './challenge'

interface CrowdfundModalProps {
  statusCode: number
  item: SubgraphItem
  fileURI?: string
  appealCost: BigNumber
  [key: string]: unknown
}

const CrowdfundModal = ({
  statusCode,
  item,
  fileURI,
  appealCost,
  ...rest
}: CrowdfundModalProps) => {
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const {
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    MULTIPLIER_DIVISOR,
    tcrAddress,
  } = useContext(LightTCRViewContext)

  const [contributionShare, setContributionShare] = useState(1)
  const [userSelectedSide, setUserSelectedSide] = useState<number | undefined>()
  const nativeCurrency = useNativeCurrency()

  const round = item.requests[0].rounds[0]
  const {
    hasPaidRequester,
    hasPaidChallenger,
    currentRuling,
    ruling,
    amountPaidRequester,
    amountPaidChallenger,
  } = round

  const winner =
    ruling === SUBGRAPH_RULING.ACCEPT ? PARTY.REQUESTER : PARTY.CHALLENGER

  const autoSelectedSide = useMemo(() => {
    if (
      currentRuling === PARTY.NONE ||
      (hasPaidRequester && hasPaidChallenger) ||
      (!hasPaidRequester && !hasPaidChallenger)
    )
      return PARTY.NONE

    if (statusCode === STATUS_CODE.CROWDFUNDING_WINNER) return winner

    return !hasPaidRequester ? PARTY.REQUESTER : PARTY.CHALLENGER
  }, [currentRuling, hasPaidRequester, hasPaidChallenger, statusCode, winner])

  const side = useMemo(
    () => userSelectedSide || autoSelectedSide,
    [autoSelectedSide, userSelectedSide],
  )

  const { requiredForSide, amountStillRequired, potentialReward } =
    useRequiredFees({
      side,
      sharedStakeMultiplier,
      winnerStakeMultiplier,
      loserStakeMultiplier,
      currentRuling,
      item,
      MULTIPLIER_DIVISOR,
      appealCost,
    })

  if (!sharedStakeMultiplier || !potentialReward)
    return (
      <StyledModal title="Crowdfund Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  if (
    (currentRuling === SUBGRAPH_RULING.NONE ||
      statusCode === STATUS_CODE.CROWDFUNDING) &&
    side === PARTY.NONE
  )
    return (
      <StyledModal
        title="Contribute Fees"
        footer={[
          <Button
            key="submitter"
            type="primary"
            onClick={() => setUserSelectedSide(PARTY.REQUESTER)}
          >
            Submitter
          </Button>,
          <Button
            key="challenger"
            type="primary"
            onClick={() => setUserSelectedSide(PARTY.CHALLENGER)}
          >
            Challenger
          </Button>,
        ]}
        {...rest}
      >
        Which side do you want to fund?
      </StyledModal>
    )

  const crowdfundSide = async () => {
    try {
      const contribution = amountStillRequired
        .mul(
          BigNumber.from(
            (contributionShare * MULTIPLIER_DIVISOR.toString()).toString(),
          ),
        )
        .div(MULTIPLIER_DIVISOR)

      const { request } = await simulateContract(wagmiConfig, {
        address: tcrAddress,
        abi: _gtcr,
        functionName: 'fundAppeal',
        args: [item.itemID, side],
        value: BigInt(contribution.toString()),
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) {
        rest.onCancel()

        if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!chainId)
          fetch(
            `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${chainId}/api/subscribe`,
            {
              method: 'post',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscriberAddr: getAddress(account),
                tcrAddr: getAddress(tcrAddress),
                itemID: item.itemID,
                networkID: chainId,
              }),
            },
          ).catch((err) => {
            console.error('Failed to subscribe for notifications.', err)
          })
      }
    } catch (err) {
      console.error('Error funding appeal:', err)
    }
  }

  const amountPaid = side === 1 ? amountPaidRequester : amountPaidChallenger

  return (
    <StyledModal
      {...rest}
      title={`Contribute Fees to ${
        side === PARTY.REQUESTER ? 'Submitter' : 'Challenger'
      }`}
      footer={[
        <Button key="back" onClick={rest.onCancel}>
          Back
        </Button>,
        <EnsureAuth key="ensure-auth">
          <Button key="contribute" type="primary" onClick={crowdfundSide}>
            OK
          </Button>
        </EnsureAuth>,
      ]}
      afterClose={() => {
        setUserSelectedSide(PARTY.NONE)
        setContributionShare(1)
      }}
    >
      <Typography.Title level={4}>
        Read the&nbsp;
        <a
          href={parseIpfs(fileURI || '')}
          target="_blank"
          rel="noopener noreferrer"
        >
          Listing Criteria
        </a>
        .
      </Typography.Title>
      <Typography.Paragraph level={4}>
        Contribute {nativeCurrency} for a chance to win at most{' '}
        <ETHAmount
          decimals={4}
          amount={potentialReward
            .mul(BigNumber.from(Math.ceil(contributionShare * 10000) || 1))
            .div(10000)}
          displayUnit={` ${nativeCurrency}`}
        />
        . You will earn up to this amount if the side you choose wins the next
        round of the dispute.
      </Typography.Paragraph>
      <Typography.Paragraph>
        How much {nativeCurrency} do you want to contribute?
      </Typography.Paragraph>
      <Row>
        <Col span={16}>
          <Slider
            min={0}
            max={1}
            step={0.001}
            onChange={(value) => setContributionShare(value)}
            value={contributionShare}
            tooltipVisible={false}
          />
        </Col>
        <Col span={8}>
          <InputNumber
            min={0}
            max={formatEther(amountStillRequired)}
            step={0.01}
            style={{ marginLeft: 16 }}
            value={
              amountStillRequired
                ? contributionShare * formatEther(amountStillRequired)
                : contributionShare
            }
            onChange={(value) => {
              const weiAmount = parseEther(String(value))
              const shareInBasis = weiAmount
                .mul(MULTIPLIER_DIVISOR)
                .div(amountStillRequired)
              setContributionShare(shareInBasis.toNumber() / MULTIPLIER_DIVISOR)
            }}
          />{' '}
          {nativeCurrency}
        </Col>
      </Row>
      <Divider />
      <Descriptions bordered column={1}>
        <Descriptions.Item label="Total Required:">
          <ETHAmount
            decimals={4}
            amount={requiredForSide}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Amount Paid:">
          <ETHAmount
            decimals={4}
            amount={amountPaid}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

export default CrowdfundModal
