import React, { useContext } from 'react'
import styled from 'styled-components'
import { Modal, Descriptions, Typography, Button, Spin } from 'components/ui'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress } from 'viem'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { STATUS_CODE, CONTRACT_STATUS } from 'utils/item-status'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import EnsureAuth from 'components/ensure-auth'
import ETHAmount from 'components/eth-amount'
import EvidenceForm from 'components/evidence-form'
import ipfsPublish from 'utils/ipfs-publish'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { parseIpfs } from 'utils/ipfs-parse'
import { wrapWithToast } from 'utils/wrapWithToast'
import { wagmiConfig } from 'config/wagmi'

export const StyledSpin = styled(Spin)`
  height: 60px;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
`

export const StyledModal = styled(Modal)``

interface ChallengeModalProps {
  item: SubgraphItem
  itemName?: string
  statusCode?: number
  fileURI?: string
  [key: string]: unknown
}

const ChallengeModal = ({ item, itemName, statusCode, fileURI, ...rest }: ChallengeModalProps) => {
  const {
    submissionChallengeDeposit,
    removalChallengeDeposit,
    tcrAddress
  } = useContext(LightTCRViewContext)
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
    evidenceAttachment
  }) => {
    try {
      const evidenceJSON = {
        title: title || 'Challenge Justification',
        description,
        ...evidenceAttachment
      }

      const enc = new TextEncoder()
      const fileData = enc.encode(JSON.stringify(evidenceJSON))
      const ipfsEvidencePath = getIPFSPath(
        await ipfsPublish('evidence.json', fileData)
      )

      const { request } = await simulateContract(wagmiConfig, {
        address: tcrAddress,
        abi: _gtcr,
        functionName: 'challengeRequest',
        args: [item.itemID, ipfsEvidencePath],
        value: BigInt(challengeDeposit.toString()),
        account
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient
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
                networkID: chainId
              })
            }
          )
            .catch(err => {
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
        </EnsureAuth>
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
