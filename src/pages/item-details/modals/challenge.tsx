import React, { useContext, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress, type Address } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { CONTRACT_STATUS } from 'utils/item-status'
import { TCRViewContext } from 'contexts/tcr-view-context'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import { uploadEvidence } from 'utils/upload-evidence'
import useNativeCurrency from 'hooks/native-currency'
import { useAttachment } from 'hooks/use-attachment'
import { parseIpfs } from 'utils/ipfs-parse'
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
import { formatAmount, sumAmounts } from 'components/curate/item-light-format'

/*
 * Challenge a submission or a removal request on a Classic list. Before the
 * deposit: the receipt (challenge deposit + arbitration cost), the outcomes
 * and one confirm button that repeats the amount. The justification is
 * required; it is uploaded through Atlas and becomes the dispute's first
 * evidence.
 */

const EVIDENCE_FORM_ID = 'challengeEvidenceForm'

interface ChallengeModalProps {
  item: SubgraphItem
  itemName?: string
  statusCode?: number
  fileURI?: string
  visible?: boolean
  title?: React.ReactNode
  onCancel: () => void
  [key: string]: unknown
}

const ChallengeModal = ({
  item,
  itemName,
  fileURI,
  visible,
  onCancel,
}: ChallengeModalProps) => {
  const {
    submissionChallengeDeposit,
    removalChallengeDeposit,
    submissionChallengeBaseDeposit,
    removalChallengeBaseDeposit,
    arbitrationCost,
    tcrAddress,
  } = useContext(TCRViewContext) ?? {}
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const nativeCurrency = useNativeCurrency()
  const openAttachment = useAttachment()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSubmission = item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED
  const challengeDeposit = isSubmission
    ? submissionChallengeDeposit
    : removalChallengeDeposit
  const baseDeposit = isSubmission
    ? submissionChallengeBaseDeposit
    : removalChallengeBaseDeposit
  const requesterDeposit = (
    item.requests?.[0] as { deposit?: string } | undefined
  )?.deposit
  const name = itemName || 'entry'

  const gate = useActionGate({
    verb: isSubmission ? 'challenge the submission' : 'challenge the removal',
    amount: challengeDeposit,
    pending: challengeDeposit ? undefined : 'Loading the deposit',
  })

  const challengeRequest = async ({
    title,
    description,
    evidenceAttachment,
  }: EvidenceFormValues) => {
    if (
      !tcrAddress ||
      !account ||
      !walletClient ||
      !publicClient ||
      !challengeDeposit
    )
      return
    setIsSubmitting(true)
    try {
      const ipfsEvidencePath = await uploadEvidence({
        title: title || 'Challenge Justification',
        description: description ?? '',
        attachment: evidenceAttachment,
        uploadFile,
      })

      const { request } = await simulateContract(wagmiConfig, {
        address: tcrAddress as Address,
        abi: _gtcr,
        functionName: 'challengeRequest',
        args: [item.itemID, ipfsEvidencePath],
        value: BigInt(challengeDeposit.toString()),
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
      console.error('Error challenging request:', err)
      errorToast(parseWagmiError(err))
    }
    setIsSubmitting(false)
  }

  const confirm = () => {
    const form = document.querySelector<HTMLFormElement>(`#${EVIDENCE_FORM_ID}`)
    form?.requestSubmit()
  }

  const total = formatAmount(challengeDeposit, nativeCurrency)
  // The subgraph stores the requester's base deposit only, so this is the
  // challenger's payout on a win: their full deposit (base + arbitration
  // cost) plus the requester's base deposit.
  const pool = sumAmounts(requesterDeposit, challengeDeposit)
  const receipt: ReceiptLine[] =
    baseDeposit && arbitrationCost
      ? [
          {
            label: 'Challenge deposit',
            value: formatAmount(baseDeposit, nativeCurrency),
          },
          {
            label: 'Arbitration cost',
            value: formatAmount(arbitrationCost, nativeCurrency),
          },
        ]
      : [{ label: 'Challenge deposit (base + arbitration cost)', value: total }]
  const steps: OutcomeStep[] = [
    {
      title: `You deposit ${total} now`,
      body: 'Your justification is published as evidence and the request goes to the jurors. It can no longer be executed.',
    },
    {
      title: 'Kleros jurors decide',
      body: 'They rule on the listing policy. Anyone can add evidence until the request is resolved.',
    },
    {
      title: 'Jurors agree: you earn the bounty',
      body: `${
        isSubmission
          ? `The ${name} is rejected.`
          : `The ${name} stays on the list.`
      } ${
        pool && requesterDeposit
          ? `You get ${formatAmount(
              pool,
              nativeCurrency,
            )} back: your deposit plus the requester's base deposit (${formatAmount(
              requesterDeposit,
              nativeCurrency,
            )}).`
          : "You get your deposit back plus the requester's base deposit."
      }`,
    },
    {
      title: 'Jurors side with the requester',
      branch: true,
      body: `${
        isSubmission ? `The ${name} is registered.` : `The ${name} is removed.`
      } Your deposit goes to the requester, less the arbitration cost.`,
    },
  ]

  return (
    <Dialog
      open={!!visible}
      onClose={onCancel}
      eyebrow={name}
      title={
        isSubmission ? 'Challenge the submission' : 'Challenge the removal'
      }
      width="lg"
    >
      {challengeDeposit ? (
        <DialogColumns>
          <Stack $gap={16}>
            <Body>
              {isSubmission
                ? `Tell the jurors why this ${name} does not meet the listing policy.`
                : `Tell the jurors why this removal request is wrong: why the ${name} meets the listing policy and should stay on the list.`}{' '}
              Your justification is published as evidence.
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
            <EvidenceForm
              onSubmit={challengeRequest}
              formID={EVIDENCE_FORM_ID}
            />
          </Stack>
          <Stack $gap={12}>
            <WhatHappensNext
              receipt={receipt}
              total={total}
              steps={steps}
              confirmLabel={
                isSubmission ? 'Challenge submission' : 'Challenge removal'
              }
              onConfirm={confirm}
              confirmDisabled={!gate.ready || isSubmitting}
              confirmBlocker={gate.blocker}
              loading={isSubmitting}
              policy={`Deposits are in ${nativeCurrency}. The ruling can be appealed by funding appeal fees during the appeal period.`}
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

export default ChallengeModal
