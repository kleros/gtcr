import React, { useMemo, useState } from 'react'
import styled from 'styled-components'
import { ethers, BigNumber } from 'ethers'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import ListingCriteriaLink from 'components/listing-criteria-link'
import useNativeCurrency from 'hooks/native-currency'
import useNativeBalance from 'hooks/use-native-balance'
import useRequiredFees from 'hooks/required-fees'
import {
  PARTY,
  STATUS_CODE,
  SUBGRAPH_RULING,
} from 'utils/permanent-item-status'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import {
  Body,
  ChipButton,
  Label,
  Row,
  Small,
  Stack,
  TextInput,
} from 'components/curate/primitives'
import { WhatHappensNext } from 'components/curate/what-happens-next'
import {
  DialogColumns,
  GateHelper,
  ModalShell,
  ModalSkeleton,
  PolicyText,
  nativeText,
  useActionGate,
} from './shell'

/*
 * Fund one side of an appeal on a Stake Curate dispute. Contributions are in
 * the chain's native currency; backers of the side that wins the next round
 * get their money back plus a share of the other side's funding.
 */

const { formatEther, parseEther } = ethers.utils

const MULTIPLIER_DIVISOR = 10_000

const Range = styled.input`
  width: 100%;
  accent-color: var(--color-primary);
`

/* The amount in the field, the currency as a suffix inside it. */
const AmountField = styled.div`
  position: relative;

  input {
    padding-right: 72px;
    font-variant-numeric: tabular-nums;
  }

  span {
    position: absolute;
    top: 50%;
    right: 14px;
    color: var(--color-faint);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
    transform: translateY(-50%);
    pointer-events: none;
  }
`

/* The side being funded: how much of its fee is raised so far. */
const SideBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
`

const SideShare = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 26px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
`

const Track = styled.div`
  position: relative;
  height: 10px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: repeating-linear-gradient(
    135deg,
    var(--color-surface) 0 3px,
    transparent 3px 7px
  );
  box-shadow: inset 0 0 0 1px var(--glass-border);

  span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: var(--radius-pill);
    background: var(--status-contested);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--status-contested) 55%, transparent);
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

const toBigNumber = (value: unknown): BigNumber | undefined =>
  value === null || value === undefined
    ? undefined
    : BigNumber.from(String(value))

const capitalize = (text: string) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text

const sideName = (side: number) =>
  side === PARTY.REQUESTER ? 'submitter' : 'challenger'

const CrowdfundModal = ({
  statusCode,
  item,
  fileURI,
  appealCost,
  onCancel,
  visible = false,
  title,
}: CrowdfundModalProps) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const registry = item?.registry
  const tcrAddress = registry?.id
  const sharedStakeMultiplier = toBigNumber(registry?.sharedStakeMultiplier)
  const winnerStakeMultiplier = toBigNumber(registry?.winnerStakeMultiplier)
  const loserStakeMultiplier = toBigNumber(registry?.loserStakeMultiplier)

  const [contributionShare, setContributionShare] = useState(1)
  // What the amount field shows while being typed; null follows the slider.
  const [contributionInput, setContributionInput] = useState<string | null>(
    null,
  )
  const [userSelectedSide, setUserSelectedSide] = useState<number>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nativeCurrency = useNativeCurrency()
  const { balance: nativeBalance } = useNativeBalance()
  const gate = useActionGate('fund an appeal')

  const round = item.challenges?.[0]?.rounds?.[0]
  const {
    hasPaidRequester = false,
    hasPaidChallenger = false,
    ruling,
    amountPaidRequester,
    amountPaidChallenger,
  } = round ?? {}

  const winner =
    ruling === SUBGRAPH_RULING.ACCEPT ? PARTY.REQUESTER : PARTY.CHALLENGER

  // Once one side is fully funded only the other can be funded (the
  // contract refuses a second contribution to a funded side), whatever the
  // ruling.
  const autoSelectedSide = useMemo(() => {
    if (
      (hasPaidRequester && hasPaidChallenger) ||
      (!hasPaidRequester && !hasPaidChallenger)
    )
      return PARTY.NONE

    if (
      ruling !== SUBGRAPH_RULING.NONE &&
      statusCode === STATUS_CODE.CROWDFUNDING_WINNER
    )
      return winner

    return hasPaidRequester ? PARTY.CHALLENGER : PARTY.REQUESTER
  }, [ruling, hasPaidRequester, hasPaidChallenger, statusCode, winner])

  const side = userSelectedSide ?? autoSelectedSide
  const canPickSide =
    (ruling === SUBGRAPH_RULING.NONE ||
      statusCode === STATUS_CODE.CROWDFUNDING) &&
    autoSelectedSide === PARTY.NONE

  const { requiredForSide, amountStillRequired, potentialReward } =
    useRequiredFees({
      side,
      sharedStakeMultiplier,
      winnerStakeMultiplier,
      loserStakeMultiplier,
      item,
      MULTIPLIER_DIVISOR: BigNumber.from(MULTIPLIER_DIVISOR),
      appealCost,
    })

  const close = () => onCancel()

  if (!sharedStakeMultiplier || !round)
    return (
      <ModalShell
        open={visible}
        title={title ?? 'Fund an appeal'}
        eyebrow="Contribute appeal fees"
        onClose={close}
      >
        <ModalSkeleton />
      </ModalShell>
    )

  const sidePaid = (party: number) =>
    BigNumber.from(
      String(
        party === PARTY.REQUESTER
          ? (amountPaidRequester ?? 0)
          : (amountPaidChallenger ?? 0),
      ),
    )

  const pickSide = (
    <Stack $gap={12}>
      <Body>
        {ruling === SUBGRAPH_RULING.NONE
          ? 'The jurors did not give a decisive ruling. Whichever side you fund, the other must fund too or lose the dispute.'
          : 'Pick the side you want to back.'}
      </Body>
      <Row $gap={8} $wrap>
        {[PARTY.REQUESTER, PARTY.CHALLENGER].map((party) => (
          <ChipButton
            key={party}
            type="button"
            $selected={userSelectedSide === party}
            onClick={() => setUserSelectedSide(party)}
          >
            {sideName(party)}
          </ChipButton>
        ))}
      </Row>
    </Stack>
  )

  if (side === PARTY.NONE || !requiredForSide || !amountStillRequired)
    return (
      <ModalShell
        open={visible}
        title={title ?? 'Fund an appeal'}
        eyebrow="Contribute appeal fees"
        onClose={close}
      >
        {canPickSide ? (
          pickSide
        ) : (
          <Body $muted>There is nothing to fund on this round right now.</Body>
        )}
      </ModalShell>
    )

  const contribution = amountStillRequired
    .mul(BigNumber.from(Math.round(contributionShare * MULTIPLIER_DIVISOR)))
    .div(MULTIPLIER_DIVISOR)
  const reward = (potentialReward ?? BigNumber.from(0))
    .mul(BigNumber.from(Math.ceil(contributionShare * MULTIPLIER_DIVISOR) || 1))
    .div(MULTIPLIER_DIVISOR)
  const insufficientBalance =
    nativeBalance !== undefined &&
    nativeBalance < BigInt(contribution.toString())
  const amountPaid = sidePaid(side)
  const stillNeededNumber = Number(formatEther(amountStillRequired))

  const crowdfundSide = async () => {
    if (!walletClient || !publicClient || !tcrAddress) return
    setIsSubmitting(true)
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: tcrAddress,
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
      console.error('Error contributing fees:', err)
      errorToast(parseWagmiError(err))
    }
    setIsSubmitting(false)
  }

  const blocker = !gate.ready
    ? gate.blocker
    : contribution.isZero()
      ? 'Choose an amount above zero'
      : insufficientBalance
        ? `Not enough ${nativeCurrency}`
        : undefined

  const contributionText = nativeText(contribution, nativeCurrency)
  const name = sideName(side)

  const fundedShare = requiredForSide.isZero()
    ? 0
    : amountPaid.mul(MULTIPLIER_DIVISOR).div(requiredForSide).toNumber() /
      MULTIPLIER_DIVISOR

  return (
    <ModalShell
      open={visible}
      title={title ?? `Fund the ${name}'s appeal`}
      eyebrow="Contribute appeal fees"
      onClose={close}
      width="lg"
    >
      <DialogColumns>
        <Stack $gap={16}>
          {canPickSide && pickSide}
          <SideBlock
            role="group"
            aria-label={`${capitalize(name)} side: ${Math.round(fundedShare * 100)}% of its appeal fee raised, ${nativeText(amountPaid, nativeCurrency)} of ${nativeText(requiredForSide, nativeCurrency)}`}
          >
            <Row $justify="space-between" $gap={12} $align="baseline">
              <Label>{name} side</Label>
              <SideShare>{Math.round(fundedShare * 100)}%</SideShare>
            </Row>
            <Track aria-hidden>
              <span
                style={{
                  width: `${Math.round(Math.min(1, Math.max(0, fundedShare)) * 100)}%`,
                }}
              />
            </Track>
            <Small $muted>
              {nativeText(amountPaid, nativeCurrency)} of{' '}
              {nativeText(requiredForSide, nativeCurrency)} raised · still
              needed {nativeText(amountStillRequired, nativeCurrency)}
            </Small>
          </SideBlock>

          <Stack $gap={8}>
            <Label>Your contribution</Label>
            <Range
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={contributionShare}
              aria-label="Share of the amount still needed"
              onChange={(event) => {
                setContributionShare(Number(event.target.value))
                setContributionInput(null)
              }}
            />
            <AmountField>
              <TextInput
                type="number"
                min={0}
                max={stillNeededNumber}
                step={0.01}
                value={
                  contributionInput ??
                  (contributionShare * stillNeededNumber).toFixed(4)
                }
                aria-label={`Contribution in ${nativeCurrency}`}
                onChange={(event) => {
                  // The field keeps what was typed; the share follows only
                  // once the text parses, so "0." is not rewritten mid-entry.
                  setContributionInput(event.target.value)
                  const raw = Number(event.target.value)
                  if (event.target.value === '' || !Number.isFinite(raw)) return
                  if (raw < 0) return
                  try {
                    const weiAmount = parseEther(
                      Math.min(raw, stillNeededNumber).toString(),
                    )
                    const shareInBasis = weiAmount
                      .mul(MULTIPLIER_DIVISOR)
                      .div(amountStillRequired)
                    setContributionShare(
                      shareInBasis.toNumber() / MULTIPLIER_DIVISOR,
                    )
                  } catch {
                    // Partial input is kept as typed until it parses.
                  }
                }}
                onBlur={() => setContributionInput(null)}
              />
              <span aria-hidden>{nativeCurrency}</span>
            </AmountField>
          </Stack>
        </Stack>

        <Stack $gap={12}>
          <WhatHappensNext
            receipt={[
              {
                label: `Required for the ${name}`,
                value: nativeText(requiredForSide, nativeCurrency),
              },
              {
                label: 'Already funded',
                value: nativeText(amountPaid, nativeCurrency),
              },
            ]}
            total={contributionText}
            steps={[
              {
                title: `You fund the ${name}'s side`,
                body: `${contributionText} counts toward the ${nativeText(amountStillRequired, nativeCurrency)} still needed before the appeal deadline.`,
              },
              {
                title: `The ${name} wins the next round`,
                body: `You get your ${contributionText} back plus a share of the other side's funding: up to ${nativeText(reward, nativeCurrency)} for this contribution.`,
              },
              {
                title: `The ${name} loses the next round`,
                branch: true,
                body: 'Your contribution goes to the backers of the winning side.',
              },
              {
                title: 'Only one side is fully funded',
                branch: true,
                body: 'That side wins without a new round, whatever the current ruling. Every contribution to this round, on either side, can be withdrawn after the ruling.',
              },
              {
                title: 'Neither side is fully funded',
                branch: true,
                body: 'The current ruling stands. Every contribution to this round can be withdrawn after the ruling.',
              },
            ]}
            confirmLabel={`Fund the ${name}`}
            onConfirm={crowdfundSide}
            confirmDisabled={Boolean(blocker)}
            confirmBlocker={blocker}
            loading={isSubmitting}
            policy={
              fileURI ? (
                <>
                  Jurors decide against the{' '}
                  <ListingCriteriaLink fileURI={fileURI}>
                    <PolicyText as="span">listing policy</PolicyText>
                  </ListingCriteriaLink>
                  .
                </>
              ) : undefined
            }
          />
          <GateHelper gate={gate} caption={false} />
        </Stack>
      </DialogColumns>
    </ModalShell>
  )
}

export default CrowdfundModal
