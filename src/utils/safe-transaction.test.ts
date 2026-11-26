import { getPublicClient, readContract } from '@wagmi/core'
import { ethers } from 'ethers'
import { type Abi, decodeFunctionData } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import lightGtcrAbi from 'assets/abis/LightGeneralizedTCR.json'
import permanentAbi from 'assets/abis/PermanentGTCR.json'
import { wagmiConfig } from 'config/wagmi'
import {
  type ContractCall,
  callData,
  downloadJson,
  hasCodeQuery,
  readHasCode,
  readSafeOwners,
  safeTransactionBuilderJson,
} from './safe-transaction'
import { encodeExtraData, readExtraData } from './string'

// The real config builds a wallet modal against `window`.
vi.mock('config/wagmi', () => ({ wagmiConfig: { name: 'test config' } }))
vi.mock('@wagmi/core', () => ({
  getPublicClient: vi.fn(),
  readContract: vi.fn(),
}))

const ABI = lightGtcrAbi as Abi
const LIST = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const SAFE = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'
const ARBITRATOR = '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB'
const CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'

const CALL: ContractCall = {
  chainId: 100,
  address: LIST.toLowerCase() as `0x${string}`,
  abi: ABI,
  functionName: 'changeSubmissionBaseDeposit',
  args: [10n ** 18n],
}

const BATCH = {
  call: CALL,
  safe: SAFE.toLowerCase(),
  name: 'Tokens: changeSubmissionBaseDeposit',
  description: `changeSubmissionBaseDeposit on ${LIST} (Gnosis), prepared in Curate.`,
  createdAt: 1_763_812_800_000,
}

const ethersInterface = new ethers.utils.Interface(lightGtcrAbi)

/*
 * The Transaction Builder's own check when a file is dropped in
 * (safe-react-apps, apps/tx-builder/src/lib/checksum.ts), written apart from
 * the app's code and hashed with ethers: keys sorted, undefined as null, the
 * name left out.
 */
const serialize = (json: unknown): string => {
  const replacer = (_: string, value: unknown) =>
    value === undefined ? null : value
  if (Array.isArray(json)) return `[${json.map(serialize).join(',')}]`
  if (typeof json === 'object' && json !== null) {
    const record = json as Record<string, unknown>
    const keys = Object.keys(record).sort()
    const values = keys.map((key) => `${serialize(record[key])},`).join('')
    return `{${JSON.stringify(keys, replacer)}${values}}`
  }
  return `${JSON.stringify(json, replacer)}`
}

const builderAccepts = (file: { meta: Record<string, unknown> }) => {
  const { checksum, ...meta } = file.meta
  const expected = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      serialize({ ...file, meta: { ...meta, name: null } }),
    ),
  )
  return checksum === expected
}

/** The file as the Safe owner's browser downloads it and the Builder reads it. */
const downloaded = <T>(value: T): T => JSON.parse(JSON.stringify(value))

// The function's type leaves the checksum out of `meta`; the file has it.
const checksumOf = (batch: Parameters<typeof safeTransactionBuilderJson>[0]) =>
  (safeTransactionBuilderJson(batch).meta as { checksum?: string }).checksum

describe('callData', () => {
  it('encodes the call as the contract reads it', () => {
    expect(callData(CALL)).toBe(
      ethersInterface.encodeFunctionData('changeSubmissionBaseDeposit', [
        '1000000000000000000',
      ]),
    )
  })

  it('encodes new arbitration parameters that decode back to the same court', () => {
    const extraData = encodeExtraData(1, 3)
    const data = callData({
      ...CALL,
      functionName: 'changeArbitrationParams',
      args: [
        ARBITRATOR,
        extraData,
        `/ipfs/${CID}/registration.json`,
        `/ipfs/${CID}/clearing.json`,
      ],
    })
    const decoded = ethersInterface.decodeFunctionData(
      'changeArbitrationParams',
      data,
    )
    expect(decoded._arbitrator).toBe(ARBITRATOR)
    expect(decoded._arbitratorExtraData).toBe(extraData)
    expect(readExtraData(decoded._arbitratorExtraData)).toEqual({
      courtID: 1,
      numberOfJurors: 3,
    })
    expect(decoded._registrationMetaEvidence).toBe(
      `/ipfs/${CID}/registration.json`,
    )
    expect(decodeFunctionData({ abi: ABI, data }).functionName).toBe(
      'changeArbitrationParams',
    )
  })

  it('throws rather than encode a function the contract does not have', () => {
    expect(() => callData({ ...CALL, functionName: 'changeOwner' })).toThrow()
  })

  it('throws rather than encode arguments of the wrong type', () => {
    expect(() =>
      callData({ ...CALL, args: ['one ether'] as readonly unknown[] }),
    ).toThrow()
    expect(() =>
      callData({ ...CALL, functionName: 'changeGovernor', args: ['0x1234'] }),
    ).toThrow()
  })
})

describe('safeTransactionBuilderJson', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is a one-call batch for the Safe, with checksummed addresses', () => {
    expect(safeTransactionBuilderJson(BATCH)).toEqual({
      version: '1.0',
      chainId: '100',
      createdAt: BATCH.createdAt,
      meta: {
        name: BATCH.name,
        description: BATCH.description,
        txBuilderVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
        createdFromSafeAddress: SAFE,
        checksum: expect.stringMatching(/^0x[\da-f]{64}$/),
      },
      transactions: [
        {
          to: LIST,
          value: '0',
          data: null,
          contractMethod: {
            inputs: [
              {
                internalType: 'uint256',
                name: '_submissionBaseDeposit',
                type: 'uint256',
              },
            ],
            name: 'changeSubmissionBaseDeposit',
            payable: false,
          },
          contractInputsValues: {
            _submissionBaseDeposit: '1000000000000000000',
          },
        },
      ],
    })
  })

  it("writes the call's chain id as text", () => {
    expect(
      safeTransactionBuilderJson({
        ...BATCH,
        call: { ...CALL, chainId: 11_155_111 },
      }).chainId,
    ).toBe('11155111')
  })

  it('dates the batch now unless told otherwise', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-22T12:00:00Z'))
    const { createdAt: _, ...rest } = BATCH
    expect(safeTransactionBuilderJson(rest).createdAt).toBe(
      Date.parse('2026-11-22T12:00:00Z'),
    )
  })

  it('downloads as exactly what was checksummed', () => {
    const file = safeTransactionBuilderJson(BATCH)
    expect(downloaded(file)).toEqual(file)
  })

  it('passes the Transaction Builder’s checksum check once downloaded', () => {
    expect(builderAccepts(downloaded(safeTransactionBuilderJson(BATCH)))).toBe(
      true,
    )
  })

  it('fails that check once the call in the file is changed', () => {
    const file = downloaded(safeTransactionBuilderJson(BATCH))
    file.transactions[0].data = callData({ ...CALL, args: [1n] })
    expect(builderAccepts(file)).toBe(false)
  })

  it('gives the same checksum for the same batch', () => {
    expect(checksumOf(BATCH)).toMatch(/^0x[\da-f]{64}$/)
    expect(checksumOf(BATCH)).toBe(checksumOf({ ...BATCH }))
  })

  it('leaves the name out of the checksum, as the Builder does', () => {
    expect(checksumOf({ ...BATCH, name: 'Renamed' })).toBe(checksumOf(BATCH))
  })

  it.each([
    ['description', { description: 'Something else.' }],
    ['date', { createdAt: BATCH.createdAt + 1 }],
    ['Safe', { safe: ARBITRATOR }],
    ['chain', { call: { ...CALL, chainId: 1 } }],
    ['target', { call: { ...CALL, address: ARBITRATOR as `0x${string}` } }],
    ['arguments', { call: { ...CALL, args: [2n * 10n ** 18n] } }],
  ])('changes the checksum when the %s changes', (_, change) => {
    expect(checksumOf({ ...BATCH, ...change })).not.toBe(checksumOf(BATCH))
  })

  it('throws rather than name a Safe that is not an address', () => {
    // The governance dialog passes '' when it has no governor.
    expect(() => safeTransactionBuilderJson({ ...BATCH, safe: '' })).toThrow()
    expect(() =>
      safeTransactionBuilderJson({ ...BATCH, safe: '0x1234' }),
    ).toThrow()
  })
})

describe('reading the chain', () => {
  const getCode = vi.fn()

  beforeEach(() => {
    getCode.mockReset()
    vi.mocked(getPublicClient).mockReset()
    vi.mocked(getPublicClient).mockReturnValue({ getCode } as never)
    vi.mocked(readContract).mockReset()
  })

  describe('readHasCode', () => {
    it('reads the code through the chain’s client', async () => {
      getCode.mockResolvedValue('0x6080604052')
      expect(await readHasCode(100, SAFE)).toBe(true)
      expect(getPublicClient).toHaveBeenCalledWith(wagmiConfig, {
        chainId: 100,
      })
      expect(getCode).toHaveBeenCalledWith({ address: SAFE })
    })

    it.each([
      ['no code', '0x'],
      ['nothing', undefined],
      ['an EIP-7702 delegation', `0xef0100${'ab'.repeat(20)}`],
      ['an EIP-7702 delegation in capitals', `0xEF0100${'AB'.repeat(20)}`],
    ])('is false for %s, which is a wallet and not a Safe', async (_, code) => {
      getCode.mockResolvedValue(code)
      expect(await readHasCode(1, SAFE)).toBe(false)
    })

    it('throws when there is no client for the chain', async () => {
      vi.mocked(getPublicClient).mockReturnValue(undefined as never)
      await expect(readHasCode(5, SAFE)).rejects.toThrow(
        'No client for chain 5',
      )
    })
  })

  describe('hasCodeQuery', () => {
    it('keys the read by chain and lowercase address, and keeps it', () => {
      const query = hasCodeQuery(100, SAFE)
      expect(query.queryKey).toEqual(['hasCode', 100, SAFE.toLowerCase()])
      expect(query.staleTime).toBe(Infinity)
      expect(query.enabled).toBe(true)
    })

    it('reads the code when it runs', async () => {
      getCode.mockResolvedValue('0x60')
      expect(await hasCodeQuery(1, SAFE).queryFn()).toBe(true)
    })

    it.each([
      ['no address', undefined],
      ['an empty address', ''],
      ['null', null],
      ['a short address', '0x1234'],
      ['the zero address', `0x${'0'.repeat(40)}`],
      ['a mistyped checksum', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD'],
    ])('does not run for %s', (_, address) => {
      expect(hasCodeQuery(1, address).enabled).toBe(false)
    })
  })

  describe('readSafeOwners', () => {
    it("gives the Safe's owners in lowercase", async () => {
      vi.mocked(readContract).mockResolvedValue([LIST, ARBITRATOR] as never)
      expect(await readSafeOwners(100, SAFE)).toEqual([
        LIST.toLowerCase(),
        ARBITRATOR.toLowerCase(),
      ])
      expect(readContract).toHaveBeenCalledWith(
        wagmiConfig,
        expect.objectContaining({
          chainId: 100,
          address: SAFE,
          functionName: 'getOwners',
        }),
      )
    })

    it('is undefined when the contract is no Safe', async () => {
      vi.mocked(readContract).mockRejectedValue(new Error('reverted'))
      expect(await readSafeOwners(100, LIST)).toBeUndefined()
    })
  })
})

describe('downloadJson', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the value as indented JSON under the name, then frees it', async () => {
    vi.useFakeTimers()
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
    const append = vi.fn()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { append },
    })
    const create = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:curate/1')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const value = { version: '1.0', transactions: [{ value: '0' }] }

    downloadJson('tokens-changeGovernor.json', value)

    const blob = create.mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe(JSON.stringify(value, null, 2))
    expect(anchor.href).toBe('blob:curate/1')
    expect(anchor.download).toBe('tokens-changeGovernor.json')
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(append.mock.invocationCallOrder[0]).toBeLessThan(
      anchor.click.mock.invocationCallOrder[0],
    )
    expect(anchor.remove).toHaveBeenCalledOnce()
    // Freed only once the browser has had time to start the download.
    vi.advanceTimersByTime(999)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revoke).toHaveBeenCalledWith('blob:curate/1')
  })
})

/*
 * The Transaction Builder's reading of a dropped-in transaction, written apart
 * from the app's code (safe-react-apps, apps/tx-builder:
 * convertToProposedTransactions and encodeToHexData, whose web3-eth-abi coder
 * is ethers'): a transaction with `data` is signed as that data; one without
 * is encoded again from its fields, a whole number read from its digits and a
 * boolean from its word, every other value as written.
 */
const builderSigns = (transaction: {
  data: string | null
  contractMethod: {
    name: string
    inputs: { name: string; type: string }[]
  } | null
  contractInputsValues: Record<string, string> | null
}) => {
  if (transaction.data) return transaction.data
  const method = transaction.contractMethod!
  const values = method.inputs.map(({ name, type }) => {
    const text = transaction.contractInputsValues?.[name] || ''
    if (/^u?int\d*$/.test(type)) return ethers.BigNumber.from(text.trim())
    if (type === 'bool')
      return ['true', '1'].includes(text.trim().toLowerCase())
    return text
  })
  return new ethers.utils.Interface([
    { type: 'function', stateMutability: 'nonpayable', ...method },
  ]).encodeFunctionData(method.name, values)
}

const builderFile = (call: ContractCall) =>
  downloaded(safeTransactionBuilderJson({ ...BATCH, call })).transactions[0]

describe('what the Transaction Builder shows and signs', () => {
  const extraData = encodeExtraData(2, 5)
  const calls: ContractCall[] = [
    CALL,
    { ...CALL, functionName: 'changeGovernor', args: [SAFE.toLowerCase()] },
    {
      ...CALL,
      functionName: 'changeArbitrationParams',
      args: [
        ARBITRATOR,
        extraData,
        `/ipfs/${CID}/reg.json`,
        `/ipfs/${CID}/clr.json`,
      ],
    },
    { ...CALL, functionName: 'changeSharedStakeMultiplier', args: [10_000n] },
  ]

  it.each(calls)(
    'spells $functionName out, and the Builder signs exactly its calldata',
    (call) => {
      const transaction = builderFile(call)
      expect(transaction.data).toBeNull()
      expect(transaction.contractMethod?.name).toBe(call.functionName)
      expect(builderSigns(transaction).toLowerCase()).toBe(
        callData(call).toLowerCase(),
      )
    },
  )

  it('shows each value as the owner should check it', () => {
    const transaction = builderFile(calls[2])
    expect(transaction.contractInputsValues).toEqual({
      _arbitrator: ARBITRATOR,
      _arbitratorExtraData: extraData,
      _registrationMetaEvidence: `/ipfs/${CID}/reg.json`,
      _clearingMetaEvidence: `/ipfs/${CID}/clr.json`,
    })
    // An address the call holds in lowercase is shown checksummed.
    expect(builderFile(calls[1]).contractInputsValues).toEqual({
      _governor: SAFE,
    })
  })

  it("spells a Stake list's change out too", () => {
    const stake: ContractCall = {
      ...CALL,
      abi: permanentAbi as Abi,
      functionName: 'changeArbitrationParams',
      args: [extraData, `/ipfs/${CID}/meta.json`],
    }
    const transaction = builderFile(stake)
    expect(transaction.contractMethod?.name).toBe('changeArbitrationParams')
    expect(builderSigns(transaction).toLowerCase()).toBe(
      callData(stake).toLowerCase(),
    )
  })

  it('keeps the calldata for a call it cannot spell out', () => {
    const batchAbi = [
      {
        type: 'function',
        name: 'setMany',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'values', type: 'uint256[]' }],
        outputs: [],
      },
    ] as const
    const call: ContractCall = {
      ...CALL,
      abi: batchAbi as unknown as Abi,
      functionName: 'setMany',
      args: [[1n, 2n]],
    }
    const transaction = builderFile(call)
    expect(transaction).toMatchObject({
      data: callData(call),
      contractMethod: null,
      contractInputsValues: null,
    })
    expect(builderSigns(transaction)).toBe(callData(call))
  })

  it('still passes the Builder’s checksum check, spelled out', () => {
    expect(
      builderAccepts(
        downloaded(safeTransactionBuilderJson({ ...BATCH, call: calls[2] })),
      ),
    ).toBe(true)
  })
})
