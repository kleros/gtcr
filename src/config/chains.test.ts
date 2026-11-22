import { describe, expect, it } from 'vitest'
import { TESTNET_CHAIN_IDS } from 'pages/dashboard/view'
import {
  DEFAULT_CHAIN,
  SUPPORTED_CHAINS,
  getChainById,
  getExplorerUrl,
  getNativeCurrency,
  gnosis,
  mainnet,
} from './chains'

const ids = SUPPORTED_CHAINS.map((chain) => Number(chain.id))

describe('SUPPORTED_CHAINS', () => {
  it('are Ethereum, Gnosis and the Sepolia testnet', () => {
    expect(ids).toEqual([1, 100, 11_155_111])
  })

  it('flag as testnets exactly the chains the pages keep out of "All chains"', () => {
    const testnets = SUPPORTED_CHAINS.filter((chain) => chain.testnet).map(
      (chain) => Number(chain.id),
    )
    expect(testnets).toEqual(TESTNET_CHAIN_IDS)
  })

  it.each(SUPPORTED_CHAINS.map((chain) => [chain.name, chain] as const))(
    '%s has a public https node and an https explorer',
    (_name, chain) => {
      expect(chain.rpcUrls.default.http.length).toBeGreaterThan(0)
      for (const url of chain.rpcUrls.default.http)
        expect(url).toMatch(/^https:\/\//)
      expect(chain.blockExplorers?.default.url).toMatch(/^https:\/\//)
    },
  )

  it('opens on a mainnet', () => {
    expect(ids).toContain(Number(DEFAULT_CHAIN.id))
    expect(TESTNET_CHAIN_IDS).not.toContain(Number(DEFAULT_CHAIN.id))
  })

  it('reads Ethereum from a node that takes browser requests', () => {
    // eth.merkle.io, the chain's default, answers the CORS preflight with 405.
    expect(mainnet.rpcUrls.default.http.join(' ')).not.toMatch(/merkle\.io/)
  })

  it('derives the Gnosis explorer API from the one Blockscout URL', () => {
    const explorer = gnosis.blockExplorers.default
    expect(explorer.url).toMatch(/blockscout/)
    expect(explorer.apiUrl).toBe(`${explorer.url}/api`)
  })
})

describe('getChainById', () => {
  it.each([1, '1', 100, '100', 11_155_111, '11155111'])(
    'finds chain %s by a numeric or string id',
    (chainId) => {
      expect(Number(getChainById(chainId)?.id)).toBe(Number(chainId))
    },
  )

  it.each([137, '137', 0, 'abc'])('finds nothing for %s', (chainId) => {
    expect(getChainById(chainId)).toBeUndefined()
  })
})

describe('getExplorerUrl', () => {
  it('links each chain to its own explorer', () => {
    expect(getExplorerUrl(1)).toBe(mainnet.blockExplorers.default.url)
    expect(getExplorerUrl('100')).toBe(gnosis.blockExplorers.default.url)
    expect(getExplorerUrl(11_155_111)).toMatch(/sepolia/)
  })

  it('falls back to Etherscan for a chain it does not know', () => {
    expect(getExplorerUrl(137)).toBe('https://etherscan.io')
  })
})

describe('getNativeCurrency', () => {
  it('writes Gnosis’s coin xDAI, as the Kleros docs do', () => {
    expect(getNativeCurrency(100)).toMatchObject({
      symbol: 'xDAI',
      decimals: 18,
    })
    expect(getNativeCurrency('100').symbol).toBe('xDAI')
  })

  it('leaves the chain definition itself untouched', () => {
    const before = { ...gnosis.nativeCurrency }
    getNativeCurrency(100)
    expect(gnosis.nativeCurrency).toEqual(before)
  })

  it.each([1, 11_155_111])('names chain %i’s coin ETH', (chainId) => {
    expect(getNativeCurrency(chainId)).toMatchObject({
      symbol: 'ETH',
      decimals: 18,
    })
  })

  it('falls back to Ether for a chain it does not know', () => {
    expect(getNativeCurrency(137)).toEqual({
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    })
  })
})
