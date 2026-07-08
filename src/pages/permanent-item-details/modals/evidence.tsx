import React, { useState } from 'react'
import type { Address } from 'viem'
import { Typography, Button } from 'components/ui'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import EnsureAuth from 'components/ensure-auth'
import EvidenceForm, { EvidenceFormValues } from 'components/evidence-form'
import { useAtlasProvider } from '@kleros/kleros-app'
import { uploadEvidence } from 'utils/upload-evidence'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { StyledModal } from './challenge'

interface EvidenceModalProps {
  item: SubgraphItem
  visible?: boolean
  onCancel: () => void
}

const EvidenceModal = ({ item, ...rest }: EvidenceModalProps) => {
  const tcrAddress = (item?.registry as { id?: Address } | undefined)?.id
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitEvidence = async ({
    title,
    description,
    evidenceAttachment,
  }: EvidenceFormValues) => {
    if (!tcrAddress || !walletClient || !publicClient) return
    setIsSubmitting(true)
    try {
      const ipfsEvidencePath = await uploadEvidence({
        title: title ?? '',
        description: description ?? '',
        attachment: evidenceAttachment,
        uploadFile,
      })

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
