import React, { useContext, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { type Address } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { CONTRACT_STATUS } from 'utils/item-status'
import { TCRViewContext } from 'contexts/tcr-view-context'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import { uploadEvidence } from 'utils/upload-evidence'
import useNativeCurrency from 'hooks/native-currency'
import useNow from 'hooks/use-now'
import useUrlChainId from 'hooks/use-url-chain-id'
import { formatAbsolute, formatDuration } from 'utils/time'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { isKlerosArbitrator } from 'config/tcr-addresses'
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
import { formatAmount, sumAmounts } from 'components/curate/item-light-format'
import { useChallengeCost } from 'pages/light-item-details/challenge-cost'
import { PolicyButton } from 'pages/light-item-details/policy-button'
import {
  requestFacts,
  type LightRequest as ClassicRequest,
} from 'pages/light-item-details/request-facts'

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
  statusCode,
  fileURI,
  visible,
  onCancel,
}: ChallengeModalProps) => {
  const tcrView = useContext(TCRViewContext)
  const tcrAddress = tcrView?.tcrAddress
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const nativeCurrency = useNativeCurrency()
  const chainId = useUrlChainId()
  const now = useNow()
  const [phase, setPhase] = useState<SendPhase>()
  const isSubmitting = !!phase
  // Whether the justification has anything in it (EvidenceForm tells).
  const [drafted, setDrafted] = useState(false)

  const isSubmission = item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED
  // The contract charges the arbitration cost of the arbitrator and extra
  // data the request was made with (GeneralizedTCR.challengeRequest).
  const {
    base: baseDeposit,
    arbitrationCost,
    total: challengeDeposit,
  } = useChallengeCost({
    request: item.requests?.[0] as
      | { arbitrator?: string; arbitratorExtraData?: string }
      | undefined,
    isRemoval: !isSubmission,
    list: tcrView,
  })
  const requesterDeposit = (
    item.requests?.[0] as { deposit?: string } | undefined
  )?.deposit
  const latestRequest = item.requests?.[0] as ClassicRequest | undefined
  // When the window this challenge must land in closes, as the entry's
  // ring shows it (the ring is under the dialog).
  const windowEnd =
    latestRequest &&
    statusCode !== undefined &&
    tcrView?.challengePeriodDuration
      ? requestFacts({
          item,
          request: latestRequest,
          statusCode,
          challengePeriodDuration: tcrView.challengePeriodDuration,
        }).windowEnd
      : undefined
  // The dispute goes to the arbitrator the request was made with; only
  // Kleros has jurors to name.
  const klerosDecides = isKlerosArbitrator(chainId, latestRequest?.arbitrator)
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
    setPhase('uploading')
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
      console.error('Error challenging request:', err)
      errorToast(parseWagmiError(err))
    }
    setPhase(undefined)
  }

  const confirm = () => {
    const form = document.querySelector<HTMLFormElement>(`#${EVIDENCE_FORM_ID}`)
    form?.requestSubmit()
    // An attachment alone counts as a draft, but the description is still
    // required: in one column its error is a screen above, so go to it.
    const description = document.querySelector<HTMLTextAreaElement>(
      `#${EVIDENCE_FORM_ID}-description`,
    )
    if (description && !description.value) description.focus()
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
            label: 'Base deposit',
            value: formatAmount(baseDeposit, nativeCurrency),
          },
          {
            label: 'Arbitration cost',
            value: formatAmount(arbitrationCost, nativeCurrency),
          },
        ]
      : [{ label: 'Challenge deposit (base + arbitration cost)', value: total }]
  if (windowEnd)
    receipt.push({
      label: 'Challenge period ends',
      value: `${formatAbsolute(windowEnd)} · ${
        windowEnd > now
          ? `${formatDuration(windowEnd - now)} left`
          : 'time is up'
      }`,
    })
  const steps: OutcomeStep[] = [
    {
      title: `You deposit ${total} now`,
      body: 'Your justification is published as evidence and the request goes to the jurors. It can no longer be executed.',
    },
    {
      title: klerosDecides ? 'Kleros jurors decide' : 'The arbitrator decides',
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
              <PolicyButton fileURI={fileURI}>
                <CurateIcon name="policy" size={14} />
                Read the listing policy
              </PolicyButton>
            </div>
            <EvidenceForm
              onSubmit={challengeRequest}
              formID={EVIDENCE_FORM_ID}
              onDraftChange={setDrafted}
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
              // The justification is required, and in one column its field
              // (and error) are a screen above this button: the button
              // names it rather than failing up there.
              confirmDisabled={!gate.ready || !drafted || isSubmitting}
              confirmBlocker={
                gate.blocker ??
                (drafted ? undefined : 'Write your justification first')
              }
              loading={isSubmitting}
              loadingLabel={sendPhaseLabel(phase)}
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
