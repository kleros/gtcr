import React, { useState, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import { Modal, Typography, Button, Spin, Tooltip } from 'components/ui'
import Icon from 'components/ui/Icon'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import EnsureAuth from 'components/ensure-auth'
import ETHAmount from 'components/eth-amount'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { erc20Abi, getAddress } from 'viem'
import EvidenceForm from 'components/evidence-form'
import ipfsPublish from 'utils/ipfs-publish'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { parseIpfs } from 'utils/ipfs-parse'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import { wrapWithToast } from 'utils/wrap-with-toast'
import { wagmiConfig } from 'config/wagmi'
import { DepositContainer, DepositRow, DepositLabel } from './submit'

export const StyledSpin = styled(Spin)`
  height: 60px;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
`

export const StyledModal = styled(Modal)`
  & > .ui-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

interface ChallengeModalProps {
  item: SubgraphItem
  itemName?: string
  onCancel: () => void
  arbitrationCost: BigNumber
  [key: string]: unknown
}

const ChallengeModal = ({
  item,
  _itemName,
  onCancel,
  arbitrationCost,
  ...rest
}: ChallengeModalProps) => {
  const registry = item.registry
  const fileURI = registry.arbitrationSettings[0].metadata.policyURI
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const nativeCurrency = useNativeCurrency()

  const [balance, setBalance] = useState(0n)
  const [allowance, setAllowance] = useState(0n)
  const [nativeBalance, setNativeBalance] = useState<BigNumber | undefined>()
  const [checkingToken, setCheckingToken] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isChallenging, setIsChallenging] = useState(false)
  const { symbol: tokenSymbol } = useTokenSymbol(registry.token)

  const challengeStake =
    (BigInt(item.stake) * BigInt(registry.challengeStakeMultiplier)) / 10_000n

  const checkTokenStatus = useCallback(async () => {
    if (!account || !publicClient || !registry.token) return

    setCheckingToken(true)
    try {
      const [bal, allow, nativeBal] = await Promise.all([
        publicClient.readContract({
          address: registry.token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: registry.token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, registry.id],
        }),
        publicClient.getBalance({ address: account }),
      ])
      setBalance(bal)
      setAllowance(allow)
      setNativeBalance(nativeBal)
    } catch (err) {
      console.error('Error checking token status:', err)
    }
    setCheckingToken(false)
  }, [account, publicClient, registry.token, registry.id])

  useEffect(() => {
    checkTokenStatus()
  }, [checkTokenStatus])

  // Reset loading states when modal is closed
  useEffect(
    () => () => {
      setIsApproving(false)
      setIsChallenging(false)
    },
    [],
  )

  const handleApprove = useCallback(async () => {
    setIsApproving(true)
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: registry.token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [registry.id, challengeStake],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) {
        await checkTokenStatus()
        setTimeout(async () => {
          await checkTokenStatus()
        }, 5000)
      }
    } catch (err) {
      console.error('Error approving token:', err)
    }
    setIsApproving(false)
  }, [
    registry.token,
    registry.id,
    challengeStake,
    checkTokenStatus,
    account,
    walletClient,
    publicClient,
  ])

  const challengeRequest = async ({
    title,
    description,
    evidenceAttachment,
  }) => {
    setIsChallenging(true)
    try {
      const evidenceJSON = {
        title: title || 'Challenge Justification',
        description,
        ...evidenceAttachment,
      }

      const enc = new TextEncoder()
      const fileData = enc.encode(JSON.stringify(evidenceJSON))
      const ipfsEvidencePath = getIPFSPath(
        await ipfsPublish('evidence.json', fileData),
      )

      const { request } = await simulateContract(wagmiConfig, {
        address: registry.id,
        abi: _gtcr,
        functionName: 'challengeItem',
        args: [item.itemID, ipfsEvidencePath],
        value: BigInt(arbitrationCost.toString()),
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) {
        onCancel()

        if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!chainId)
          fetch(
            `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${chainId}/api/subscribe`,
            {
              method: 'post',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscriberAddr: getAddress(account),
                tcrAddr: getAddress(registry.id),
                itemID: item.itemID,
                networkID: chainId,
              }),
            },
          ).catch((err) => {
            console.error('Failed to subscribe for notifications.', err)
          })
      }
    } catch (err) {
      console.error('Error challenging item:', err)
    }
    setIsChallenging(false)
  }

  const hasEnoughBalance = balance >= challengeStake
  const hasEnoughAllowance = allowance >= challengeStake
  const hasEnoughNativeBalance =
    nativeBalance != null &&
    nativeBalance >= BigInt((arbitrationCost || 0).toString())

  const renderChallengeButton = () => {
    if (checkingToken)
      return (
        <Button key="checking" loading>
          Checking Token...
        </Button>
      )

    if (!hasEnoughBalance)
      return (
        <Button key="insufficient" disabled>
          Insufficient {tokenSymbol} Balance
        </Button>
      )

    if (!hasEnoughNativeBalance)
      return (
        <Button key="insufficientNative" disabled>
          Not enough {nativeCurrency}
        </Button>
      )

    if (!hasEnoughAllowance)
      return (
        <Button
          key="approve"
          type="primary"
          onClick={handleApprove}
          loading={isApproving}
        >
          Approve {tokenSymbol}
        </Button>
      )

    return (
      <Button
        key="challengeSubmit"
        type="primary"
        form={EVIDENCE_FORM_ID}
        htmlType="submit"
        loading={isChallenging}
      >
        Challenge
      </Button>
    )
  }

  const EVIDENCE_FORM_ID = 'challengeEvidenceForm'
  if (!arbitrationCost)
    return (
      <StyledModal title="Submit Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  return (
    <StyledModal
      title="Challenge Item"
      onCancel={() => {
        setIsApproving(false)
        setIsChallenging(false)
        onCancel()
      }}
      footer={[
        <Button
          key="back"
          onClick={() => {
            setIsApproving(false)
            setIsChallenging(false)
            onCancel()
          }}
        >
          Back
        </Button>,
        <EnsureAuth key="ensure-auth">{renderChallengeButton()}</EnsureAuth>,
      ]}
      {...rest}
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
      <Typography.Paragraph>
        Explain to jurors why do you think this item should be removed:
      </Typography.Paragraph>
      <EvidenceForm onSubmit={challengeRequest} formID={EVIDENCE_FORM_ID} />
      <Typography.Paragraph>
        To challenge this item, deposits are required. These values will be
        awarded to the party that wins the dispute.
      </Typography.Paragraph>
      <DepositContainer>
        <DepositRow>
          <DepositLabel>
            Challenge Stake Deposit
            <Tooltip title="The challenge stake deposit paid in tokens required to challenge this item.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </DepositLabel>
          <ETHAmount
            decimals={3}
            amount={challengeStake.toString()}
            displayUnit={` ${tokenSymbol}`}
          />
        </DepositRow>
        <DepositRow>
          <DepositLabel>
            Arbitration Cost
            <Tooltip title="The arbitration cost paid in native currency to cover potential disputes.">
              <Icon type="question-circle-o" />
            </Tooltip>
          </DepositLabel>
          <ETHAmount
            decimals={3}
            amount={arbitrationCost.toString()}
            displayUnit={` ${nativeCurrency}`}
          />
        </DepositRow>
      </DepositContainer>
      <DepositRow style={{ marginTop: 8 }}>
        <DepositLabel>Total deposit</DepositLabel>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <ETHAmount
            decimals={3}
            amount={challengeStake.toString()}
            displayUnit={` ${tokenSymbol}`}
          />
          <span style={{ margin: '0 6px' }}>+</span>
          <ETHAmount
            decimals={3}
            amount={arbitrationCost.toString()}
            displayUnit={` ${nativeCurrency}`}
          />
        </span>
      </DepositRow>
    </StyledModal>
  )
}

export default ChallengeModal
