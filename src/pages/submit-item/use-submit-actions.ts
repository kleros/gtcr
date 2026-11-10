import { useCallback, useEffect, useState } from 'react'
import type { ethers } from 'ethers'
import { useAccount, usePublicClient } from 'wagmi'
import { simulateContract, writeContract } from '@wagmi/core'
import {
  decodeEventLog,
  encodePacked,
  erc20Abi,
  keccak256,
  type Abi,
  type TransactionReceipt,
} from 'viem'
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
import { encoderValues, type SubmissionValues } from './form'
import { useTxChainId } from './use-wallet-gate'

/**
 * The submitted entry's ID, read from the list's own ItemStatusChange event
 * in the receipt (every kind of list emits it with the ID first), so the
 * page can open the new entry. Undefined if the receipt does not say.
 */
const itemIdFromReceipt = (
  receipt: TransactionReceipt | undefined,
  list: string,
  abi: Abi,
): `0x${string}` | undefined => {
  for (const log of receipt?.logs ?? []) {
    if (log.address.toLowerCase() !== list.toLowerCase()) continue
    try {
      const event = decodeEventLog({ abi, data: log.data, topics: log.topics })
      if (event.eventName === 'ItemStatusChange')
        return (event.args as unknown as { _itemID: `0x${string}` })._itemID
    } catch {
      // Not one of the list's events.
    }
  }
  return undefined
}

/*
 * Contract plumbing lifted from the submit modals: stash → IPFS → simulate →
 * write → receipt, with the same toasts and the same notification
 * subscription. Two safeguards on top: every call is simulated on the URL's
 * chain and sent with wagmi's writeContract for that chain, which refuses to
 * send while the wallet is elsewhere; and Classic boolean columns are
 * encoded as booleans (the encoder reads the string "false" as true).
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
  /** Called with the new entry's ID once the submission is confirmed. */
  onDone: (itemID?: `0x${string}`) => void
}) => {
  const { address: account } = useAccount()
  const chainId = useTxChainId()
  const publicClient = usePublicClient()
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
        let send: () => Promise<`0x${string}`>
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
          const { request } = await simulateContract(wagmiConfig, {
            address,
            abi: _lightGtcr,
            functionName: 'addItem',
            args: [ipfsEvidencePath],
            value,
            account,
            chainId,
          })
          send = () => writeContract(wagmiConfig, request)
        } else {
          const encodedParams = gtcrEncode({
            columns,
            values: encoderValues(columns, resolvedValues),
          })
          itemID = keccak256(encodedParams as `0x${string}`)
          setPhase('wallet')
          const { request } = await simulateContract(wagmiConfig, {
            address,
            abi: _classicGtcr,
            functionName: 'addItem',
            args: [encodedParams],
            value,
            account,
            chainId,
          })
          send = () => writeContract(wagmiConfig, request)
        }

        const result = await wrapWithToast(send, publicClient!)

        if (result.status) {
          onDone(
            itemIdFromReceipt(
              result.result,
              address,
              (kind === 'light' ? _lightGtcr : _classicGtcr) as Abi,
            ) ?? itemID,
          )
          resetForm({})
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
  /** Called with the new entry's ID once the submission is confirmed. */
  onDone: (itemID?: `0x${string}`) => void
}) => {
  const { address: account } = useAccount()
  const chainId = useTxChainId()
  const publicClient = usePublicClient()
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
        chainId,
      })

      const result = await wrapWithToast(
        () => writeContract(wagmiConfig, request),
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
    chainId,
    publicClient,
  ])

  const submit = useCallback<SubmitHandler>(
    async (values, columns, resetForm, setFieldValue) => {
      // The arbitration deposit is the native value: never send it as 0.
      if (!submissionDeposit || !arbitrationCost) return
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
          value: BigInt(arbitrationCost.toString()),
          account,
          chainId,
        })

        const result = await wrapWithToast(
          () => writeContract(wagmiConfig, request),
          publicClient!,
        )

        if (result.status) {
          onDone(
            itemIdFromReceipt(result.result, tcrAddress, _permanentGtcr as Abi),
          )
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
      chainId,
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
