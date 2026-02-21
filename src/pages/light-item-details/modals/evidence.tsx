import React, { useContext } from 'react'
import { Typography, Button } from 'components/ui'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress } from 'viem'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import EnsureAuth from 'components/ensure-auth'
import EvidenceForm from 'components/evidence-form'
import ipfsPublish from 'utils/ipfs-publish'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { TourContext } from 'contexts/tour-context'
import { wrapWithToast } from 'utils/wrapWithToast'
import { wagmiConfig } from 'config/wagmi'
import { StyledModal } from './challenge'

interface EvidenceModalProps {
  item: any
  [key: string]: any
}

const EvidenceModal = ({ item, ...rest }: EvidenceModalProps) => {
  const { tcrAddress } = useContext(LightTCRViewContext)
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { setUserSubscribed } = useContext(TourContext)

  const submitEvidence = async ({ title, description, evidenceAttachment }) => {
    try {
      const evidenceJSON = {
        title: title,
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
        functionName: 'submitEvidence',
        args: [item.itemID, ipfsEvidencePath],
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
                tcrAddr: tcrAddress,
                itemID: item.itemID,
                networkID: chainId
              })
            }
          )
            .then(() => setUserSubscribed(true))
            .catch(err => {
              console.error('Failed to subscribe for notifications.', err)
            })
      }
    } catch (err) {
      console.error('Error submitting evidence:', err)
    }
  }

  const EVIDENCE_FORM_ID = 'submitEvidenceForm'

  return (
    <StyledModal
      footer={[
        <Button key="back" onClick={rest.onCancel}>
          Back
        </Button>,
        <EnsureAuth key="ensure-auth">
          <Button
            key="submitEvidence"
            type="primary"
            form={EVIDENCE_FORM_ID}
            htmlType="submit"
          >
            Submit
          </Button>
        </EnsureAuth>
      ]}
      {...rest}
    >
      <Typography.Title level={4}>Evidence Submission</Typography.Title>
      <EvidenceForm
        onSubmit={submitEvidence}
        formID={EVIDENCE_FORM_ID}
        detailed
      />
    </StyledModal>
  )
}

export default EvidenceModal
