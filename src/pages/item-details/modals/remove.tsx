import React, { useContext, useCallback, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { type Address } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { TCRViewContext } from 'contexts/tcr-view-context'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import { uploadEvidence } from 'utils/upload-evidence'
import useNativeCurrency from 'hooks/native-currency'
import { formatDuration, formatDurationLong } from 'utils/time'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { CurateIcon } from 'components/curate/icons'
import { Body, Row, SkeletonBlock, Stack } from 'components/curate/primitives'
import {
  WhatHappensNext,
  sendPhaseLabel,
  type OutcomeStep,
  type ReceiptLine,
  type SendPhase,
} from 'components/curate/what-happens-next'
import { Dialog, DialogColumns } from 'components/curate/item-light-dialog'
import { useActionGate } from 'components/curate/item-light-gate'
import { formatAmount } from 'components/curate/item-light-format'
import { PolicyButton } from 'pages/light-item-details/policy-button'

/*
 * Request the removal of a registered entry from a Classic list. The list
 * decides whether a justification is required (requireRemovalEvidence).
 * Before the deposit: the receipt, the outcomes and the challenge period.
 */

const EVIDENCE_FORM_ID = 'removeEvidenceForm'

interface RemoveModalProps {
  item: SubgraphItem
  itemName?: string
  fileURI?: string
  onCancel: () => void
  visible?: boolean
  title?: React.ReactNode
  [key: string]: unknown
}

const RemoveModal = ({
  item,
  itemName,
  fileURI,
  onCancel,
  visible,
}: RemoveModalProps) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const {
    removalDeposit,
    removalBaseDeposit,
    arbitrationCost,
    tcrAddress,
    metaEvidence,
    challengePeriodDuration,
  } = useContext(TCRViewContext) ?? {}
  const nativeCurrency = useNativeCurrency()
  const { uploadFile } = useAtlasProvider()

  const { metadata } = metaEvidence || {}
  const { requireRemovalEvidence } = metadata || {}
  // Whether the list requires a justification is only known once its
  // metadata is in. Until then (or if it never loads) nothing is sent, so a
  // removal can never go out without the justification the list asks for.
  const metadataKnown = !!metadata
  const needsEvidence = metadataKnown && !!requireRemovalEvidence
  const name = itemName || 'entry'

  const [phase, setPhase] = useState<SendPhase>()
  const isSubmitting = !!phase
  // Whether the justification has anything in it (EvidenceForm tells).
  const [drafted, setDrafted] = useState(false)
  const justificationMissing = needsEvidence && !drafted
  const gate = useActionGate({
    verb: 'request the removal',
    amount: removalDeposit,
    needsAuth: needsEvidence,
    pending: !metadataKnown
      ? 'Loading the list…'
      : removalDeposit
        ? undefined
        : 'Loading the deposit',
  })

  const removeItem = useCallback(
    async ({
      title,
      description,
      evidenceAttachment,
    }: EvidenceFormValues = {}) => {
      if (
        !metadata ||
        !tcrAddress ||
        !account ||
        !walletClient ||
        !publicClient ||
        !removalDeposit
      )
        return
      const uploads = !!(metadata && requireRemovalEvidence)
      setPhase(uploads ? 'uploading' : 'wallet')
      try {
        let ipfsEvidencePath = ''
        if (uploads)
          ipfsEvidencePath = await uploadEvidence({
            title: title || 'Removal Justification',
            description: description ?? '',
            attachment: evidenceAttachment,
            uploadFile,
          })

        const { request } = await simulateContract(wagmiConfig, {
          address: tcrAddress as Address,
          abi: _gtcr,
          functionName: 'removeItem',
          args: [item.itemID, ipfsEvidencePath],
          value: BigInt(removalDeposit.toString()),
          account,
        })

        setPhase('wallet')
        const result = await wrapWithToast(
          () =>
            walletClient.writeContract(request).then((hash) => {
              setPhase('mining')
              return hash
            }),
          publicClient,
        )

        if (result.status) onCancel()
      } catch (err) {
        console.error('Error removing item:', err)
        errorToast(parseWagmiError(err))
      }
      setPhase(undefined)
    },
    [
      account,
      item.itemID,
      metadata,
      onCancel,
      publicClient,
      removalDeposit,
      requireRemovalEvidence,
      tcrAddress,
      uploadFile,
      walletClient,
    ],
  )

  const confirm = () => {
    if (!metadataKnown) return
    if (needsEvidence) {
      const form = document.querySelector<HTMLFormElement>(
        `#${EVIDENCE_FORM_ID}`,
      )
      form?.requestSubmit()
      // An attachment alone counts as a draft, but the description is
      // still required: in one column its error is a screen above, so go
      // to it.
      const description = document.querySelector<HTMLTextAreaElement>(
        `#${EVIDENCE_FORM_ID}-description`,
      )
      if (description && !description.value) description.focus()
    } else removeItem()
  }

  const total = formatAmount(removalDeposit, nativeCurrency)
  const periodSeconds = challengePeriodDuration?.toNumber()
  const windowSpan = periodSeconds ? (
    <span title={formatDurationLong(periodSeconds)}>
      {formatDuration(periodSeconds)}
    </span>
  ) : undefined
  const receipt: ReceiptLine[] =
    removalBaseDeposit && arbitrationCost
      ? [
          {
            label: 'Base deposit',
            value: formatAmount(removalBaseDeposit, nativeCurrency),
          },
          {
            label: 'Arbitration cost',
            value: formatAmount(arbitrationCost, nativeCurrency),
          },
        ]
      : [{ label: 'Removal deposit (base + arbitration cost)', value: total }]
  const steps: OutcomeStep[] = [
    {
      title: 'Challenge period opens',
      body: windowSpan ? (
        <>
          {windowSpan}, while the {name} stays listed
        </>
      ) : (
        `While the ${name} stays listed`
      ),
    },
    {
      title: 'No challenge',
      body: `The ${name} is removed and your deposit comes back`,
    },
    {
      title: 'If someone challenges',
      branch: true,
      body: "Jurors decide. If they side with you, you get your deposit back plus the challenger's, less the arbitration cost; if not, it goes to the challenger",
    },
  ]

  return (
    <Dialog
      open={!!visible}
      onClose={onCancel}
      eyebrow={name}
      title="Request the removal"
      width="lg"
    >
      {removalDeposit ? (
        <DialogColumns>
          <Stack $gap={16}>
            {/* The justification form asks for itself; without one, a
                single line says what the request does. */}
            {!metadataKnown ? (
              <Body $muted role="status">
                Loading the list…
              </Body>
            ) : (
              !needsEvidence && (
                <Body>Ask for this {name} to be taken off the list.</Body>
              )
            )}
            <div>
              <PolicyButton fileURI={fileURI}>
                <CurateIcon name="policy" size={14} />
                Read the listing policy
              </PolicyButton>
            </div>
            {needsEvidence && (
              <EvidenceForm
                onSubmit={removeItem}
                formID={EVIDENCE_FORM_ID}
                onDraftChange={setDrafted}
              />
            )}
          </Stack>
          <Stack $gap={12}>
            <WhatHappensNext
              receipt={receipt}
              total={total}
              steps={steps}
              confirmLabel={`Remove ${name}`}
              onConfirm={confirm}
              // A required justification is named on the button: in one
              // column its field (and error) are a screen above it.
              confirmDisabled={
                !gate.ready || justificationMissing || isSubmitting
              }
              confirmBlocker={
                gate.blocker ??
                (justificationMissing
                  ? 'Write your justification first'
                  : undefined)
              }
              loading={isSubmitting}
              loadingLabel={sendPhaseLabel(phase)}
            />
            {gate.controls && (
              <Row $justify="flex-end" $wrap>
                {gate.controls}
              </Row>
            )}
          </Stack>
        </DialogColumns>
      ) : (
        <SkeletonBlock $height="220px" />
      )}
    </Dialog>
  )
}

export default RemoveModal
