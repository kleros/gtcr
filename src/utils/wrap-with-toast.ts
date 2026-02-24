import { toast, type ToastPosition } from 'react-toastify'
import type { PublicClient, TransactionReceipt } from 'viem'
import { parseWagmiError } from './parse-wagmi-error'

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

export async function wrapWithToast(
  contractWrite: () => Promise<`0x${string}`>,
  publicClient: PublicClient,
): Promise<WrapWithToastReturnType> {
  toast.info('Transaction initiated', OPTIONS)

  try {
    const hash = await contractWrite()
    const res = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 2,
    })
    const status = res.status === 'success'

    if (status) toast.success('Transaction mined!', OPTIONS)
    else toast.error('Transaction reverted!', ERROR_OPTIONS)

    return { status, result: res }
  } catch (err) {
    toast.error(parseWagmiError(err), ERROR_OPTIONS)
    return { status: false }
  }
}

export async function catchShortMessage(promise: Promise<unknown>) {
  return await promise.catch((err) =>
    toast.error(parseWagmiError(err), ERROR_OPTIONS),
  )
}
