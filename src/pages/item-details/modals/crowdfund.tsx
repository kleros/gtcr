import React, { useState, useContext, useMemo } from 'react'
import styled from 'styled-components'
import { ethers, BigNumber } from 'ethers'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { getAddress, type Address } from 'viem'
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
import { useAttachment } from 'hooks/use-attachment'
import { parseIpfs } from 'utils/ipfs-parse'
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
  onCancel,
  visible,
}: CrowdfundModalProps) => {
  const { address: account } = useAccount()
  const chainId = useChainId()
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
  const [userSelectedSide, setUserSelectedSide] = useState<number | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nativeCurrency = useNativeCurrency()
  const openAttachment = useAttachment()

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

  const autoSelectedSide = useMemo(() => {
    if (
      ruling === SUBGRAPH_RULING.NONE ||
      (hasPaidRequester && hasPaidChallenger) ||
      (!hasPaidRequester && !hasPaidChallenger)
    )
      return PARTY.NONE

    if (statusCode === STATUS_CODE.CROWDFUNDING_WINNER) return winner

    return !hasPaidRequester ? PARTY.REQUESTER : PARTY.CHALLENGER
  }, [ruling, hasPaidRequester, hasPaidChallenger, statusCode, winner])

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

  const contribution = useMemo(
    () =>
      amountStillRequired && MULTIPLIER_DIVISOR
        ? amountStillRequired
            .mul(
              BigNumber.from(
                Math.round(
                  contributionShare * MULTIPLIER_DIVISOR.toNumber(),
                ).toString(),
              ),
            )
            .div(MULTIPLIER_DIVISOR)
        : undefined,
    [amountStillRequired, MULTIPLIER_DIVISOR, contributionShare],
  )

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
        <SkeletonBlock $height="120px" />
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
      const shareInBasis = wei.mul(MULTIPLIER_DIVISOR).div(amountStillRequired)
      setContributionShare(
        Math.min(
          1,
          Math.max(0, shareInBasis.toNumber() / MULTIPLIER_DIVISOR.toNumber()),
        ),
      )
    } catch {
      // Not a number yet; keep the previous share.
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
                  setContributionShare(Number(event.currentTarget.value))
                }}
              />
              <Row $gap={8}>
                <TextInput
                  type="number"
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
