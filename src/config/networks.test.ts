import { describe, expect, it } from 'vitest'
import { SUPPORTED_CHAINS } from './chains'
import { DEFAULT_NETWORK, NETWORKS, NETWORKS_INFO } from './networks'

const byNumber = (a: number, b: number) => a - b
const supported = SUPPORTED_CHAINS.map((chain) => Number(chain.id)).sort(
  byNumber,
)

describe('NETWORKS', () => {
  it('names every supported chain, and only those', () => {
    expect(Object.values(NETWORKS).sort(byNumber)).toEqual(supported)
  })

  it('cannot be changed at run time', () => {
    expect(Object.isFrozen(NETWORKS)).toBe(true)
    expect(Object.isFrozen(NETWORKS_INFO)).toBe(true)
  })

  it('opens on a supported chain', () => {
    expect(supported).toContain(DEFAULT_NETWORK)
  })
})

describe('NETWORKS_INFO', () => {
  it('describes every supported chain under its own id', () => {
    expect(Object.keys(NETWORKS_INFO).map(Number).sort(byNumber)).toEqual(
      supported,
    )
    for (const [key, info] of Object.entries(NETWORKS_INFO))
      expect(info.chainId).toBe(Number(key))
  })

  it.each(Object.values(NETWORKS_INFO).map((info) => [info.name, info]))(
    '%s has a name, a coin, a node and an explorer',
    (_name, info) => {
      expect(info.name).toBeTruthy()
      expect(info.nativeCurrency.decimals).toBe(18)
      expect(info.nativeCurrency.symbol).toBeTruthy()
      expect(info.rpc.length).toBeGreaterThan(0)
      for (const url of info.rpc) expect(url).toMatch(/^https:\/\//)
      expect(info.explorers).toHaveLength(1)
      expect(info.explorers[0].name).toBeTruthy()
      expect(info.explorers[0].url).toMatch(/^https:\/\/[^/]+$/)
    },
  )

  it('agrees with the chain definitions it is built from', () => {
    for (const chain of SUPPORTED_CHAINS) {
      const info = NETWORKS_INFO[chain.id as keyof typeof NETWORKS_INFO]
      expect(info.name).toBe(chain.name)
      expect(info.rpc).toEqual(chain.rpcUrls.default.http)
      expect(info.explorers[0].url).toBe(chain.blockExplorers?.default.url)
    }
  })
})
