import React, { useContext, useState } from 'react'
import styled from 'styled-components'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress, type Address } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import { CONTRACT_STATUS } from 'utils/item-status'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
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
import { gatedConfirm, useActionGate } from 'components/curate/item-light-gate'
import { formatAmount, sumAmounts } from 'components/curate/item-light-format'

/*
 * Challenge a submission or a removal request (DESIGN.md: before any
 * deposit, the receipt, the outcomes as steps and one confirm button that
 * repeats the amount). A justification is required; it is uploaded through
 * Atlas and published as the first evidence of the dispute.
 */

/** Loading placeholder inside a dialog. Kept for the pages that import it. */
export const StyledSpin = () => <SkeletonBlock $height="60px" />

/** Inline balance error under a confirm button. Kept for the pages that import it. */
export const InsufficientBalanceText = styled.span`
  display: block;
  margin-top: 4px;
  color: var(--color-danger);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-align: center;
`

/** Dialog with the old modal props (visible, onCancel, title, footer). */
export const StyledModal = ({
  visible,
  onCancel,
  title,
  footer,
  width,
  children,
}: {
  visible?: boolean
  onCancel?: () => void
  title?: React.ReactNode
  footer?: React.ReactNode
  width?: 'md' | 'lg'
  children?: React.ReactNode
  [key: string]: unknown
}) => (
  <Dialog
    open={!!visible}
    onClose={onCancel ?? (() => undefined)}
    title={title}
    footer={footer}
    width={width}
  >
    {children}
  </Dialog>
)

const EVIDENCE_FORM_ID = 'challengeEvidenceForm'

interface ChallengeModalProps {
  item: SubgraphItem
  itemName?: string
  statusCode?: number
  fileURI?: string
  visible?: boolean
  title?: React.ReactNode
  onCancel: () => void
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
  } = useContext(LightTCRViewContext) || {}
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const nativeCurrency = useNativeCurrency()
  const openAttachment = useAttachment()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRemoval = item.status === CONTRACT_STATUS.REMOVAL_REQUESTED
  const challengeDeposit = isRemoval
    ? removalChallengeDeposit
    : submissionChallengeDeposit
  const baseDeposit = isRemoval
    ? removalChallengeBaseDeposit
    : submissionChallengeBaseDeposit
  const requesterDeposit = (
    item.requests?.[0] as { deposit?: string } | undefined
  )?.deposit
  const name = itemName || 'entry'
  const verb = isRemoval ? 'challenge the removal' : 'challenge the submission'

  const gate = useActionGate({
    verb,
    shortVerb: 'challenge',
    amount: challengeDeposit,
    pending: challengeDeposit ? undefined : 'Loading the deposit',
  })

  const challengeRequest = async ({
    title,
    description,
    evidenceAttachment,
  }: EvidenceFormValues) => {
    if (
      !account ||
      !tcrAddress ||
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
        attachment: evidenceAttachment as File | undefined,
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
  // The indexer stores only the requester's base deposit, so pool = the
  // challenger's full deposit + the requester's base deposit = the payout
  // to a challenger who wins.
  const pool = sumAmounts(requesterDeposit, challengeDeposit)
  const requesterName = isRemoval ? 'requester' : 'submitter'
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
        isRemoval
          ? `The ${name} stays on the list.`
          : `The ${name} is rejected.`
      } ${
        pool && requesterDeposit
          ? `You get ${formatAmount(pool, nativeCurrency)} in total: your ${total} back plus the ${requesterName}'s ${formatAmount(requesterDeposit, nativeCurrency)} base deposit.`
          : `You get your deposit back plus the ${requesterName}'s base deposit.`
      }`,
    },
    {
      title: `Jurors side with the ${requesterName}`,
      branch: true,
      body: `${
        isRemoval ? `The ${name} is removed.` : `The ${name} is registered.`
      } Your ${total} goes to the ${requesterName}, less the arbitration cost.`,
    },
  ]

  return (
    <Dialog
      open={!!visible}
      onClose={onCancel}
      eyebrow={name}
      title={isRemoval ? 'Challenge the removal' : 'Challenge the submission'}
      width="lg"
    >
      {challengeDeposit ? (
        <DialogColumns>
          <Stack $gap={16}>
            <Body>
              {isRemoval
                ? `Tell the jurors why this removal request is wrong: why the ${name} meets the listing policy and should stay on the list.`
                : `Tell the jurors why this ${name} does not meet the listing policy.`}{' '}
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
              {...gatedConfirm(gate, {
                label: isRemoval ? 'Challenge removal' : 'Challenge submission',
                onConfirm: confirm,
                disabled: !gate.ready || isSubmitting,
                blocker: gate.blocker,
                loading: isSubmitting,
              })}
              policy={`Deposits are in ${nativeCurrency}. The ruling can be appealed by funding appeal fees during the appeal period.`}
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

export default ChallengeModal
