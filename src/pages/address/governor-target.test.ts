import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  HttpRequestError,
  type BaseError,
} from 'viem'

/*
 * What a new governor is, read in one multicall that allows failures: a
 * failed view is the contract's own "no" (it has no such function) only when
 * it reverted or returned nothing. A read the network dropped comes back as
 * failed views too, and must not make a Safe "a contract, but not a Safe".
 */

const h = vi.hoisted(() => ({
  hasCode: true as boolean | Error,
  results: [] as unknown[],
}))

vi.mock('config/wagmi', () => ({ wagmiConfig: {} }))
vi.mock('utils/safe-transaction', () => ({
  readHasCode: async () => {
    if (h.hasCode instanceof Error) throw h.hasCode
    return h.hasCode
  },
}))
vi.mock('@wagmi/core', () => ({ readContracts: async () => h.results }))

// eslint-disable-next-line import/first
import { readGovernorTarget } from './governor-target'

const ADDRESS = '0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe'
const ABI = [
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/** A view's error as viem hands it back from a multicall. */
const failed = (cause: BaseError) => ({
  status: 'failure' as const,
  result: undefined,
  error: new ContractFunctionExecutionError(cause, {
    abi: ABI,
    functionName: 'getThreshold',
    contractAddress: ADDRESS,
    args: [],
  }),
})
const reverted = () =>
  failed(
    new ContractFunctionRevertedError({
      abi: ABI,
      functionName: 'getThreshold',
      data: '0x',
    }),
  )
const empty = () =>
  failed(new ContractFunctionZeroDataError({ functionName: 'getThreshold' }))
const dropped = () =>
  failed(new HttpRequestError({ url: 'https://rpc.test', status: 503 }))
const answered = (result: unknown) => ({
  status: 'success' as const,
  result,
  error: undefined,
})

beforeEach(() => {
  h.hasCode = true
  h.results = []
})

describe('readGovernorTarget', () => {
  it('names a Safe by its threshold and owners', async () => {
    h.results = [answered(2n), answered(['a', 'b', 'c']), reverted(), empty()]
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({
      kind: 'safe',
      threshold: 2,
      owners: 3,
    })
  })

  it('knows a list by its governor and arbitrator', async () => {
    h.results = [reverted(), reverted(), answered(ADDRESS), answered(ADDRESS)]
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({ kind: 'list' })
  })

  it('calls a contract "not a Safe" only on its own no', async () => {
    h.results = [reverted(), empty(), reverted(), empty()]
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({
      kind: 'contract',
    })
    // The Kleros Governor: an arbitrator, no governor of its own.
    h.results = [reverted(), reverted(), reverted(), answered(ADDRESS)]
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({
      kind: 'contract',
    })
  })

  it('says it could not tell when the multicall failed as a whole', async () => {
    const whole = dropped()
    h.results = [whole, whole, whole, whole]
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({ kind: 'unknown' })
  })

  it('does not take a node error shared by every view for a revert', async () => {
    // viem reads a node's "internal error" (-32603) as a revert: one error
    // for all four calls is still the multicall failing, not four answers.
    const whole = reverted()
    h.results = [whole, whole, whole, whole]
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({ kind: 'unknown' })
  })

  it('says it could not tell when the Safe views were dropped', async () => {
    h.results = [dropped(), dropped(), reverted(), reverted()]
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({ kind: 'unknown' })
    h.results = [reverted(), reverted(), dropped(), dropped()]
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({ kind: 'unknown' })
  })

  it('calls an address with no code a wallet, and a failed code read unknown', async () => {
    h.hasCode = false
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({ kind: 'wallet' })
    h.hasCode = new Error('network')
    expect(await readGovernorTarget(100, ADDRESS)).toEqual({ kind: 'unknown' })
  })
})
