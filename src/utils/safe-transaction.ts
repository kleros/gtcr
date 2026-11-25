import { getPublicClient, readContract } from '@wagmi/core'
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  stringToBytes,
  type Abi,
} from 'viem'
import { wagmiConfig } from 'config/wagmi'

/*
 * Lists governed by a contract (most often a Safe). Nobody's wallet is the
 * governor there: a change is built in the app and signed in the Safe,
 * either from a Safe Transaction Builder file or from the raw calldata.
 */

/** One contract call, as the governance dialog simulates and sends it. */
export interface ContractCall {
  chainId: number
  address: `0x${string}`
  abi: Abi
  functionName: string
  args: readonly unknown[]
}

/** Whether an address holds code on a chain (a Safe, or any contract). */
export const readHasCode = async (
  chainId: number,
  address: string,
): Promise<boolean> => {
  const client = getPublicClient(wagmiConfig, { chainId })
  if (!client) throw new Error(`No client for chain ${chainId}`)
  const code = await client.getCode({ address: address as `0x${string}` })
  // An EIP-7702 delegated account (0xef0100 + address) is still a wallet
  // that signs and mines its own transactions, not a Safe.
  if (code && /^0xef0100/i.test(code)) return false
  return Boolean(code && code !== '0x')
}

/** The React Query options for readHasCode: code at an address never goes. */
export const hasCodeQuery = (chainId: number, address?: string | null) => ({
  queryKey: ['hasCode', chainId, (address ?? '').toLowerCase()],
  queryFn: () => readHasCode(chainId, address as string),
  enabled: !!address && isAddress(address) && !/^0x0{40}$/i.test(address),
  staleTime: Infinity,
})

const SAFE_OWNERS_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const

/** A Safe's owners, lowercase; undefined when the contract is no Safe. */
export const readSafeOwners = async (
  chainId: number,
  safe: string,
): Promise<string[] | undefined> => {
  try {
    const owners = await readContract(wagmiConfig, {
      chainId,
      address: safe as `0x${string}`,
      abi: SAFE_OWNERS_ABI,
      functionName: 'getOwners',
    } as any)
    return (owners as string[]).map((owner) => owner.toLowerCase())
  } catch {
    return undefined
  }
}

export const callData = (call: ContractCall): `0x${string}` =>
  encodeFunctionData({
    abi: call.abi,
    functionName: call.functionName,
    args: call.args,
  } as any)

/*
 * The Transaction Builder's checksum (safe-react-apps, apps/tx-builder,
 * src/lib/checksum.ts): keys sorted, undefined as null, the batch's name
 * left out, then keccak256 of the text. Without it every import warns that
 * the file changed since it was saved, which teaches owners to ignore the
 * one warning that means it was tampered with.
 */
const serializeForChecksum = (json: unknown): string => {
  const replacer = (_: string, value: unknown) =>
    value === undefined ? null : value
  if (Array.isArray(json))
    return `[${json.map((item) => serializeForChecksum(item)).join(',')}]`
  if (typeof json === 'object' && json !== null) {
    const record = json as Record<string, unknown>
    // Code-unit order, as the Builder's own `.sort()`: never localeCompare,
    // or the checksum would differ from the one the Builder computes.
    const keys = Object.keys(record).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    let text = `{${JSON.stringify(keys, replacer)}`
    for (const key of keys) text += `${serializeForChecksum(record[key])},`
    return `${text}}`
  }
  return `${JSON.stringify(json, replacer)}`
}

const withChecksum = <T extends { meta: Record<string, unknown> }>(
  batch: T,
): T => ({
  ...batch,
  meta: {
    ...batch.meta,
    checksum: keccak256(
      stringToBytes(
        serializeForChecksum({ ...batch, meta: { ...batch.meta, name: null } }),
      ),
    ),
  },
})

/**
 * A Safe Transaction Builder batch with one call: the file its "drag and
 * drop" import takes, checksummed as the Builder's own downloads are.
 */
export const safeTransactionBuilderJson = ({
  call,
  safe,
  name,
  description,
  createdAt = Date.now(),
}: {
  call: ContractCall
  /** The Safe that will execute the batch (the list's governor). */
  safe: string
  name: string
  description: string
  createdAt?: number
}) =>
  withChecksum({
    version: '1.0',
    chainId: String(call.chainId),
    createdAt,
    meta: {
      name,
      description,
      txBuilderVersion: '1.16.5',
      createdFromSafeAddress: getAddress(safe),
    },
    transactions: [
      {
        to: getAddress(call.address),
        value: '0',
        data: callData(call),
        contractMethod: null,
        contractInputsValues: null,
      },
    ],
  })

/** Saves a value as a JSON file through the browser's download. */
export const downloadJson = (filename: string, value: unknown) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
