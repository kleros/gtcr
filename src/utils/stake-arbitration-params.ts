import { multicall } from '@wagmi/core'
import type { Abi } from 'viem'
import permanentAbi from 'assets/abis/PermanentGTCR.json'
import { wagmiConfig } from 'config/wagmi'

/*
 * A Stake Curate list (PermanentGTCR) keeps its arbitration settings in an
 * append-only array, arbitrationParamsChanges, with no getter for its length
 * or its latest entry, and new challenges use the latest one. The entries are
 * read in small batches until the first index past the end, which reverts.
 * The MetaEvidence of each entry is never stored, only emitted with the
 * entry's index (MetaEvidence(index, uri)), so the URI has to come from the
 * indexer, and `count` says which entry it must be.
 */

const BATCH = 8
const MAX_ENTRIES = 1024
const FUNCTION_NAME = 'arbitrationParamsChanges'
// viem's names for a call that reverted or returned no data.
const END_OF_ARRAY = new Set([
  'ContractFunctionRevertedError',
  'ContractFunctionZeroDataError',
  'AbiDecodingZeroDataError',
])

/**
 * Whether a failed read is the end of the array: this call itself reverted
 * (an index past the last entry) or returned no data. When the node does not
 * answer a batch, viem fails every call in it with the batch's own error (the
 * aggregate3 call, at times dressed as a revert): that says nothing about
 * where the array ends, so it must not turn an older entry into the latest.
 */
const isPastTheEnd = (error: unknown) => {
  if ((error as { functionName?: unknown })?.functionName !== FUNCTION_NAME)
    return false
  let cause = error as { name?: unknown; cause?: unknown } | undefined
  for (let depth = 0; cause && depth < 8; depth++) {
    if (END_OF_ARRAY.has(String(cause.name))) return true
    cause = cause.cause as typeof cause
  }
  return false
}

export interface StakeArbitrationParams {
  /** How many entries the list holds: the latest is `count - 1`. */
  count: number
  /** The latest entry's arbitrator extra data (court and jurors). */
  arbitratorExtraData: `0x${string}`
}

export const readStakeArbitrationParams = async (
  chainId: number,
  address: string,
): Promise<StakeArbitrationParams> => {
  let latest: `0x${string}` | undefined
  for (let start = 0; start < MAX_ENTRIES; start += BATCH) {
    const results = await multicall(wagmiConfig, {
      chainId,
      allowFailure: true,
      contracts: Array.from({ length: BATCH }, (_, offset) => ({
        address: address as `0x${string}`,
        abi: permanentAbi as Abi,
        functionName: FUNCTION_NAME,
        args: [BigInt(start + offset)],
      })),
    })
    for (const [offset, result] of results.entries()) {
      if (result.status === 'failure') {
        // Anything but the end (a node that did not answer) fails the read.
        if (!isPastTheEnd(result.error)) throw result.error
        if (!latest)
          throw new Error('This list has no arbitration settings to read')
        return { count: start + offset, arbitratorExtraData: latest }
      }
      latest = (result.result as readonly [number, `0x${string}`])[1]
    }
  }
  throw new Error('Too many arbitration settings to read')
}
