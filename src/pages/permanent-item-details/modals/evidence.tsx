import React, { useState } from 'react'
import { Typography, Button } from 'components/ui'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import EnsureAuth from 'components/ensure-auth'
import EvidenceForm from 'components/evidence-form'
import { Roles, useAtlasProvider } from '@kleros/kleros-app'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
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
  const { uploadFile } = useAtlasProvider()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitEvidence = async ({ title, description, evidenceAttachment }) => {
    setIsSubmitting(true)
    try {
      const attachmentFields: Record<string, string> = {}
      if (evidenceAttachment) {
        const fileURI = await uploadFile(
          evidenceAttachment as File,
          Roles.Evidence,
        )
        if (!fileURI) throw new Error('Failed to upload attachment to IPFS.')
        attachmentFields.fileURI = fileURI
        attachmentFields.fileTypeExtension = (
          evidenceAttachment as File
        ).name.split('.')[1]
        attachmentFields.type = (evidenceAttachment as File).type
      }

      const evidenceJSON = {
        title: title,
        description,
        ...attachmentFields,
      }

      const evidenceFile = new File(
        [JSON.stringify(evidenceJSON)],
        'evidence.json',
        { type: 'application/json' },
      )
      const ipfsEvidencePath = await uploadFile(evidenceFile, JSON_UPLOAD_ROLE)
      if (!ipfsEvidencePath)
        throw new Error('Failed to upload evidence to IPFS.')

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
      errorToast(parseWagmiError(err))
    }
    setIsSubmitting(false)
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
            loading={isSubmitting}
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
