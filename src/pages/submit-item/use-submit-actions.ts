import { useCallback, useEffect, useState } from 'react'
import type { ethers } from 'ethers'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { encodePacked, erc20Abi, getAddress, keccak256 } from 'viem'
import { gtcrEncode } from '@kleros/gtcr-encoder'
import { useAtlasProvider } from '@kleros/kleros-app'
import { abi as _classicGtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import _lightGtcr from 'assets/abis/LightGeneralizedTCR.json'
import _permanentGtcr from 'assets/abis/PermanentGTCR.json'
import { wagmiConfig } from 'config/wagmi'
import { resolveStashedFiles } from 'utils/resolve-stashed-files'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { errorToast, wrapWithToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import type { SubmissionValues } from './form'

/*
 * Contract plumbing lifted unchanged from the submit modals: stash → IPFS →
 * simulate → write → receipt, with the same toasts and the same notification
 * subscription. Only the UI around it is new.
 */

export type SubmitPhase = 'idle' | 'uploading' | 'wallet'
export type ResetForm = (nextState?: Record<string, unknown>) => void
export type SetFieldValue = (
  field: string,
  value: unknown,
  shouldValidate?: boolean,
) => void
export type SubmitHandler = (
  values: SubmissionValues,
  columns: Column[],
  resetForm: ResetForm,
  setFieldValue: SetFieldValue,
) => Promise<void>

const subscribeToNotifications = (
  chainId: number,
  account: `0x${string}`,
  tcrAddress: string,
  itemID: `0x${string}`,
) => {
  if (!process.env.REACT_APP_NOTIFICATIONS_API_URL) return
  fetch(
    `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${chainId}/api/subscribe`,
    {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriberAddr: getAddress(account),
        tcrAddr: getAddress(tcrAddress as `0x${string}`),
        itemID,
        networkID: chainId,
      }),
    },
  ).catch((err) => {
    console.error('Failed to subscribe for notifications.', err)
  })
}

/** Light and classic Curate: one native deposit (base + arbitration cost) with `addItem`. */
export const useDepositSubmit = ({
  kind,
  tcrAddress,
  submissionDeposit,
  onDone,
}: {
  kind: 'light' | 'classic'
  tcrAddress: string
  submissionDeposit?: ethers.BigNumber
  onDone: () => void
}) => {
  const { address: account } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  const [phase, setPhase] = useState<SubmitPhase>('idle')

  const submit = useCallback<SubmitHandler>(
    async (values, columns, resetForm, setFieldValue) => {
      if (!submissionDeposit) return
      setPhase('uploading')
      try {
        const resolvedValues = await resolveStashedFiles({
          columns,
          values,
          uploadFile,
          setFieldValue,
        })
        const value = BigInt(submissionDeposit.toString())
        const address = tcrAddress as `0x${string}`

        let itemID: `0x${string}`
        let request
        if (kind === 'light') {
          const itemFile = new File(
            [JSON.stringify({ columns, values: resolvedValues })],
            'item.json',
            { type: 'application/json' },
          )
          const ipfsEvidencePath = await uploadFile(itemFile, JSON_UPLOAD_ROLE)
          if (!ipfsEvidencePath)
            throw new Error('Failed to upload item metadata to IPFS.')
          itemID = keccak256(encodePacked(['string'], [ipfsEvidencePath]))
          setPhase('wallet')
          request = (
            await simulateContract(wagmiConfig, {
              address,
              abi: _lightGtcr,
              functionName: 'addItem',
              args: [ipfsEvidencePath],
              value,
              account,
            })
          ).request
        } else {
          const encodedParams = gtcrEncode({ columns, values: resolvedValues })
          itemID = keccak256(encodedParams as `0x${string}`)
          setPhase('wallet')
          request = (
            await simulateContract(wagmiConfig, {
              address,
              abi: _classicGtcr,
              functionName: 'addItem',
              args: [encodedParams],
              value,
              account,
            })
          ).request
        }

        const result = await wrapWithToast(
          () => walletClient!.writeContract(request),
          publicClient!,
        )

        if (result.status) {
          onDone()
          resetForm({})
          if (chainId && account)
            subscribeToNotifications(chainId, account, tcrAddress, itemID)
        }
      } catch (err) {
        console.error('Error submitting item:', err)
        errorToast(parseWagmiError(err))
      }
      setPhase('idle')
    },
    [
      account,
      chainId,
      kind,
      onDone,
      publicClient,
      submissionDeposit,
      tcrAddress,
      uploadFile,
      walletClient,
    ],
  )

  return { submit, phase, submitting: phase !== 'idle' }
}

/**
 * Stake Curate: an ERC20 stake (approve first) plus the arbitration cost in
 * native currency, with the token balance, allowance and native balance read
 * on mount and again after an approval.
 */
export const usePermanentSubmit = ({
  tcrAddress,
  tokenAddress,
  submissionDeposit,
  arbitrationCost,
  onDone,
}: {
  tcrAddress: string
  tokenAddress?: string
  submissionDeposit?: { toString: () => string }
  arbitrationCost?: { toString: () => string }
  onDone: () => void
}) => {
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { uploadFile } = useAtlasProvider()
  // Undefined until read: the page never prints a balance it did not load.
  const [balance, setBalance] = useState<bigint>()
  const [allowance, setAllowance] = useState<bigint>()
  const [nativeBalance, setNativeBalance] = useState<bigint>()
  const [checking, setChecking] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)
  const [approving, setApproving] = useState(false)
  const [phase, setPhase] = useState<SubmitPhase>('idle')

  const checkTokenStatus = useCallback(async () => {
    if (!account || !publicClient || !tokenAddress) return
    setChecking(true)
    setCheckFailed(false)
    try {
      const [bal, allow, nativeBal] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, tcrAddress as `0x${string}`],
        }),
        publicClient.getBalance({ address: account }),
      ])
      setBalance(bal)
      setAllowance(allow)
      setNativeBalance(nativeBal)
    } catch (err) {
      console.error('Error checking token status:', err)
      setCheckFailed(true)
    }
    setChecking(false)
  }, [account, publicClient, tokenAddress, tcrAddress])

  useEffect(() => {
    checkTokenStatus()
  }, [checkTokenStatus])

  const approve = useCallback(async () => {
    if (!submissionDeposit) return
    setApproving(true)
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [
          tcrAddress as `0x${string}`,
          BigInt(submissionDeposit.toString()),
        ],
        account,
      })

      const result = await wrapWithToast(
        () => walletClient!.writeContract(request),
        publicClient!,
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
    setApproving(false)
  }, [
    tokenAddress,
    tcrAddress,
    submissionDeposit,
    checkTokenStatus,
    account,
    walletClient,
    publicClient,
  ])

  const submit = useCallback<SubmitHandler>(
    async (values, columns, resetForm, setFieldValue) => {
      if (!submissionDeposit) return
      setPhase('uploading')
      try {
        const resolvedValues = await resolveStashedFiles({
          columns,
          values,
          uploadFile,
          setFieldValue,
        })

        const itemFile = new File(
          [JSON.stringify({ columns, values: resolvedValues })],
          'item.json',
          { type: 'application/json' },
        )
        const ipfsEvidencePath = await uploadFile(itemFile, JSON_UPLOAD_ROLE)
        if (!ipfsEvidencePath)
          throw new Error('Failed to upload item metadata to IPFS.')

        setPhase('wallet')
        const { request } = await simulateContract(wagmiConfig, {
          address: tcrAddress as `0x${string}`,
          abi: _permanentGtcr,
          functionName: 'addItem',
          args: [ipfsEvidencePath, BigInt(submissionDeposit.toString())],
          value: BigInt((arbitrationCost || 0).toString()),
          account,
        })

        const result = await wrapWithToast(
          () => walletClient!.writeContract(request),
          publicClient!,
        )

        if (result.status) {
          onDone()
          resetForm({})
        }
      } catch (err) {
        console.error('Error submitting item:', err)
        errorToast(parseWagmiError(err))
      }
      setPhase('idle')
    },
    [
      onDone,
      submissionDeposit,
      tcrAddress,
      arbitrationCost,
      account,
      walletClient,
      publicClient,
      uploadFile,
    ],
  )

  return {
    submit,
    approve,
    recheck: checkTokenStatus,
    phase,
    submitting: phase !== 'idle',
    approving,
    checking,
    checkFailed,
    balance,
    allowance,
    nativeBalance,
  }
}
