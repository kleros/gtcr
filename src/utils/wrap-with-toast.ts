import React from 'react'
import { toast, type ToastPosition } from 'react-toastify'
import type { TransactionReceipt, Hash } from 'viem'
import { parseWagmiError } from './parse-wagmi-error'
import { getTxPage } from './network-utils'
import { emitTxConfirmed } from './tx-events'

/**
 * A sent transaction the wallet replaced before it was mined, as viem
 * reports it: sped up ("repriced", the same call), cancelled (an empty
 * transfer to oneself) or replaced by a different transaction.
 */
interface Replacement {
  reason: 'cancelled' | 'replaced' | 'repriced'
  transaction: { hash: Hash }
}

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
    timeout?: number
    onReplaced?: (replacement: Replacement) => void
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
  /**
   * The wallet cancelled the transaction or sent a different one in its
   * place: it will never be mined, and nothing it would have done happened.
   */
  replaced?: boolean
}

export const infoToast = (message: string) => toast.info(message, OPTIONS)
export const successToast = (message: string) => toast.success(message, OPTIONS)
export const errorToast = (message: string) =>
  toast.error(message, ERROR_OPTIONS)

// The wallet's own words for its owner declining (MetaMask, viem's
// UserRejectedRequestError, WalletConnect). Not "request rejected": nodes
// and relays use that for their own failures, which must stay errors.
const REJECTION =
  /user (rejected|denied|cancell?ed)|denied transaction signature/i

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

/**
 * The Atlas sign-in every upload needs, with its outcome in a toast. A
 * declined signature is the person's choice, not a failure: it gets a short
 * note, not a sticky error carrying the wallet library's internals.
 */
export const signInWithToast = (authoriseUser: () => Promise<unknown>) => {
  infoToast('Signing in…')
  authoriseUser()
    .then(() => successToast('Signed in.'))
    .catch((err: unknown) => {
      console.error(err)
      if (isUserRejection(err)) infoToast('Sign-in cancelled.')
      else errorToast(`Sign-in failed: ${parseWagmiError(err) || 'try again.'}`)
    })
}

/**
 * For a "Switch to <chain>" control: a wallet that did not switch says why
 * in a toast. A declined request is left alone; anything else (a request
 * already waiting in the wallet, a wallet that cannot add the network)
 * points to the wallet, where it can be solved.
 */
export const reportSwitchFailure = (error: unknown, chainName?: string) => {
  if (isUserRejection(error)) return
  console.error(error)
  errorToast(
    `Your wallet did not switch${chainName ? ` to ${chainName}` : ''}. Open it: a request may be waiting there, or change the network in the wallet itself.`,
  )
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

type ToastUpdate = NonNullable<Parameters<typeof toast.update>[1]>

/**
 * The transaction's one toast is not closed by a click: its "View on
 * explorer" link is a click, and a toast closed that way could never show
 * how the transaction ended.
 */
const TX_TOAST = { closeOnClick: false } as const

/**
 * Writes the next state into the transaction's toast. If the person closed
 * it meanwhile, the outcome still deserves a toast of its own.
 */
const report = (id: ReturnType<typeof toast.info>, update: ToastUpdate) => {
  if (toast.isActive(id)) toast.update(id, update)
  else if (!update.isLoading && update.render)
    toast(update.render, {
      ...OPTIONS,
      ...TX_TOAST,
      type: update.type ?? undefined,
      autoClose: update.autoClose ?? undefined,
    })
}

/*
 * viem answers a replaced transaction with the receipt of its replacement,
 * which succeeded: left alone, a transaction cancelled from the wallet read
 * "Transaction confirmed." (and a submission then opened an entry that never
 * comes). Only a speed-up did what was asked.
 *
 * viem says so through onReplaced only when one confirmation is asked for:
 * with two it finds the replacement at one, waits, and resolves with the
 * replacement's receipt without a word. A receipt for another hash tells it
 * then; an empty transfer to oneself is the wallets' cancel, anything else
 * is taken for a speed-up (the common case).
 */
export const replacementOf = (
  receipt: TransactionReceipt,
  hash: Hash,
): Replacement | undefined => {
  if (receipt.transactionHash.toLowerCase() === hash.toLowerCase())
    return undefined
  const toSelf =
    !!receipt.to && receipt.to.toLowerCase() === receipt.from.toLowerCase()
  return {
    reason: toSelf ? 'cancelled' : 'repriced',
    transaction: { hash: receipt.transactionHash },
  }
}

const replacedUpdate = (
  replacement: Replacement,
  chainId: number | undefined,
): ToastUpdate =>
  replacement.reason === 'cancelled'
    ? {
        render: withExplorerLink(
          'This transaction was cancelled in your wallet.',
          chainId,
          replacement.transaction.hash,
        ),
        type: 'default',
        isLoading: false,
        autoClose: OPTIONS.autoClose,
      }
    : {
        render: withExplorerLink(
          'Your wallet replaced this transaction with a different one, so it did not go through.',
          chainId,
          replacement.transaction.hash,
        ),
        type: 'warning',
        isLoading: false,
        autoClose: false,
      }

/** How long a transaction whose receipt is late is still followed. */
const LATE_RECEIPT_MS = 15 * 60_000

/**
 * A sent transaction whose receipt did not come back in time (a slow chain,
 * or a node that stopped answering) may still go through: keep following it
 * and turn the toast into its outcome, refreshing the data if it confirms.
 */
const followLateReceipt = async (
  publicClient: TransactionReceiptClient,
  id: ReturnType<typeof toast.info>,
  chainId: number | undefined,
  hash: Hash,
) => {
  try {
    let replacement: Replacement | undefined
    const res = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: LATE_RECEIPT_MS,
      onReplaced: (next) => {
        replacement = next
      },
    })
    replacement ??= replacementOf(res, hash)
    if (replacement && replacement.reason !== 'repriced') {
      report(id, replacedUpdate(replacement, chainId))
      return
    }
    const confirmed = res.status === 'success'
    report(id, {
      render: withExplorerLink(
        confirmed
          ? 'Transaction confirmed.'
          : 'The transaction failed on chain (reverted).',
        chainId,
        replacement?.transaction.hash ?? hash,
      ),
      type: confirmed ? 'success' : 'error',
      isLoading: false,
      autoClose: confirmed ? OPTIONS.autoClose : false,
    })
    if (confirmed) emitTxConfirmed()
  } catch {
    // Still no answer: the warning and its explorer link stay.
  }
}

/**
 * Sends a transaction and follows it in one toast: confirm in the wallet,
 * sent (with an explorer link), then confirmed or failed. A request the
 * wallet's owner declines closes quietly; it is not an error. A transaction
 * that was sent but whose receipt is late is not reported as failed: only a
 * reverted receipt says that.
 */
export async function wrapWithToast(
  contractWrite: () => Promise<Hash>,
  publicClient: TransactionReceiptClient,
): Promise<WrapWithToastReturnType> {
  const id = toast.info('Confirm the transaction in your wallet.', {
    ...OPTIONS,
    ...TX_TOAST,
    autoClose: false,
  })
  const chainId = publicClient.chain?.id
  let hash: Hash | undefined

  try {
    hash = await contractWrite()
    report(id, {
      render: withExplorerLink(
        'Transaction sent. Waiting for confirmation.',
        chainId,
        hash,
      ),
      type: 'info',
      isLoading: true,
      autoClose: false,
    })
    let replacement: Replacement | undefined
    const res = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 2,
      onReplaced: (next) => {
        replacement = next
      },
    })
    replacement ??= replacementOf(res, hash)
    if (replacement && replacement.reason !== 'repriced') {
      report(id, replacedUpdate(replacement, chainId))
      return { status: false, replaced: true }
    }
    // Sped up in the wallet: the same call, under the new hash.
    if (replacement) hash = replacement.transaction.hash
    const status = res.status === 'success'

    if (status) {
      report(id, {
        render: withExplorerLink('Transaction confirmed.', chainId, hash),
        type: 'success',
        isLoading: false,
        autoClose: OPTIONS.autoClose,
      })
      emitTxConfirmed()
    } else
      report(id, {
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
      report(id, {
        render: 'Transaction cancelled in your wallet.',
        type: 'default',
        isLoading: false,
        autoClose: 4000,
      })
    else if (hash) {
      report(id, {
        render: withExplorerLink(
          'Still waiting for this transaction to confirm. It may yet go through.',
          chainId,
          hash,
        ),
        type: 'warning',
        isLoading: false,
        autoClose: false,
      })
      void followLateReceipt(publicClient, id, chainId, hash)
    } else
      report(id, {
        render: withExplorerLink(parseWagmiError(err), chainId, hash),
        type: 'error',
        isLoading: false,
        autoClose: false,
      })
    return { status: false }
  }
}
