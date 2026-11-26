import { getPublicClient, readContract } from '@wagmi/core'
import { ethers } from 'ethers'
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  stringToBytes,
  type Abi,
  type AbiFunction,
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
 * The call spelled out for the Transaction Builder, so an owner reviews the
 * method and each value instead of hex. The Builder shows a transaction that
 * has `data` as "Custom hex data"; one without it, by its method and fields,
 * and encodes those fields again itself (safe-react-apps, apps/tx-builder:
 * convertToProposedTransactions, encodeToHexData), where a field it cannot
 * encode becomes empty calldata. So a call is spelled out only when every
 * value is one the Builder's form takes as is (an address, a whole number,
 * a boolean, bytes, a string), and when encoding those fields the way the
 * Builder does gives back exactly the calldata; otherwise the file keeps
 * the calldata.
 */
const fieldText = (type: string, value: unknown): string | undefined => {
  if (type === 'address')
    return typeof value === 'string' && isAddress(value, { strict: false })
      ? getAddress(value)
      : undefined
  if (/^u?int\d*$/.test(type))
    return typeof value === 'bigint' ||
      (typeof value === 'number' && Number.isSafeInteger(value))
      ? value.toString(10)
      : undefined
  if (type === 'bool')
    return typeof value === 'boolean' ? String(value) : undefined
  if (type === 'string') return typeof value === 'string' ? value : undefined
  if (/^bytes\d*$/.test(type))
    return typeof value === 'string' && /^0x(?:[\da-f]{2})*$/i.test(value)
      ? value
      : undefined
  return undefined
}

const spelledOut = (call: ContractCall) => {
  const fn = call.abi.find(
    (item): item is AbiFunction =>
      item.type === 'function' &&
      item.name === call.functionName &&
      item.inputs.length === call.args.length,
  )
  if (!fn) return undefined
  const contractInputsValues: Record<string, string> = {}
  for (const [index, input] of fn.inputs.entries()) {
    const text = fieldText(input.type, call.args[index])
    if (!input.name || text === undefined || input.name in contractInputsValues)
      return undefined
    contractInputsValues[input.name] = text
  }
  const contractMethod = {
    inputs: fn.inputs.map((input) => ({
      internalType: input.internalType ?? input.type,
      name: input.name as string,
      type: input.type,
    })),
    name: fn.name,
    payable: fn.stateMutability === 'payable',
  }
  try {
    const fields = contractMethod.inputs.map(({ name, type }) =>
      type === 'bool'
        ? contractInputsValues[name] === 'true'
        : contractInputsValues[name],
    )
    const again = new ethers.utils.Interface([
      { type: 'function', stateMutability: 'nonpayable', ...contractMethod },
    ]).encodeFunctionData(fn.name, fields)
    if (again.toLowerCase() !== callData(call).toLowerCase()) return undefined
  } catch {
    return undefined
  }
  return { contractMethod, contractInputsValues }
}

/** The Builder's fields for a call: spelled out, or else its calldata. */
const builderCall = (call: ContractCall) => {
  const spelled = spelledOut(call)
  return spelled
    ? { data: null, ...spelled }
    : { data: callData(call), contractMethod: null, contractInputsValues: null }
}

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
        ...builderCall(call),
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
