import React, { useContext, useCallback, useState } from 'react'
import { Descriptions, Typography, Divider, Button } from 'components/ui'
import humanizeDuration from 'humanize-duration'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress } from 'viem'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { TCRViewContext } from 'contexts/tcr-view-context'
import EnsureAuth from 'components/ensure-auth'
import ETHAmount from 'components/eth-amount'
import EvidenceForm from 'components/evidence-form'
import useNativeCurrency from 'hooks/native-currency'
import useNativeBalance from 'hooks/use-native-balance'
import ipfsPublish from 'utils/ipfs-publish'
import { parseIpfs } from 'utils/ipfs-parse'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { StyledAlert } from 'pages/light-item-details/modals/remove'
import {
  StyledSpin,
  StyledModal,
  InsufficientBalanceText,
} from 'pages/light-item-details/modals/challenge'

interface RemoveModalProps {
  item: SubgraphItem
  itemName?: string
  fileURI?: string
  [key: string]: unknown
}

const RemoveModal = ({
  item,
  _itemName = 'item',
  fileURI,
  ...rest
}: RemoveModalProps) => {
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { removalDeposit, tcrAddress, metaEvidence, challengePeriodDuration } =
    useContext(TCRViewContext)
  const nativeCurrency = useNativeCurrency()
  const { balance: nativeBalance } = useNativeBalance()
  const insufficientBalance =
    nativeBalance !== undefined &&
    removalDeposit &&
    nativeBalance < BigInt(removalDeposit.toString())

  const { metadata } = metaEvidence || {}
  const { requireRemovalEvidence } = metadata || {}

  const [isSubmitting, setIsSubmitting] = useState(false)

  const removeItem = useCallback(
    async ({ title, description, evidenceAttachment } = {}) => {
      setIsSubmitting(true)
      try {
        let ipfsEvidencePath = ''
        if (metadata && requireRemovalEvidence) {
          const evidenceJSON = {
            title: title || 'Removal Justification',
            description,
            ...evidenceAttachment,
          }

          const enc = new TextEncoder()
          const fileData = enc.encode(JSON.stringify(evidenceJSON))
          ipfsEvidencePath = getIPFSPath(
            await ipfsPublish('evidence.json', fileData),
          )
        }

        const { request } = await simulateContract(wagmiConfig, {
          address: tcrAddress,
          abi: _gtcr,
          functionName: 'removeItem',
          args: [item.itemID, ipfsEvidencePath],
          value: BigInt(removalDeposit.toString()),
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
        console.error('Error removing item:', err)
        errorToast(parseWagmiError(err))
      }
      setIsSubmitting(false)
    },
    [
      account,
      chainId,
      item.itemID,
      metadata,
      publicClient,
      removalDeposit,
      requireRemovalEvidence,
      rest,
      tcrAddress,
      walletClient,
    ],
  )

  if (!removalDeposit)
    return (
      <StyledModal title="Remove Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  const EVIDENCE_FORM_ID = 'removeEvidenceForm'

  return (
    <StyledModal
      footer={[
        <Button key="back" onClick={rest.onCancel}>
          Back
        </Button>,
        <EnsureAuth key="ensure-auth">
          <div>
            <Button
              key="challengeSubmit"
              type="primary"
              form={EVIDENCE_FORM_ID}
              htmlType="submit"
              disabled={!!insufficientBalance}
              onClick={metadata && !requireRemovalEvidence ? removeItem : null}
              loading={isSubmitting}
            >
              Send
            </Button>
            {insufficientBalance && (
              <InsufficientBalanceText>
                Insufficient balance
              </InsufficientBalanceText>
            )}
          </div>
        </EnsureAuth>,
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
      {metadata && requireRemovalEvidence && (
        <Typography.Paragraph>
          Explain to jurors why do you think this item should be removed.
        </Typography.Paragraph>
      )}
      {metadata && requireRemovalEvidence && (
        <EvidenceForm onSubmit={removeItem} formID={EVIDENCE_FORM_ID} />
      )}
      <StyledAlert
        message={`Note that this is a deposit, not a fee and it will be reimbursed if the removal is accepted. ${
          challengePeriodDuration &&
          `The challenge period lasts ${humanizeDuration(
            `${challengePeriodDuration.toNumber() * 1000}.`,
          )}`
        }.`}
        type="info"
        showIcon
      />
      <Divider />
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item label="Total Deposit Required">
          <ETHAmount
            decimals={3}
            amount={removalDeposit.toString()}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

export default RemoveModal
