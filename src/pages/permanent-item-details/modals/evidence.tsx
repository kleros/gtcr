import React, { useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { useAtlasProvider } from '@kleros/kleros-app'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import InlineEvidenceComposer from 'components/inline-evidence-composer'
import { uploadEvidence } from 'utils/upload-evidence'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { Body, Button, Row, Stack } from 'components/curate/primitives'
import { FormBlock, GateHelper, ModalShell, useActionGate } from './shell'

/*
 * Evidence on a Stake Curate item: a title, a description and an optional
 * file, uploaded through Atlas and published on-chain. Inline it is the
 * item page's always-open composer under the history (connect, sign in and
 * switch named on its button); as a modal it is the same form in a dialog.
 */

const EVIDENCE_FORM_ID = 'submitEvidenceForm'

interface EvidenceModalProps {
  item: SubgraphItem
  inline?: boolean
  composerId?: string
  visible?: boolean
  onCancel?: () => void
  title?: React.ReactNode
  [key: string]: unknown
}

const EvidenceModal = ({
  item,
  inline = false,
  composerId = 'evidence-composer',
  visible = false,
  onCancel,
  title,
}: EvidenceModalProps) => {
  const tcrAddress = item?.registry?.id
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const gate = useActionGate('submit evidence', { needsSignIn: true })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const submitEvidence = async ({
    title: evidenceTitle,
    description,
    evidenceAttachment,
  }: EvidenceFormValues) => {
    if (!account || !walletClient || !publicClient || !tcrAddress) return
    setIsSubmitting(true)
    try {
      const ipfsEvidencePath = await uploadEvidence({
        title: evidenceTitle ?? '',
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

      if (result.status)
        if (inline) setFormKey((key) => key + 1)
        else onCancel?.()
    } catch (err) {
      console.error('Error submitting evidence:', err)
      errorToast(parseWagmiError(err))
    }
    setIsSubmitting(false)
  }

  if (inline)
    return (
      <InlineEvidenceComposer
        id={composerId}
        formID={EVIDENCE_FORM_ID}
        formKey={formKey}
        isSubmitting={isSubmitting}
        onSubmit={submitEvidence}
      />
    )

  const disabled = !gate.ready || isSubmitting

  return (
    <ModalShell
      open={visible}
      title={title ?? 'Add evidence'}
      onClose={() => onCancel?.()}
    >
      <Stack $gap={14}>
        <Body $muted>Published on-chain with this item, for the jurors.</Body>
        <FormBlock>
          <EvidenceForm
            key={formKey}
            onSubmit={submitEvidence}
            formID={EVIDENCE_FORM_ID}
            detailed
          />
        </FormBlock>
        <Row $justify="flex-end" $gap={8} $wrap>
          <Button type="button" $variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={EVIDENCE_FORM_ID}
            $variant="primary"
            disabled={disabled}
            aria-disabled={disabled}
            title={!gate.ready ? gate.blocker : undefined}
          >
            {isSubmitting ? 'Waiting for your wallet…' : 'Submit evidence'}
          </Button>
        </Row>
        <GateHelper gate={gate} />
      </Stack>
    </ModalShell>
  )
}

export default EvidenceModal
