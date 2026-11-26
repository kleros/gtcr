import { readContracts } from '@wagmi/core'
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
    return { kind: 'contract' }
  } catch {
    return { kind: 'unknown' }
  }
}
