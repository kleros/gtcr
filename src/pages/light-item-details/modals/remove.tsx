import React, { useContext, useCallback, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress, type Address } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import { uploadEvidence } from 'utils/upload-evidence'
import useNativeCurrency from 'hooks/native-currency'
import { useAttachment } from 'hooks/use-attachment'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatDurationLong } from 'utils/time'
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
import { gatedConfirm, useActionGate } from 'components/curate/item-light-gate'
import { formatAmount } from 'components/curate/item-light-format'

/*
 * Request the removal of a registered entry. The list decides whether a
 * justification is required (requireRemovalEvidence). Before the deposit:
 * the receipt, the outcomes and the exact challenge period.
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
  } = useContext(LightTCRViewContext) || {}
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
    shortVerb: 'remove',
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
        !account ||
        !tcrAddress ||
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
            attachment: evidenceAttachment as File | undefined,
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
  const period = challengePeriodDuration
    ? formatDurationLong(challengePeriodDuration.toNumber())
    : 'the challenge period'
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
      title: `You deposit ${total} now`,
      body: `The removal request is published${
        needsEvidence ? ' with your justification' : ''
      } and a challenge period of ${period} opens. The ${name} stays listed until the request is executed.`,
    },
    {
      title: 'No challenge',
      body: `After ${period} the request can be executed: the ${name} is removed and your ${total} comes back.`,
    },
    {
      title: 'If someone challenges',
      branch: true,
      body: "Kleros jurors check it against the listing policy. If they side with you, you get your deposit back plus the challenger's, less the arbitration cost; if not, it goes to the challenger.",
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
            <Body>
              {needsEvidence
                ? `This list asks for a justification. Tell the jurors why this ${name} no longer meets the listing policy.`
                : `Ask for this ${name} to be taken off the list.`}
            </Body>
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
              {...gatedConfirm(gate, {
                label: `Remove ${name}`,
                onConfirm: confirm,
                disabled: !gate.ready || isSubmitting,
                blocker: gate.blocker,
                loading: isSubmitting,
              })}
              policy={`This is a deposit, not a fee: it is returned if the removal is accepted. The challenge period lasts ${period}.`}
            />
            {!gate.fix && gate.controls && (
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
