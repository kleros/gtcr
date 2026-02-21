import React, { useContext } from 'react'
import { Descriptions, Typography, Button } from 'components/ui'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress } from 'viem'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { TCRViewContext } from 'contexts/tcr-view-context'
import EnsureAuth from 'components/ensure-auth'
import ETHAmount from 'components/eth-amount'
import EvidenceForm from 'components/evidence-form'
import { CONTRACT_STATUS, STATUS_CODE } from 'utils/item-status'
import ipfsPublish from 'utils/ipfs-publish'
import { parseIpfs } from 'utils/ipfs-parse'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { wrapWithToast } from 'utils/wrap-with-toast'
import { wagmiConfig } from 'config/wagmi'
import {
  StyledSpin,
  StyledModal,
} from 'pages/light-item-details/modals/challenge'

interface ChallengeModalProps {
  item: SubgraphItem
  itemName?: string
  statusCode?: number
  fileURI?: string
  [key: string]: unknown
}

const ChallengeModal = ({
  item,
  _itemName,
  statusCode,
  fileURI,
  ...rest
}: ChallengeModalProps) => {
  const { submissionChallengeDeposit, removalChallengeDeposit, tcrAddress } =
    useContext(TCRViewContext)
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const challengeDeposit =
    item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED
      ? submissionChallengeDeposit
      : removalChallengeDeposit

  const challengeRequest = async ({
    title,
    description,
    evidenceAttachment,
  }) => {
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
        address: tcrAddress,
        abi: _gtcr,
        functionName: 'challengeRequest',
        args: [item.itemID, ipfsEvidencePath],
        value: BigInt(challengeDeposit.toString()),
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
      console.error('Error challenging request:', err)
    }
  }

  const EVIDENCE_FORM_ID = 'challengeEvidenceForm'

  if (!challengeDeposit)
    return (
      <StyledModal title="Submit Item" {...rest}>
        <StyledSpin />
      </StyledModal>
    )

  return (
    <StyledModal
      footer={[
        <Button key="back" onClick={rest.onCancel}>
          Back
        </Button>,
        <EnsureAuth key="ensure-auth">
          <Button
            key="challengeSubmit"
            type="primary"
            form={EVIDENCE_FORM_ID}
            htmlType="submit"
          >
            Challenge
          </Button>
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
      <Typography.Paragraph>
        Explain to jurors why do you think this{' '}
        {statusCode === STATUS_CODE.SUBMITTED
          ? 'submission '
          : 'removal request '}
        should be removed:
      </Typography.Paragraph>
      <EvidenceForm onSubmit={challengeRequest} formID={EVIDENCE_FORM_ID} />
      <Typography.Paragraph>
        To challenge a{' '}
        {statusCode === STATUS_CODE.SUBMITTED
          ? 'submission'
          : 'removal request'}
        , a deposit is required. This value will be awarded to the party that
        wins the dispute.
      </Typography.Paragraph>
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item label="Total Deposit Required">
          <ETHAmount decimals={3} amount={challengeDeposit.toString()} />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

export default ChallengeModal
