import React, { useCallback, useContext, useEffect, useState } from 'react'
import styled from 'styled-components'
import { useAccount, usePublicClient } from 'wagmi'
import { simulateContract, writeContract } from '@wagmi/core'
import { BigNumber } from 'ethers'
import { BatchWithdrawABI } from 'utils/abis/batch-withdraw'
import useUrlChainId from 'hooks/use-url-chain-id'
import useNativeCurrency from 'hooks/native-currency'
import { StandardTCRViewContext } from 'contexts/standard-tcr-view-context'
import { standardBatchWithdrawAddresses } from 'config/tcr-addresses'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import { Button, Row, Small, Stack } from './primitives'
import { formatAmount } from './item-standard-format'
import { useActionGate } from './item-standard-gate'
import { sendPhaseLabel, type SendPhase } from './what-happens-next'

/*
 * Fee rewards on a Standard entry: what the connected account contributed
 * to appeals it was on the winning side of, claimed through the list's
 * batch withdrawer. It belongs with the entry's own data, so it closes the
 * submission panel.
 *
 * Gated like Execute: the batch withdrawer is on the list's chain, so the
 * wallet must be connected there (the button offers the switch and names
 * the blocker). Busy until the transaction settles, so a second click
 * cannot send a second one. The figure is read only while an account is
 * connected, and goes as soon as it changes, so it is never offered to the
 * next one.
 */

/* Its own hairline: the panel around it draws none, so an entry with
   nothing to claim leaves no empty line behind. */
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
`

/** The list's view contract, the only thing that knows the balance. */
interface RewardView {
  gtcrView?: {
    availableRewards: (...args: unknown[]) => Promise<BigNumber>
  }
  tcrAddress?: string
}

/**
 * The claim itself, mounted only while there is something to withdraw, so
 * the gate's balance read costs nothing on every other entry.
 */
const WithdrawRewards = ({
  amount,
  phase,
  onWithdraw,
}: {
  amount: string
  /** Where the withdrawal is while it is being sent. */
  phase?: SendPhase
  onWithdraw: () => void
}) => {
  const gate = useActionGate({ verb: 'withdraw rewards', needsAuth: false })
  const busy = !!phase
  return (
    <Actions>
      <Stack $gap={8}>
        <Row $gap={8} $wrap>
          <Button
            type="button"
            $variant="primary"
            $size="sm"
            disabled={!gate.ready || busy}
            aria-disabled={!gate.ready || busy}
            title={gate.ready ? undefined : gate.blocker}
            onClick={onWithdraw}
          >
            {busy ? sendPhaseLabel(phase) : `Withdraw rewards · ${amount}`}
          </Button>
          {gate.controls}
        </Row>
        {gate.blocker && (
          <Small $muted role="status">
            {gate.blocker}
          </Small>
        )}
      </Stack>
    </Actions>
  )
}

export const ItemRewardWithdrawal = ({ item }: { item?: SubgraphItem }) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const view = useContext(StandardTCRViewContext) as RewardView | undefined
  const [availableRewards, setAvailableRewards] = useState<BigNumber>()
  const [withdrawing, setWithdrawing] = useState<SendPhase>()
  const urlChainId = useUrlChainId()
  const nativeCurrency = useNativeCurrency()
  // batchRequestWithdraw walks the requests from the first one, and the list
  // contract reverts a withdrawal from a request still under dispute. While
  // the latest request is open the walk stops before it (_count is where the
  // walk ends); the view's availableRewards counts the same resolved
  // requests. 0 walks them all, as before.
  const withdrawCount = item?.resolved
    ? 0
    : Math.max(0, (item?.requests?.length ?? 0) - 1)
  // The batch withdrawer of the list's chain (the URL's), not the wallet's.
  // A chain without one gets no button rather than one that does nothing.
  const batchWithdrawAddress = urlChainId
    ? standardBatchWithdrawAddresses[urlChainId]
    : undefined

  // The figure is the connected account's: it goes as soon as the account
  // changes or disconnects, never offered to the next one.
  useEffect(() => setAvailableRewards(undefined), [account])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!view?.gtcrView || !account || !item) return
      try {
        const rewards = await view.gtcrView.availableRewards(
          view.tcrAddress,
          item.itemID,
          account,
        )
        if (!cancelled) setAvailableRewards(rewards)
      } catch (err) {
        console.error('Could not read the available rewards', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [account, item, view])

  const withdraw = useCallback(async () => {
    if (
      !view?.tcrAddress ||
      !account ||
      !batchWithdrawAddress ||
      !urlChainId ||
      !item ||
      !publicClient
    )
      return

    setWithdrawing('wallet')
    try {
      // Simulated on the list's chain; writeContract refuses to send while
      // the wallet is on another one (the button's gate asks to switch).
      const { request } = await simulateContract(wagmiConfig, {
        address: batchWithdrawAddress as `0x${string}`,
        abi: BatchWithdrawABI,
        functionName: 'batchRequestWithdraw',
        args: [
          view.tcrAddress as `0x${string}`,
          account,
          item.itemID as `0x${string}`,
          0n,
          BigInt(withdrawCount),
          0n,
          0n,
        ],
        account,
        chainId: urlChainId,
      })

      const result = await wrapWithToast(
        () =>
          writeContract(wagmiConfig, request).then((hash) => {
            setWithdrawing('mining')
            return hash
          }),
        publicClient,
      )

      if (result.status && view.gtcrView)
        setAvailableRewards(
          await view.gtcrView.availableRewards(
            view.tcrAddress,
            item.itemID,
            account,
          ),
        )
    } catch (err) {
      console.error('Error withdrawing rewards:', err)
      errorToast(parseWagmiError(err))
    }
    setWithdrawing(undefined)
  }, [
    account,
    batchWithdrawAddress,
    item,
    publicClient,
    urlChainId,
    view,
    withdrawCount,
  ])

  const withdrawable =
    !!batchWithdrawAddress &&
    !!item &&
    (!!item.resolved || withdrawCount > 0) &&
    !!availableRewards &&
    availableRewards.gt(BigNumber.from(0))
  // Rewards do not depend on the entry's data, so an entry that cannot be
  // decoded still offers them.
  if (!withdrawable) return null

  return (
    <WithdrawRewards
      amount={formatAmount(availableRewards, nativeCurrency)}
      phase={withdrawing}
      onWithdraw={() => void withdraw()}
    />
  )
}

export default ItemRewardWithdrawal
