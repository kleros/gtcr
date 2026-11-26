import { readContracts } from '@wagmi/core'
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
} from 'viem'
import { wagmiConfig } from 'config/wagmi'
import { readHasCode } from 'utils/safe-transaction'
import type { GovernorTarget } from './governance-params'

/*
 * What a new governor is on the list's chain, read before a transfer is
 * reviewed (governance-params governorTargetNote says what the review makes
 * of it). Four views in one multicall: a Safe answers getThreshold and
 * getOwners; a Curate list (or anything else with its own governor and
 * arbitrator) answers governor and arbitrator.
 */

const view = (name: string, type: string) =>
  ({
    type: 'function',
    name,
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type }],
  }) as const

const TARGET_ABI = [
  view('getThreshold', 'uint256'),
  view('getOwners', 'address[]'),
  view('governor', 'address'),
  view('arbitrator', 'address'),
] as const

type ViewResult = { status: 'success' | 'failure'; error?: unknown }

/**
 * Whether a view failed because the contract said no (it reverted, or
 * returned nothing: it has no such function), not because the read never
 * reached it. A multicall that failed as a whole hands every call its one
 * error, and a node's "internal error" then reads as a revert: that is no
 * answer either.
 */
const saidNo = (result: ViewResult, shared: unknown) =>
  result.status === 'failure' &&
  result.error !== shared &&
  result.error instanceof BaseError &&
  result.error.walk(
    (cause) =>
      cause instanceof ContractFunctionRevertedError ||
      cause instanceof ContractFunctionZeroDataError,
  ) !== null

export const readGovernorTarget = async (
  chainId: number,
  address: string,
): Promise<GovernorTarget> => {
  try {
    // An EIP-7702 delegated account counts as the wallet it is.
    if (!(await readHasCode(chainId, address))) return { kind: 'wallet' }
    const contract = {
      chainId,
      address: address as `0x${string}`,
      abi: TARGET_ABI,
    }
    const [threshold, owners, governor, arbitrator] = await readContracts(
      wagmiConfig,
      {
        allowFailure: true,
        contracts: [
          { ...contract, functionName: 'getThreshold' },
          { ...contract, functionName: 'getOwners' },
          { ...contract, functionName: 'governor' },
          { ...contract, functionName: 'arbitrator' },
        ],
      },
    )
    if (threshold.status === 'success' && owners.status === 'success')
      return {
        kind: 'safe',
        threshold: Number(threshold.result),
        owners: (owners.result as readonly string[]).length,
      }
    if (governor.status === 'success' && arbitrator.status === 'success')
      return { kind: 'list' }
    // With allowFailure, a read the network dropped comes back as failed
    // views, not as an exception: "not a Safe" needs the contract's own no,
    // or a real Safe behind a flaky node would be called something else.
    const results = [threshold, owners, governor, arbitrator]
    const shared = results.every(
      (result) =>
        result.status === 'failure' && result.error === results[0].error,
    )
      ? results[0].error
      : undefined
    const notSafe = saidNo(threshold, shared) || saidNo(owners, shared)
    const notList = saidNo(governor, shared) || saidNo(arbitrator, shared)
    return notSafe && notList ? { kind: 'contract' } : { kind: 'unknown' }
  } catch {
    return { kind: 'unknown' }
  }
}
