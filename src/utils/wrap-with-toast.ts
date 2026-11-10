import React from 'react'
import { toast, type ToastPosition } from 'react-toastify'
import type { TransactionReceipt, Hash } from 'viem'
import { parseWagmiError } from './parse-wagmi-error'
import { getTxPage } from './network-utils'
import { emitTxConfirmed } from './tx-events'

/**
 * Minimal structural surface of a viem/wagmi public client. Declared as a
 * method so chain-specific client generics stay assignable (bivariance).
 * `chain` names the explorer to link to.
 */
export interface TransactionReceiptClient {
  chain?: { id: number }
  waitForTransactionReceipt(args: {
    hash: Hash
    confirmations?: number
  }): Promise<TransactionReceipt>
}

export const OPTIONS = {
  position: 'top-center' as ToastPosition,
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
}

export const ERROR_OPTIONS = {
  ...OPTIONS,
  autoClose: false as const,
}

export type WrapWithToastReturnType = {
  status: boolean
  result?: TransactionReceipt
}

export const infoToast = (message: string) => toast.info(message, OPTIONS)
export const successToast = (message: string) => toast.success(message, OPTIONS)
export const errorToast = (message: string) =>
  toast.error(message, ERROR_OPTIONS)

const REJECTION =
  /user (rejected|denied|cancell?ed)|rejected the request|request rejected|denied transaction signature/i

/** The wallet's owner declined the request (EIP-1193 error 4001). */
export const isUserRejection = (error: unknown): boolean => {
  let current = error as
    | {
        code?: unknown
        name?: unknown
        message?: unknown
        shortMessage?: unknown
        cause?: unknown
      }
    | undefined
  for (let depth = 0; current && depth < 8; depth++) {
    if (current.code === 4001 || current.name === 'UserRejectedRequestError')
      return true
    const text = `${current.shortMessage ?? ''} ${current.message ?? ''}`
    if (REJECTION.test(text)) return true
    current = current.cause as typeof current
  }
  return false
}

/** A line of toast text, with the transaction on the chain's explorer. */
const withExplorerLink = (text: string, chainId?: number, hash?: Hash) =>
  chainId && hash
    ? React.createElement(
        'span',
        null,
        text,
        ' ',
        React.createElement(
          'a',
          {
            href: getTxPage({ networkId: chainId, txHash: hash }),
            target: '_blank',
            rel: 'noopener noreferrer',
            style: { textDecoration: 'underline' },
          },
          'View on explorer',
        ),
      )
    : text

/**
 * Sends a transaction and follows it in one toast: confirm in the wallet,
 * sent (with an explorer link), then confirmed or failed. A request the
 * wallet's owner declines closes quietly; it is not an error.
 */
export async function wrapWithToast(
  contractWrite: () => Promise<Hash>,
  publicClient: TransactionReceiptClient,
): Promise<WrapWithToastReturnType> {
  const id = toast.info('Confirm the transaction in your wallet.', {
    ...OPTIONS,
    autoClose: false,
  })
  const chainId = publicClient.chain?.id
  let hash: Hash | undefined

  try {
    hash = await contractWrite()
    toast.update(id, {
      render: withExplorerLink(
        'Transaction sent. Waiting for confirmation.',
        chainId,
        hash,
      ),
      type: 'info',
      isLoading: true,
      autoClose: false,
    })
    const res = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 2,
    })
    const status = res.status === 'success'

    if (status) {
      toast.update(id, {
        render: withExplorerLink('Transaction confirmed.', chainId, hash),
        type: 'success',
        isLoading: false,
        autoClose: OPTIONS.autoClose,
      })
      emitTxConfirmed()
    } else
      toast.update(id, {
        render: withExplorerLink(
          'The transaction failed on chain (reverted).',
          chainId,
          hash,
        ),
        type: 'error',
        isLoading: false,
        autoClose: false,
      })

    return { status, result: res }
  } catch (err) {
    if (!hash && isUserRejection(err))
      toast.update(id, {
        render: 'Transaction cancelled in your wallet.',
        type: 'default',
        isLoading: false,
        autoClose: 4000,
      })
    else
      toast.update(id, {
        render: withExplorerLink(parseWagmiError(err), chainId, hash),
        type: 'error',
        isLoading: false,
        autoClose: false,
      })
    return { status: false }
  }
}

export async function catchShortMessage(promise: Promise<unknown>) {
  return await promise.catch((err) =>
    toast.error(parseWagmiError(err), ERROR_OPTIONS),
  )
}
