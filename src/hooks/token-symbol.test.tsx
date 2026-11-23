import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ethers } from 'ethers'
import { describe, expect, it, vi } from 'vitest'
import useTokenSymbol from './token-symbol'

const node = vi.hoisted(() => ({ provider: undefined as unknown }))

vi.mock('hooks/ethers-adapters', () => ({
  useEthersProvider: () => node.provider,
}))
vi.mock('hooks/use-web3-context', () => ({
  useWeb3Context: () => ({ networkId: 100 }),
}))
vi.mock('hooks/use-url-chain-id', () => ({ default: () => 100 }))

const TOKEN = '0x1111111111111111111111111111111111111111'
const SYMBOL = '0x95d89b41'
const DECIMALS = '0x313ce567'
const coder = ethers.utils.defaultAbiCoder

/** What ethers' request throws when no node answers (offline, blocked). */
const noAnswer = () =>
  Object.assign(new Error('missing response'), {
    code: ethers.errors.SERVER_ERROR,
    reason: 'missing response',
    url: 'https://rpc.test',
  })

/** What it throws when the node ran the call and it failed. */
const ranAndFailed = (code: number, message: string) => () =>
  Object.assign(new Error('processing response error'), {
    code: ethers.errors.SERVER_ERROR,
    body: JSON.stringify({ id: 42, jsonrpc: '2.0', error: { code, message } }),
    error: Object.assign(new Error(message), { code }),
  })

// As rpc.gnosischain.com answers a call to a function a contract lacks.
const reverted = ranAndFailed(3, 'execution reverted')
// As geth answers an old contract that stops on an invalid opcode.
const invalidOpcode = ranAndFailed(-32000, 'invalid opcode: INVALID')

type Answer = () => string

/**
 * A JSON-RPC node that answers each token function as told. ethers wraps
 * what it throws the way it wraps a real node's errors.
 */
class FakeNode extends ethers.providers.StaticJsonRpcProvider {
  constructor(private readonly answers: Record<string, Answer>) {
    super('https://rpc.test', { chainId: 100, name: 'gnosis' })
  }

  async send(method: string, params: Array<{ data?: string }>) {
    if (method === 'eth_chainId') return '0x64'
    if (method !== 'eth_call') throw new Error(`Unexpected ${method}`)
    return this.answers[params[0].data?.slice(0, 10) ?? '']()
  }
}

const usdc = (
  decimals: Answer,
  symbol: Answer = () => coder.encode(['string'], ['USDC']),
) => {
  node.provider = new FakeNode({ [SYMBOL]: symbol, [DECIMALS]: decimals })
}

/** One React Query cache, as the app has, that never retries by itself. */
const sharedCache = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return Wrapper
}

/** Mounts a reader of the token and waits for its read to settle. */
const read = async (wrapper: ReturnType<typeof sharedCache>) => {
  const hook = renderHook(() => useTokenSymbol(TOKEN), { wrapper })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useTokenSymbol', () => {
  it('reads the symbol and decimals', async () => {
    usdc(() => coder.encode(['uint8'], [6]))
    const { result } = await read(sharedCache())
    expect(result.current).toEqual({
      symbol: 'USDC',
      decimals: 6,
      decimalsRead: true,
      loading: false,
    })
  })

  it('reads decimals again after a node failed, instead of keeping 18', async () => {
    let decimals: Answer = () => {
      throw noAnswer()
    }
    usdc(() => decimals())
    const wrapper = sharedCache()

    const first = await read(wrapper)
    // What the Stake submit page refuses on: decimals unknown, not loading.
    expect(first.result.current.decimalsRead).toBe(false)
    first.unmount()

    // The node answers again: the next page that reads the token gets 6.
    decimals = () => coder.encode(['uint8'], [6])
    const second = await read(wrapper)
    expect(second.result.current).toMatchObject({
      symbol: 'USDC',
      decimals: 6,
      decimalsRead: true,
    })
  })

  it('reads the symbol again after a node failed, instead of keeping the address', async () => {
    let symbol: Answer = () => {
      throw noAnswer()
    }
    usdc(
      () => coder.encode(['uint8'], [6]),
      () => symbol(),
    )
    const wrapper = sharedCache()

    const first = await read(wrapper)
    first.unmount()

    symbol = () => coder.encode(['string'], ['USDC'])
    const second = await read(wrapper)
    expect(second.result.current.symbol).toBe('USDC')
  })

  it.each([
    ['a revert', reverted],
    ['an invalid opcode', invalidOpcode],
  ])(
    'takes %s as the token having no decimals(), and keeps its symbol',
    async (_, failure) => {
      usdc(() => {
        throw failure()
      })
      const { result } = await read(sharedCache())
      expect(result.current).toEqual({
        symbol: 'USDC',
        decimals: 18,
        decimalsRead: false,
        loading: false,
      })
    },
  )

  it('takes empty answers as no token at the address', async () => {
    usdc(
      () => '0x',
      () => '0x',
    )
    const { result } = await read(sharedCache())
    expect(result.current).toEqual({
      symbol: 'tokens',
      decimals: 18,
      decimalsRead: false,
      loading: false,
    })
  })
})
