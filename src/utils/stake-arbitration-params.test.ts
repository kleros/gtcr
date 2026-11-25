import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  HttpRequestError,
  multicall3Abi,
  type Abi,
} from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import permanentAbi from 'assets/abis/PermanentGTCR.json'

/*
 * The reader walks arbitrationParamsChanges until the first index past the
 * end. Only that call's own revert (or empty answer) may end the walk: a node
 * that does not answer fails every call of a batch with the batch's error,
 * and once that was taken for the end, so a list's older court read as its
 * latest (fixed in b858752, untested until now).
 */

const multicall = vi.hoisted(() => vi.fn())
vi.mock('@wagmi/core', () => ({ multicall }))
vi.mock('config/wagmi', () => ({ wagmiConfig: {} }))

const { readStakeArbitrationParams } =
  await import('./stake-arbitration-params')

const LIST = '0x3333333333333333333333333333333333333333'
const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11'
const ABI = permanentAbi as Abi
const extraData = (index: number) =>
  `0x${index.toString(16).padStart(64, '0')}` as `0x${string}`

/** This call's own failure, as viem reports it in a multicall result. */
const ownFailure = (
  index: number,
  cause: Error = new ContractFunctionRevertedError({
    abi: ABI,
    functionName: 'arbitrationParamsChanges',
  }),
) =>
  new ContractFunctionExecutionError(cause as never, {
    abi: ABI,
    functionName: 'arbitrationParamsChanges',
    args: [BigInt(index)],
    contractAddress: LIST,
  })

/** The node's failure of a whole batch: viem gives every call this error. */
const batchFailure = () =>
  new ContractFunctionExecutionError(
    new ContractFunctionRevertedError({
      abi: multicall3Abi,
      functionName: 'aggregate3',
    }) as never,
    {
      abi: multicall3Abi,
      functionName: 'aggregate3',
      args: [],
      contractAddress: MULTICALL,
    },
  )

/** A list holding `count` settings; `failBatch` fails that batch whole. */
const listWith = (
  count: number,
  {
    failBatch,
    error = batchFailure(),
  }: { failBatch?: number; error?: Error } = {},
) => {
  let batch = 0
  multicall.mockImplementation(
    async (
      _config: unknown,
      { contracts }: { contracts: { args: [bigint] }[] },
    ) => {
      const failing = batch++ === failBatch
      return contracts.map(({ args: [index] }) => {
        const i = Number(index)
        if (failing) return { status: 'failure', error }
        return i < count
          ? { status: 'success', result: [i * 1000, extraData(i)] }
          : { status: 'failure', error: ownFailure(i) }
      })
    },
  )
}

beforeEach(() => {
  multicall.mockReset()
})

describe('readStakeArbitrationParams', () => {
  it('reads up to the first index past the end', async () => {
    listWith(3)
    await expect(readStakeArbitrationParams(100, LIST)).resolves.toEqual({
      count: 3,
      arbitratorExtraData: extraData(2),
    })
    expect(multicall).toHaveBeenCalledTimes(1)
  })

  it('reads on into the next batch', async () => {
    listWith(9)
    await expect(readStakeArbitrationParams(100, LIST)).resolves.toEqual({
      count: 9,
      arbitratorExtraData: extraData(8),
    })
    expect(multicall).toHaveBeenCalledTimes(2)
  })

  it('takes an empty answer for the end too', async () => {
    multicall.mockResolvedValueOnce(
      Array.from({ length: 8 }, (_, i) =>
        i < 2
          ? { status: 'success', result: [0, extraData(i)] }
          : {
              status: 'failure',
              error: ownFailure(
                i,
                new ContractFunctionZeroDataError({
                  functionName: 'arbitrationParamsChanges',
                }),
              ),
            },
      ),
    )
    await expect(readStakeArbitrationParams(100, LIST)).resolves.toEqual({
      count: 2,
      arbitratorExtraData: extraData(1),
    })
  })

  it('fails, rather than return an older entry, when a batch is not answered', async () => {
    // Nine settings; the second batch, which holds the latest, fails whole.
    const error = batchFailure()
    listWith(9, { failBatch: 1, error })
    await expect(readStakeArbitrationParams(100, LIST)).rejects.toBe(error)
  })

  it('fails on a transport error too', async () => {
    const error = new HttpRequestError({ url: 'https://rpc.test', status: 503 })
    listWith(9, { failBatch: 1, error })
    await expect(readStakeArbitrationParams(100, LIST)).rejects.toBe(error)
  })

  it('says so when a list has no settings at all', async () => {
    listWith(0)
    await expect(readStakeArbitrationParams(100, LIST)).rejects.toThrow(
      'This list has no arbitration settings to read',
    )
  })

  it('gives up past its limit instead of reading for ever', async () => {
    listWith(5000)
    await expect(readStakeArbitrationParams(100, LIST)).rejects.toThrow(
      'Too many arbitration settings to read',
    )
  })
})
