import React, { useContext, useCallback, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress, type Address } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { TCRViewContext } from 'contexts/tcr-view-context'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import { uploadEvidence } from 'utils/upload-evidence'
import useNativeCurrency from 'hooks/native-currency'
import { useAttachment } from 'hooks/use-attachment'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatDuration, formatDurationLong } from 'utils/time'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { CurateIcon } from 'components/curate/icons'
import {
  Body,
  Button,
  Row,
  SkeletonBlock,
  Stack,
} from 'components/curate/primitives'
import {
  WhatHappensNext,
  type OutcomeStep,
  type ReceiptLine,
} from 'components/curate/what-happens-next'
import { Dialog, DialogColumns } from 'components/curate/item-light-dialog'
import { useActionGate } from 'components/curate/item-light-gate'
import { formatAmount } from 'components/curate/item-light-format'

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
  const chainId = useChainId()
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
  const openAttachment = useAttachment()

  const { metadata } = metaEvidence || {}
  const { requireRemovalEvidence } = metadata || {}
  const needsEvidence = !!metadata && !!requireRemovalEvidence
  const name = itemName || 'entry'

  const [isSubmitting, setIsSubmitting] = useState(false)
  const gate = useActionGate({
    verb: 'request the removal',
    amount: removalDeposit,
    needsAuth: needsEvidence,
    pending: removalDeposit ? undefined : 'Loading the deposit',
  })

  const removeItem = useCallback(
    async ({
      title,
      description,
      evidenceAttachment,
    }: EvidenceFormValues = {}) => {
      if (
        !tcrAddress ||
        !account ||
        !walletClient ||
        !publicClient ||
        !removalDeposit
      )
        return
      setIsSubmitting(true)
      try {
        let ipfsEvidencePath = ''
        if (metadata && requireRemovalEvidence)
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

        const result = await wrapWithToast(
          () => walletClient.writeContract(request),
          publicClient,
        )

        if (result.status) {
          onCancel()

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
        console.error('Error removing item:', err)
        errorToast(parseWagmiError(err))
      }
      setIsSubmitting(false)
    },
    [
      account,
      chainId,
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
    if (needsEvidence) {
      const form = document.querySelector<HTMLFormElement>(
        `#${EVIDENCE_FORM_ID}`,
      )
      form?.requestSubmit()
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
            label: 'Removal deposit',
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
            {!needsEvidence && (
              <Body>Ask for this {name} to be taken off the list.</Body>
            )}
            <div>
              <Button
                type="button"
                $variant="ghost"
                $size="sm"
                disabled={!fileURI}
                onClick={() =>
                  fileURI && openAttachment(parseIpfs(fileURI), true)
                }
              >
                <CurateIcon name="policy" size={14} />
                Read the listing policy
              </Button>
            </div>
            {needsEvidence && (
              <EvidenceForm onSubmit={removeItem} formID={EVIDENCE_FORM_ID} />
            )}
          </Stack>
          <Stack $gap={12}>
            <WhatHappensNext
              receipt={receipt}
              total={total}
              steps={steps}
              confirmLabel={`Remove ${name}`}
              onConfirm={confirm}
              confirmDisabled={!gate.ready || isSubmitting}
              confirmBlocker={gate.blocker}
              loading={isSubmitting}
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
