import React, { useContext, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import InlineEvidenceComposer from 'components/inline-evidence-composer'
import { uploadEvidence } from 'utils/upload-evidence'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { Body, Button, Small, Stack } from 'components/curate/primitives'
import { Dialog } from 'components/curate/item-light-dialog'
import { useActionGate } from 'components/curate/item-light-gate'

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
  const tcrAddress = useContext(LightTCRViewContext)?.tcrAddress
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const gate = useActionGate({ verb: 'submit evidence' })

  const submitEvidence = async ({
    title,
    description,
    evidenceAttachment,
  }: EvidenceFormValues) => {
    if (!account || !walletClient || !publicClient || !tcrAddress) return
    setIsSubmitting(true)
    try {
      const ipfsEvidencePath = await uploadEvidence({
        title: title ?? '',
        description: description ?? '',
        attachment: evidenceAttachment,
        uploadFile,
      })

      const { request } = await simulateContract(wagmiConfig, {
        address: tcrAddress as `0x${string}`,
        abi: _gtcr,
        functionName: 'submitEvidence',
        args: [item.itemID, ipfsEvidencePath],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) {
        if (inline) setFormKey((key) => key + 1)
        else onCancel?.()

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
                networkID: chainId,
              }),
            },
          ).catch((err) => {
            console.error('Failed to subscribe for notifications.', err)
          })
      }
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

  const disabled = isSubmitting || !gate.ready

  return (
    <Dialog
      open={!!visible}
      onClose={onCancel ?? (() => undefined)}
      title="Add evidence"
      footer={
        <>
          {gate.controls}
          <Button type="button" $variant="secondary" onClick={onCancel}>
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
            {isSubmitting ? 'Waiting for your wallet…' : 'Submit evidence'}
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
