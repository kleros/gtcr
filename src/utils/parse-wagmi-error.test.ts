import { ConnectorChainMismatchError } from '@wagmi/core'
import {
  type Abi,
  BaseError,
  ChainMismatchError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  type Hex,
  HttpRequestError,
  InsufficientFundsError,
  LimitExceededRpcError,
  TimeoutError,
  UserRejectedRequestError,
} from 'viem'
import { gnosis } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import lightGtcrAbi from 'assets/abis/LightGeneralizedTCR.json'
import permanentGtcrAbi from 'assets/abis/PermanentGTCR.json'
import { parseWagmiError } from './parse-wagmi-error'

const STAKE_ABI = permanentGtcrAbi as Abi
const STANDARD_ABI = lightGtcrAbi as Abi
const LIST = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const NETWORK_DOWN = 'The network did not answer. Try again in a moment.'

// Solidity's own revert shapes: require(…, "reason") and a panic code.
const SOLIDITY_ERRORS = [
  { type: 'error', name: 'Error', inputs: [{ name: 'm', type: 'string' }] },
  { type: 'error', name: 'Panic', inputs: [{ name: 'c', type: 'uint256' }] },
] as const

/** What a failed simulate or write throws: the revert, wrapped as viem wraps it. */
const reverted = (abi: Abi, data: Hex, functionName = 'addItem') =>
  new ContractFunctionExecutionError(
    new ContractFunctionRevertedError({ abi, data, functionName }),
    { abi, functionName, contractAddress: LIST, args: [] },
  )

const customError = (abi: Abi, errorName: string) =>
  reverted(abi, encodeErrorResult({ abi, errorName }))

const requireReason = (reason: string) =>
  reverted(
    STANDARD_ABI,
    encodeErrorResult({
      abi: SOLIDITY_ERRORS,
      errorName: 'Error',
      args: [reason],
    }),
  )

describe('parseWagmiError', () => {
  it.each([undefined, null, '', 0, false])('is empty for %j', (error) => {
    expect(parseWagmiError(error)).toBe('')
  })

  describe("a Stake list's custom errors", () => {
    const declared = STAKE_ABI.filter((item) => item.type === 'error').map(
      (item) => (item as { name: string }).name,
    )

    it('are all read from the ABI', () => {
      expect(declared.length).toBeGreaterThan(0)
    })

    it.each(declared)('%s reads in plain words', (errorName) => {
      const message = parseWagmiError(customError(STAKE_ABI, errorName))
      expect(message).not.toMatch(/^The contract refused this/)
      expect(message).not.toContain(errorName)
      expect(message).toMatch(/\.$/)
    })

    it('says what to do about a deposit that changed', () => {
      expect(
        parseWagmiError(customError(STAKE_ABI, 'BelowArbitrationDeposit')),
      ).toBe(
        'The amount sent does not cover the arbitration cost. Reload the page and try again.',
      )
    })

    it('names a custom error that has no sentence of its own', () => {
      const abi = [
        { type: 'error', name: 'ListFrozen', inputs: [] },
        ...STAKE_ABI,
      ] as Abi
      expect(parseWagmiError(customError(abi, 'ListFrozen'))).toBe(
        'The contract refused this: ListFrozen.',
      )
    })
  })

  describe("a Standard list's revert reasons", () => {
    it.each([
      [
        'Item must be absent to be added.',
        'This entry is already on the list or has a request open. Reload the page to see where it stands.',
      ],
      [
        'You must fully fund the request.',
        'The amount sent does not cover the deposit: it may have changed. Reload the page and try again.',
      ],
      [
        'Challenges must occur during the challenge period.',
        'The challenge period is over. Reload the page to see where it stands.',
      ],
      [
        'The caller must be the governor.',
        "Only the list's governor can do this.",
      ],
    ])('says %j for the person at the screen', (reason, message) => {
      expect(parseWagmiError(requireReason(reason))).toBe(message)
    })

    it('shows a reason it has no sentence for as the contract wrote it', () => {
      expect(parseWagmiError(requireReason('A new reason.'))).toBe(
        'A new reason.',
      )
    })

    it('reads a reason given with spaces around it', () => {
      expect(
        parseWagmiError({ reason: '  Side already fully funded.  ' }),
      ).toBe('This side of the appeal is already funded.')
    })

    it("shows a panic as viem words it, never as Solidity's own name", () => {
      const panic = reverted(
        STANDARD_ABI,
        encodeErrorResult({
          abi: SOLIDITY_ERRORS,
          errorName: 'Panic',
          args: [0x11n],
        }),
      )
      expect(parseWagmiError(panic)).toBe(
        'Arithmetic operation resulted in underflow or overflow.',
      )
    })

    it('does not name "Error" as a custom error when it carries no reason', () => {
      expect(
        parseWagmiError({
          data: { errorName: 'Error' },
          shortMessage: 'Execution reverted.',
        }),
      ).toBe('Execution reverted.')
    })
  })

  describe('wallet and network failures', () => {
    it.each([
      ['viem', new ChainMismatchError({ chain: gnosis, currentChainId: 1 })],
      [
        'wagmi',
        new ConnectorChainMismatchError({
          connectionChainId: 1,
          connectorChainId: 100,
        }),
      ],
    ])("asks to switch networks on %s's chain mismatch", (_, error) => {
      expect(
        parseWagmiError(new BaseError('Could not send.', { cause: error })),
      ).toBe(
        "Your wallet is on another network. Switch it to this page's network and try again.",
      )
    })

    it.each([
      ['viem names it', new InsufficientFundsError()],
      [
        'only the node says it',
        {
          shortMessage: 'An internal error was received.',
          details: 'insufficient funds for gas * price + value: balance 0',
        },
      ],
      ['the message says it', new Error('Insufficient funds for transfer')],
    ])('says the wallet is short when %s', (_, error) => {
      expect(parseWagmiError(error)).toBe(
        'Your wallet does not hold enough for this amount plus the network fee.',
      )
    })

    it.each([
      [
        'an HTTP failure',
        new HttpRequestError({ url: 'https://rpc.test', status: 503 }),
      ],
      ['a timeout', new TimeoutError({ body: {}, url: 'https://rpc.test' })],
      ['a rate limit', new LimitExceededRpcError(new Error('limit exceeded'))],
      [
        'a 429 deep in the causes',
        { message: 'Failed.', cause: { cause: { status: 429 } } },
      ],
    ])('says the network did not answer for %s', (_, error) => {
      expect(parseWagmiError(error)).toBe(NETWORK_DOWN)
    })

    it.each([
      // What kleros-app throws for Atlas's 429, word for word.
      [
        'as kleros-app throws it',
        new Error('ThrottlerException: Too Many Requests'),
      ],
      [
        'under another error',
        {
          message: 'Failed to upload meta-evidence to IPFS.',
          cause: new Error('ThrottlerException: Too Many Requests'),
        },
      ],
    ])(
      'says to wait a minute when Atlas refused an upload over its limit, %s',
      (_, error) => {
        expect(parseWagmiError(error)).toBe(
          'Uploads are limited to 5 a minute per wallet. Wait a minute, then try again.',
        )
      },
    )
  })

  describe('the headline', () => {
    it("gives viem's headline, not the lines of context under it", () => {
      const error = new BaseError('The list could not be read.', {
        details: 'execution reverted',
        metaMessages: ['Request Arguments:', `  to: ${LIST}`],
      })
      expect(error.message.split('\n').length).toBeGreaterThan(1)
      expect(parseWagmiError(error)).toBe('The list could not be read.')
    })

    it("gives a cause's headline before the outer error's message", () => {
      expect(
        parseWagmiError({
          message: 'Outer failure\nwith details',
          cause: { shortMessage: 'Inner headline.\nMore.' },
        }),
      ).toBe('Inner headline.')
    })

    it("gives the first line of a plain error's message", () => {
      expect(parseWagmiError(new Error('First line.\nSecond line.'))).toBe(
        'First line.',
      )
    })

    it('passes on what the wallet said when the person declined', () => {
      expect(
        parseWagmiError(
          new UserRejectedRequestError(new Error('User denied signature.')),
        ),
      ).toBe('User rejected the request.')
    })

    it('says "Unknown error" when nothing says what went wrong', () => {
      expect(parseWagmiError({})).toBe('Unknown error')
      expect(parseWagmiError(new Error('   '))).toBe('Unknown error')
    })
  })

  describe('odd shapes', () => {
    it('stops on a cause that points back at itself', () => {
      const error: Record<string, unknown> = { shortMessage: '' }
      error.cause = error
      expect(parseWagmiError(error)).toBe('Unknown error')
    })

    it.each([
      ['data that is raw hex', { data: '0x08c379a0', message: 'Reverted.' }],
      ['data that is null', { data: null, message: 'Reverted.' }],
      [
        'an errorName that is not text',
        { data: { errorName: 7 }, message: 'Reverted.' },
      ],
      [
        'a reason that is not text',
        { reason: { text: 'x' }, message: 'Reverted.' },
      ],
    ])('reads past %s', (_, error) => {
      expect(parseWagmiError(error)).toBe('Reverted.')
    })

    it.each(['boom', 42, Symbol('x'), ['a']])(
      'never throws on a thrown %s',
      (error) => {
        expect(typeof parseWagmiError(error)).toBe('string')
      },
    )
  })
})
