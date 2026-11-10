import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { BigNumber } from 'ethers'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { erc20Abi, getAddress } from 'viem'
import { useAtlasProvider } from '@kleros/kleros-app'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import ListingCriteriaLink from 'components/listing-criteria-link'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import { uploadEvidence } from 'utils/upload-evidence'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { Body, Button, Small, Stack } from 'components/curate/primitives'
import { WhatHappensNext } from 'components/curate/what-happens-next'
import {
  DialogColumns,
  FormBlock,
  GateHelper,
  ModalShell,
  ModalSkeleton,
  MULTIPLIER_DIVISOR,
  PolicyText,
  StepRow,
  applyMultiplier,
  nativeText,
  tokenText,
  useActionGate,
} from './shell'

const capitalize = (text: string) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text

/*
 * Challenge a Stake Curate item. The challenger stakes a share of the item's
 * stake in the list's ERC20 token (approve first) and pays the native
 * arbitration cost that opens the dispute. What each side can win or lose is
 * spelled out before anything is signed.
 */

interface ChallengeModalProps {
  item: SubgraphItem
  itemName?: string
  onCancel: () => void
  arbitrationCost?: BigNumber
  visible?: boolean
  title?: React.ReactNode
  [key: string]: unknown
}

const ChallengeModal = ({
  item,
  itemName,
  onCancel,
  arbitrationCost,
  visible = false,
  title,
}: ChallengeModalProps) => {
  const registry = item.registry
  const registryAddress = registry?.id
  const tokenAddress = registry?.token
  const fileURI = registry?.arbitrationSettings?.[0]?.metadata?.policyURI
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const nativeCurrency = useNativeCurrency()
  const gate = useActionGate('challenge', { needsSignIn: true })
  // Per-instance form id: the list page mounts the same modal.
  const formId = useId()

  const [balance, setBalance] = useState(0n)
  const [allowance, setAllowance] = useState(0n)
  const [nativeBalance, setNativeBalance] = useState<bigint>()
  const [multiplierDivisor, setMultiplierDivisor] = useState<bigint>()
  const [checkingToken, setCheckingToken] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isChallenging, setIsChallenging] = useState(false)
  const { symbol: tokenSymbol, decimals: tokenDecimals } =
    useTokenSymbol(tokenAddress)

  const name = itemName || 'item'

  const challengeStake = useMemo(
    () =>
      applyMultiplier(
        item.stake || 0,
        registry?.challengeStakeMultiplier,
        multiplierDivisor ?? MULTIPLIER_DIVISOR,
      ),
    [item.stake, multiplierDivisor, registry?.challengeStakeMultiplier],
  )
  const arbitrationWei = BigInt((arbitrationCost || 0).toString())

  const checkTokenStatus = useCallback(async () => {
    if (!account || !publicClient || !tokenAddress || !registryAddress) return

    setCheckingToken(true)
    try {
      const [bal, allow, nativeBal, divisor] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, registryAddress],
        }),
        publicClient.getBalance({ address: account }),
        publicClient.readContract({
          address: registryAddress,
          abi: _gtcr,
          functionName: 'MULTIPLIER_DIVISOR',
        }),
      ])
      setBalance(bal)
      setAllowance(allow)
      setNativeBalance(nativeBal)
      setMultiplierDivisor(BigInt(String(divisor)))
    } catch (err) {
      console.error('Error checking token status:', err)
    }
    setCheckingToken(false)
  }, [account, publicClient, tokenAddress, registryAddress])

  useEffect(() => {
    checkTokenStatus()
  }, [checkTokenStatus])

  // Reset loading states when the modal unmounts.
  useEffect(
    () => () => {
      setIsApproving(false)
      setIsChallenging(false)
    },
    [],
  )

  const handleApprove = useCallback(async () => {
    if (
      !account ||
      !walletClient ||
      !publicClient ||
      !tokenAddress ||
      !registryAddress
    )
      return
    setIsApproving(true)
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [registryAddress, challengeStake],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) {
        await checkTokenStatus()
        setTimeout(async () => {
          await checkTokenStatus()
        }, 5000)
      }
    } catch (err) {
      console.error('Error approving token:', err)
      errorToast(parseWagmiError(err))
    }
    setIsApproving(false)
  }, [
    tokenAddress,
    registryAddress,
    challengeStake,
    checkTokenStatus,
    account,
    walletClient,
    publicClient,
  ])

  const challengeRequest = async ({
    title: evidenceTitle,
    description,
    evidenceAttachment,
  }: EvidenceFormValues) => {
    if (
      !account ||
      !walletClient ||
      !publicClient ||
      !registryAddress ||
      !arbitrationCost
    )
      return
    setIsChallenging(true)
    try {
      const ipfsEvidencePath = await uploadEvidence({
        title: evidenceTitle || 'Challenge justification',
        description: description ?? '',
        attachment: evidenceAttachment,
        uploadFile,
      })

      const { request } = await simulateContract(wagmiConfig, {
        address: registryAddress,
        abi: _gtcr,
        functionName: 'challengeItem',
        args: [item.itemID, ipfsEvidencePath],
        value: BigInt(arbitrationCost.toString()),
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
                tcrAddr: getAddress(registryAddress),
                itemID: item.itemID,
                networkID: chainId,
              }),
            },
          ).catch((err) => {
            console.error('Failed to subscribe for notifications.', err)
          })
      }
    } catch (err) {
      console.error('Error challenging item:', err)
      errorToast(parseWagmiError(err))
    }
    setIsChallenging(false)
  }

  const close = () => {
    setIsApproving(false)
    setIsChallenging(false)
    onCancel()
  }

  const confirm = () => {
    // useId ids hold colons, so the selector is escaped.
    const form = document.querySelector(`#${CSS.escape(formId)}`)
    if (form instanceof HTMLFormElement) form.requestSubmit()
  }

  const hasEnoughBalance = balance >= challengeStake
  const hasEnoughAllowance = allowance >= challengeStake
  const hasEnoughNativeBalance =
    nativeBalance !== undefined && nativeBalance >= arbitrationWei

  const stakeText = tokenText(challengeStake, tokenDecimals, tokenSymbol)
  const costText = nativeText(arbitrationWei, nativeCurrency)
  const itemStakeText = tokenText(item.stake || 0, tokenDecimals, tokenSymbol)
  const itemDeposit = item.arbitrationDeposit as string | undefined
  const depositText = itemDeposit
    ? nativeText(itemDeposit, nativeCurrency)
    : 'its arbitration deposit'
  const halfDepositText = itemDeposit
    ? nativeText(BigInt(itemDeposit) / 2n, nativeCurrency)
    : 'half of its arbitration deposit'

  const blocker = !gate.ready
    ? gate.blocker
    : checkingToken
      ? 'Checking balances'
      : !hasEnoughBalance
        ? `Not enough ${tokenSymbol}: you hold ${tokenText(balance, tokenDecimals, tokenSymbol)}`
        : !hasEnoughNativeBalance
          ? `Not enough ${nativeCurrency} for the arbitration cost`
          : !hasEnoughAllowance
            ? `Approve ${tokenSymbol} first`
            : undefined
  const showApprove =
    gate.ready && !checkingToken && hasEnoughBalance && !hasEnoughAllowance

  return (
    <ModalShell
      open={visible}
      title={title ?? `Challenge ${name}`}
      eyebrow={capitalize(name)}
      onClose={close}
      width="lg"
    >
      {arbitrationCost ? (
        <DialogColumns>
          <Stack $gap={16}>
            <Body>
              Tell the jurors why this {name} breaks the{' '}
              <ListingCriteriaLink fileURI={fileURI}>
                <PolicyText as="span">listing policy</PolicyText>
              </ListingCriteriaLink>
              . Your justification is published as evidence.
            </Body>
            <FormBlock>
              <EvidenceForm onSubmit={challengeRequest} formID={formId} />
            </FormBlock>
          </Stack>

          <Stack $gap={12}>
            {showApprove && (
              <StepRow>
                <Small>
                  Step 1 of 2 · Allow the list to lock your {tokenSymbol} stake.
                  One transaction, then the challenge itself.
                </Small>
                <Button
                  type="button"
                  $variant="primary"
                  $size="sm"
                  $block
                  disabled={isApproving}
                  onClick={handleApprove}
                >
                  {isApproving
                    ? 'Waiting for your wallet…'
                    : `Approve ${stakeText}`}
                </Button>
              </StepRow>
            )}
            {gate.ready && hasEnoughAllowance && (
              <Small $muted role="status">
                {tokenSymbol} approved. Step 2 of 2 stakes it and opens the
                dispute.
              </Small>
            )}

            <WhatHappensNext
              receipt={[
                { label: 'Challenge stake', value: stakeText },
                { label: 'Arbitration cost', value: costText },
              ]}
              total={`${stakeText} + ${costText}`}
              steps={[
                {
                  title: 'You stake and pay the arbitration cost',
                  body: `${stakeText} is locked as your stake and ${costText} pays the jurors. The ${name} becomes Disputed at once.`,
                },
                {
                  title: 'Jurors decide',
                  body: 'Both sides can add evidence while the case runs. A ruling can be appealed by funding the next round.',
                },
                {
                  title: 'Jurors agree: you earn the stake',
                  body: `You receive the ${name}'s stake of ${itemStakeText}, your ${stakeText} back and ${depositText}. The ${name} leaves the list.`,
                },
                {
                  title: `Jurors keep the ${name}`,
                  branch: true,
                  body: `Your ${stakeText} is added to the ${name}'s stake and the ${costText} is not returned. The ${name} stays listed.`,
                },
                {
                  title: 'Jurors refuse to rule',
                  branch: true,
                  body: `Your ${stakeText} comes back, you receive ${halfDepositText}, and the ${name} is withdrawn from the list.`,
                },
              ]}
              confirmLabel={`Challenge ${name}`}
              onConfirm={confirm}
              confirmDisabled={Boolean(blocker)}
              confirmBlocker={blocker}
              loading={isChallenging}
            />
            <GateHelper gate={gate} caption={false} />
          </Stack>
        </DialogColumns>
      ) : (
        <ModalSkeleton />
      )}
    </ModalShell>
  )
}

export default ChallengeModal
