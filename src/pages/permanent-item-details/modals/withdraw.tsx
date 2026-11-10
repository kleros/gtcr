import React, { useState } from 'react'
import styled from 'styled-components'
import type { Address } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import _gtcr from 'assets/abis/PermanentGTCR.json'
import useNativeCurrency from 'hooks/native-currency'
import useTokenSymbol from 'hooks/token-symbol'
import { formatDuration, formatDurationLong } from 'utils/time'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { Body, Button, Label, Small, Stack } from 'components/curate/primitives'
import { WithdrawalStepper } from '../withdrawal-stepper'
import { capitalize } from '../facts'
import {
  GateHelper,
  ModalShell,
  nativeText,
  tokenText,
  useActionGate,
} from './shell'

/*
 * Start withdrawing a Stake Curate item. Nothing is deposited: the submitter
 * signs one transaction, waits the withdrawing period (during which the item
 * can still be challenged), then anyone executes the withdrawal and the stake
 * and arbitration deposit return. The three steps are drawn as the same
 * stepper the item page shows; under it, what comes back and one button.
 */

const Returned = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
`

const ReturnedFigure = styled.output`
  display: block;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(24px, 1.2vw + 16px, 30px);
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`

interface WithdrawModalProps {
  isOpen: boolean
  onCancel: () => void
  item: SubgraphItem
  registry: SubgraphRegistry
  itemName: string
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onCancel,
  item,
  registry,
  itemName,
}) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [loading, setLoading] = useState(false)
  const nativeCurrency = useNativeCurrency()
  const { symbol: tokenSymbol, decimals: tokenDecimals } = useTokenSymbol(
    registry?.token,
  )
  const gate = useActionGate('withdraw')

  const submitter = item?.submitter as string | undefined
  const isSubmitter =
    !!account &&
    !!submitter &&
    account.toLowerCase() === submitter.toLowerCase()

  const handleStartWithdraw = async () => {
    if (!item || !registry || !walletClient || !publicClient) return

    setLoading(true)

    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: registry.id as Address,
        abi: _gtcr,
        functionName: 'startWithdrawItem',
        args: [item.itemID],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) onCancel()
    } catch (err) {
      console.error('Withdrawal failed:', err)
      errorToast(parseWagmiError(err))
    } finally {
      setLoading(false)
    }
  }

  const periodSeconds = Number(registry?.withdrawingPeriod ?? Number.NaN)
  const period =
    periodSeconds > 0 ? formatDurationLong(periodSeconds) : undefined
  const stakeText = tokenText(item?.stake || 0, tokenDecimals, tokenSymbol)
  const deposit = item?.arbitrationDeposit as string | undefined
  const depositText = deposit
    ? nativeText(deposit, nativeCurrency)
    : 'the arbitration deposit'
  const returned = deposit ? `${stakeText} + ${depositText}` : stakeText

  const blocker = !gate.ready
    ? gate.blocker
    : !isSubmitter
      ? 'Only the submitter can withdraw'
      : undefined

  return (
    <ModalShell
      open={isOpen}
      title={`Withdraw ${itemName}`}
      eyebrow={capitalize(itemName)}
      onClose={onCancel}
    >
      <Stack $gap={20}>
        <Body $muted>
          Cannot be undone: the {itemName} stays challengeable for{' '}
          {period ?? 'the withdrawing period'}, and if jurors keep it, it is
          withdrawn at the ruling.
        </Body>
        <WithdrawalStepper
          stage="listed"
          label={`Withdrawal steps: you start it, wait ${period ?? 'the withdrawing period'} while it stays challengeable, then anyone executes it and ${returned} return to the submitter.`}
          notes={[
            'You, one transaction',
            periodSeconds > 0 ? formatDuration(periodSeconds) : undefined,
            'Anyone',
          ]}
        />
        <Returned>
          <Label $tone="faint">
            {period
              ? `Back to the submitter after ${period}`
              : 'Back to the submitter after the withdrawing period'}
          </Label>
          <ReturnedFigure>{returned}</ReturnedFigure>
        </Returned>
        <Stack $gap={8}>
          <Button
            type="button"
            $variant="primary"
            $block
            disabled={!!blocker || loading}
            aria-disabled={!!blocker || loading}
            title={blocker}
            onClick={handleStartWithdraw}
          >
            {loading ? 'Waiting for your wallet…' : 'Start withdrawal'}
          </Button>
          {blocker && (
            <Small $muted role="status">
              {blocker}
            </Small>
          )}
        </Stack>
        <GateHelper gate={gate} caption={false} />
      </Stack>
    </ModalShell>
  )
}

export default WithdrawModal
