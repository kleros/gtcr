import React, { useState, useContext, useEffect, useMemo } from 'react'
import styled from 'styled-components'
import { ethers, BigNumber } from 'ethers'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { type Address } from 'viem'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import {
  STATUS_CODE,
  PARTY,
  SUBGRAPH_RULING,
  CONTRACT_STATUS,
} from 'utils/item-status'
import { TCRViewContext } from 'contexts/tcr-view-context'
import useRequiredFees from 'hooks/required-fees'
import useNativeCurrency from 'hooks/native-currency'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { CurateIcon } from 'components/curate/icons'
import {
  Body,
  Button,
  Data,
  Label,
  Row,
  SkeletonBlock,
  Stack,
  TextInput,
} from 'components/curate/primitives'
import {
  WhatHappensNext,
  type OutcomeStep,
  type ReceiptLine,
} from 'components/curate/what-happens-next'
import { Dialog, DialogColumns } from 'components/curate/item-light-dialog'
import { useActionGate } from 'components/curate/item-light-gate'
import { formatAmount, formatEther } from 'components/curate/item-light-format'
import { Notice } from 'components/curate/item-light-notice'
import { PolicyButton } from 'pages/light-item-details/policy-button'

const { parseEther } = ethers.utils

/*
 * Contribute appeal fees to one side of a dispute on a Classic list
 * (fundAppeal). The side is picked automatically when only one can still be
 * funded; otherwise the user chooses. The receipt shows what the side needs,
 * what is already in, and the exact contribution the slider selects.
 */

const RangeInput = styled.input`
  width: 100%;
  height: 24px;
  margin: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
`

const AmountRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  gap: 12px;
  align-items: center;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

const SideButton = styled(Button)`
  flex: 1 1 220px;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  height: auto;
  padding: 16px 18px;
  white-space: normal;
  text-align: left;
  justify-content: flex-start;

  small {
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 400;
  }
`

interface CrowdfundModalProps {
  statusCode: number
  item: SubgraphItem
  fileURI?: string
  appealCost?: BigNumber
  /** The appeal cost could not be read: offer a retry, not a skeleton. */
  appealCostFailed?: boolean
  retryAppealCost?: () => void
  onCancel: () => void
  visible?: boolean
  title?: React.ReactNode
  [key: string]: unknown
}

const CrowdfundModal = ({
  statusCode,
  item,
  fileURI,
  appealCost,
  appealCostFailed,
  retryAppealCost,
  onCancel,
  visible,
}: CrowdfundModalProps) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const {
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    MULTIPLIER_DIVISOR,
    tcrAddress,
  } = useContext(TCRViewContext) ?? {}

  const [contributionShare, setContributionShare] = useState(1)
  const [amountText, setAmountText] = useState<string>()
  // A typed amount, in wei: sent as typed (capped at what is still needed),
  // never rounded to a share. Undefined while the slider sets the amount.
  const [typedWei, setTypedWei] = useState<BigNumber>()
  const [userSelectedSide, setUserSelectedSide] = useState<number | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nativeCurrency = useNativeCurrency()

  // The component stays mounted while the dialog is closed, so it is reset
  // on closing and every opening starts afresh: a side picked earlier may be
  // fully funded by then, and an amount typed was a share of what was still
  // needed at the time. (Closed, the dialog renders nothing, so the reset is
  // never seen.)
  useEffect(() => {
    if (visible) return
    setUserSelectedSide(undefined)
    setAmountText(undefined)
    setTypedWei(undefined)
    setContributionShare(1)
  }, [visible])

  const round = (item.requests?.[0]?.rounds?.[0] ?? {}) as SubgraphRound
  const {
    hasPaidRequester,
    hasPaidChallenger,
    ruling,
    amountPaidRequester,
    amountPaidChallenger,
  } = round

  const winner =
    ruling === SUBGRAPH_RULING.ACCEPT ? PARTY.REQUESTER : PARTY.CHALLENGER

  // Once one side is fully funded only the other can be funded (the
  // contract refuses more for a funded side), whatever the ruling: with no
  // ruling too, the dialog goes to the side still raising rather than
  // offering one with nothing left to fund.
  const autoSelectedSide = useMemo(() => {
    if (
      (hasPaidRequester && hasPaidChallenger) ||
      (!hasPaidRequester && !hasPaidChallenger)
    )
      return PARTY.NONE

    if (statusCode === STATUS_CODE.CROWDFUNDING_WINNER) return winner

    return !hasPaidRequester ? PARTY.REQUESTER : PARTY.CHALLENGER
  }, [hasPaidRequester, hasPaidChallenger, statusCode, winner])

  const side = useMemo(
    () => userSelectedSide || autoSelectedSide,
    [autoSelectedSide, userSelectedSide],
  )

  const { requiredForSide, amountStillRequired, potentialReward } =
    useRequiredFees({
      side,
      sharedStakeMultiplier,
      winnerStakeMultiplier,
      loserStakeMultiplier,
      item,
      MULTIPLIER_DIVISOR,
      appealCost,
    })

  const contribution = useMemo(() => {
    if (!amountStillRequired || !MULTIPLIER_DIVISOR) return undefined
    if (typedWei)
      return typedWei.gt(amountStillRequired) ? amountStillRequired : typedWei
    return amountStillRequired
      .mul(
        BigNumber.from(
          Math.round(
            contributionShare * MULTIPLIER_DIVISOR.toNumber(),
          ).toString(),
        ),
      )
      .div(MULTIPLIER_DIVISOR)
  }, [amountStillRequired, MULTIPLIER_DIVISOR, contributionShare, typedWei])

  const gate = useActionGate({
    verb: 'contribute',
    amount: contribution,
    needsAuth: false,
    pending: contribution ? undefined : 'Loading the appeal fees',
  })

  const isRegistration = item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED
  const requesterLabel = isRegistration ? 'submitter' : 'requester'
  const sideName = side === PARTY.REQUESTER ? requesterLabel : 'challenger'

  const crowdfundSide = async () => {
    if (
      !tcrAddress ||
      !account ||
      !walletClient ||
      !publicClient ||
      !contribution
    )
      return
    setIsSubmitting(true)
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: tcrAddress as Address,
        abi: _gtcr,
        functionName: 'fundAppeal',
        args: [item.itemID, side],
        value: BigInt(contribution.toString()),
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) onCancel()
    } catch (err) {
      console.error('Error funding appeal:', err)
      errorToast(parseWagmiError(err))
    }
    setIsSubmitting(false)
  }

  const loading =
    !sharedStakeMultiplier || !potentialReward || !MULTIPLIER_DIVISOR
  const needsSideChoice =
    (ruling === SUBGRAPH_RULING.NONE ||
      statusCode === STATUS_CODE.CROWDFUNDING) &&
    side === PARTY.NONE

  if (loading)
    return (
      <Dialog
        open={!!visible}
        onClose={onCancel}
        title="Contribute appeal fees"
      >
        {appealCostFailed && !appealCost ? (
          <Stack $gap={12}>
            <Notice tone="contested" role="alert">
              The court&apos;s appeal fee could not be read, so the amounts
              cannot be shown yet.
            </Notice>
            {retryAppealCost && (
              <Row>
                <Button
                  type="button"
                  $variant="secondary"
                  $size="sm"
                  onClick={retryAppealCost}
                >
                  Try again
                </Button>
              </Row>
            )}
          </Stack>
        ) : (
          <SkeletonBlock $height="120px" />
        )}
      </Dialog>
    )

  if (needsSideChoice)
    return (
      <Dialog
        open={!!visible}
        onClose={onCancel}
        title="Contribute appeal fees"
      >
        <Stack $gap={16}>
          <Body $muted>
            Pick a side. If it wins the next round, its backers share the other
            side&apos;s fees.
          </Body>
          <Row $gap={12} $wrap $align="stretch">
            {[
              {
                party: PARTY.REQUESTER,
                name: requesterLabel,
                paid: hasPaidRequester,
              },
              {
                party: PARTY.CHALLENGER,
                name: 'challenger',
                paid: hasPaidChallenger,
              },
            ].map((option) => (
              <SideButton
                key={option.party}
                type="button"
                $variant="secondary"
                onClick={() => setUserSelectedSide(option.party)}
              >
                The {option.name}&apos;s side
                <small>
                  {ruling === SUBGRAPH_RULING.NONE
                    ? 'No decisive ruling'
                    : winner === option.party
                      ? 'Favoured by the current ruling'
                      : 'Against the current ruling'}
                  {' · '}
                  {option.paid ? 'fully funded' : 'still raising'}
                </small>
              </SideButton>
            ))}
          </Row>
        </Stack>
      </Dialog>
    )

  const amountPaid =
    side === PARTY.REQUESTER ? amountPaidRequester : amountPaidChallenger
  const maxAmount = amountStillRequired ? formatEther(amountStillRequired) : '0'
  const amountValue =
    amountText ??
    (amountStillRequired && contribution ? formatEther(contribution) : '0')
  const reward =
    potentialReward && contribution
      ? potentialReward
          .mul(BigNumber.from(Math.ceil(contributionShare * 10000) || 1))
          .div(10000)
      : undefined

  const setShareFromAmount = (text: string) => {
    setAmountText(text)
    if (
      !amountStillRequired ||
      !MULTIPLIER_DIVISOR ||
      amountStillRequired.isZero()
    )
      return
    try {
      const wei = parseEther(text || '0')
      if (wei.isNegative()) return
      setTypedWei(wei)
      // The share only drives the slider and the reward estimate.
      setContributionShare(
        wei.gte(amountStillRequired)
          ? 1
          : wei.mul(MULTIPLIER_DIVISOR).div(amountStillRequired).toNumber() /
              MULTIPLIER_DIVISOR.toNumber(),
      )
    } catch {
      // Not a number yet; keep the previous amount.
    }
  }

  const total = formatAmount(contribution, nativeCurrency)
  const receipt: ReceiptLine[] = [
    {
      label: `Required for the ${sideName}`,
      value: formatAmount(requiredForSide, nativeCurrency),
    },
    {
      label: 'Already funded',
      value: formatAmount(amountPaid, nativeCurrency),
    },
    {
      label: 'Still needed',
      value: formatAmount(amountStillRequired, nativeCurrency),
    },
    {
      label: 'Your share of what is needed',
      value: `${Math.round(contributionShare * 1000) / 10}%`,
    },
  ]
  const steps: OutcomeStep[] = [
    {
      title: `You contribute ${total} now`,
      body: `It funds the ${sideName}'s appeal. Contributions stay locked until the request is resolved; then they are paid out, or reimbursed if the appeal was not fully funded, with Withdraw rewards on this page.`,
    },
    {
      title: `The ${sideName} wins the next round`,
      body: `You get your contribution back plus a share of the other side's fees: up to ${formatAmount(
        reward,
        nativeCurrency,
      )}.`,
    },
    {
      title: `The ${sideName} loses the next round`,
      branch: true,
      body: 'Your contribution goes to the funders of the winning side.',
    },
    {
      title: 'The appeal is not fully funded on both sides',
      branch: true,
      body: 'There is no new round: the side that fully funded wins, or the current ruling stands if neither did. Contributions are reimbursed.',
    },
  ]

  return (
    <Dialog
      open={!!visible}
      onClose={onCancel}
      title={`Fund the ${sideName}'s appeal`}
      eyebrow="Contribute appeal fees"
      width="lg"
    >
      <DialogColumns>
        <Stack $gap={16}>
          <Body>
            Choose how much of the remaining {maxAmount} {nativeCurrency} you
            contribute. If the {sideName} wins the next round, contributors
            share the other side&apos;s fees in proportion to what they put in.
          </Body>
          <div>
            <PolicyButton fileURI={fileURI}>
              <CurateIcon name="policy" size={14} />
              Read the listing policy
            </PolicyButton>
          </div>
          <Stack $gap={8}>
            <Label>Your contribution</Label>
            <AmountRow>
              <RangeInput
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={contributionShare}
                aria-label="Share of the remaining amount"
                onChange={(event) => {
                  setAmountText(undefined)
                  setTypedWei(undefined)
                  setContributionShare(Number(event.currentTarget.value))
                }}
              />
              <Row $gap={8}>
                <TextInput
                  type="number"
                  // A wheel over the focused field would change the amount.
                  onWheel={(event) => event.currentTarget.blur()}
                  inputMode="decimal"
                  min={0}
                  max={maxAmount}
                  step="0.01"
                  value={amountValue}
                  aria-label={`Contribution in ${nativeCurrency}`}
                  onChange={(event) =>
                    setShareFromAmount(event.currentTarget.value)
                  }
                />
                <Data $muted>{nativeCurrency}</Data>
              </Row>
            </AmountRow>
          </Stack>
        </Stack>
        <Stack $gap={12}>
          <WhatHappensNext
            receipt={receipt}
            total={total}
            steps={steps}
            confirmLabel="Contribute"
            onConfirm={crowdfundSide}
            confirmDisabled={
              !gate.ready ||
              isSubmitting ||
              !contribution ||
              contribution.isZero()
            }
            confirmBlocker={
              gate.blocker ??
              (contribution && contribution.isZero()
                ? 'Choose an amount above zero'
                : undefined)
            }
            loading={isSubmitting}
            policy={`Amounts are in ${nativeCurrency}. Appeal fees are set by the list's stake multipliers and the court's arbitration cost.`}
          />
          {gate.controls && (
            <Row $justify="flex-end" $wrap>
              {gate.controls}
            </Row>
          )}
        </Stack>
      </DialogColumns>
    </Dialog>
  )
}

export default CrowdfundModal
