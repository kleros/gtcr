import React, { useContext, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { useAtlasProvider } from '@kleros/kleros-app'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { StandardTCRViewContext } from 'contexts/standard-tcr-view-context'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import InlineEvidenceComposer, {
  type EvidencePhase,
} from 'components/inline-evidence-composer'
import { sendPhaseLabel } from 'components/curate/what-happens-next'
import { uploadEvidence } from 'utils/upload-evidence'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { Body, Button, Small, Stack } from 'components/curate/primitives'
import { Dialog } from 'components/curate/item-standard-dialog'
import { useActionGate } from 'components/curate/item-standard-gate'

/*
 * Submit evidence on an entry: inline at the end of the history while a
 * request is open, or as a dialog. The file is uploaded through Atlas at
 * submit time.
 */

const EVIDENCE_FORM_ID = 'submitEvidenceForm'

interface EvidenceModalProps {
  item: SubgraphItem
  inline?: boolean
  composerId?: string
  visible?: boolean
  onCancel?: () => void
  [key: string]: unknown
}

const EvidenceModal = ({
  item,
  inline = false,
  composerId = 'evidence-composer',
  visible,
  onCancel,
}: EvidenceModalProps) => {
  const tcrAddress = useContext(StandardTCRViewContext)?.tcrAddress
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  // Where the piece being sent is: uploading, in the wallet, being mined.
  const [phase, setPhase] = useState<EvidencePhase>()
  const isSubmitting = !!phase
  const [formKey, setFormKey] = useState(0)
  // Whether the dialog's form has anything in it (EvidenceForm tells).
  const [drafted, setDrafted] = useState(false)
  const gate = useActionGate({ verb: 'submit evidence' })

  const submitEvidence = async ({
    title,
    description,
    evidenceAttachment,
  }: EvidenceFormValues) => {
    if (!account || !walletClient || !publicClient || !tcrAddress) return
    setPhase('uploading')
    try {
      const ipfsEvidencePath = await uploadEvidence({
        title: title ?? '',
        description: description ?? '',
        attachment: evidenceAttachment,
        uploadFile,
      })

      setPhase('wallet')
      const { request } = await simulateContract(wagmiConfig, {
        address: tcrAddress as `0x${string}`,
        abi: _gtcr,
        functionName: 'submitEvidence',
        args: [item.itemID, ipfsEvidencePath],
        account,
      })

      const result = await wrapWithToast(
        () =>
          walletClient.writeContract(request).then((hash) => {
            setPhase('mining')
            return hash
          }),
        publicClient,
      )

      if (result.status)
        if (inline) setFormKey((key) => key + 1)
        else onCancel?.()
    } catch (err) {
      console.error('Error submitting evidence:', err)
      errorToast(parseWagmiError(err))
    }
    setPhase(undefined)
  }

  if (inline)
    return (
      <InlineEvidenceComposer
        id={composerId}
        formID={EVIDENCE_FORM_ID}
        formKey={formKey}
        isSubmitting={isSubmitting}
        phase={phase}
        onSubmit={submitEvidence}
      />
    )

  const disabled = isSubmitting || !gate.ready
  // Asked before typed evidence is thrown away: by the dialog's own close
  // (Escape, the scrim, the close button) and by Cancel alike.
  const discardWarning =
    drafted && !isSubmitting
      ? 'Close this? Your evidence will be lost.'
      : undefined

  return (
    <Dialog
      open={!!visible}
      onClose={onCancel ?? (() => undefined)}
      discardWarning={discardWarning}
      title="Add evidence"
      footer={
        <>
          {gate.controls}
          <Button
            type="button"
            $variant="secondary"
            onClick={() => {
              if (!discardWarning || window.confirm(discardWarning))
                onCancel?.()
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={EVIDENCE_FORM_ID}
            $variant="primary"
            disabled={disabled}
            aria-disabled={disabled}
            title={gate.blocker}
          >
            {sendPhaseLabel(phase) ?? 'Submit evidence'}
          </Button>
        </>
      }
    >
      <Stack $gap={14}>
        <Body $muted>Published on-chain with this entry, for the jurors.</Body>
        <EvidenceForm
          onSubmit={submitEvidence}
          formID={EVIDENCE_FORM_ID}
          detailed
          onDraftChange={setDrafted}
        />
        {gate.blocker && (
          <Small $muted role="status">
            {gate.blocker}
          </Small>
        )}
      </Stack>
    </Dialog>
  )
}

export default EvidenceModal
