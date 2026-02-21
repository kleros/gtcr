import React from 'react'
import { Typography, Button } from 'components/ui'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import EnsureAuth from 'components/ensure-auth'
import EvidenceForm from 'components/evidence-form'
import ipfsPublish from 'utils/ipfs-publish'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { wrapWithToast } from 'utils/wrap-with-toast'
import { wagmiConfig } from 'config/wagmi'
import { StyledModal } from './challenge'

interface EvidenceModalProps {
  item: SubgraphItem
  [key: string]: unknown
}

const EvidenceModal = ({ item, ...rest }: EvidenceModalProps) => {
  const tcrAddress = item?.registry?.id
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const submitEvidence = async ({ title, description, evidenceAttachment }) => {
    try {
      const evidenceJSON = {
        title: title,
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
        functionName: 'submitEvidence',
        args: [item.itemID, ipfsEvidencePath],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) rest.onCancel()
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
        </EnsureAuth>,
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
