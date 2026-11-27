import { describe, expect, it } from 'vitest'
import {
  NETWORK_OPTIONS,
  listHasNetworks,
  networkPrefixes,
  networkSummary,
  networksFrom,
  stakeNetworkWhere,
  standardNetworkWhere,
  withNetworkToggled,
} from './registry-shared-network'

describe('listHasNetworks', () => {
  it('is true when the first identifying column is a rich address', () => {
    expect(
      listHasNetworks([
        { type: 'image', isIdentifier: false },
        { type: 'rich address', isIdentifier: true },
        { type: 'text', isIdentifier: true },
      ]),
    ).toBe(true)
  })

  it('is false when the first identifier is anything else', () => {
    expect(
      listHasNetworks([
        { type: 'text', isIdentifier: true },
        { type: 'rich address', isIdentifier: true },
      ]),
    ).toBe(false)
    expect(listHasNetworks([{ type: 'rich address' }])).toBe(false)
    expect(listHasNetworks(undefined)).toBe(false)
  })
})

describe('network options', () => {
  it('lists each network once, Solana matching both of its references', () => {
    const keys = NETWORK_OPTIONS.map((option) => option.key)
    expect(new Set(keys).size).toBe(keys.length)
    const solana = NETWORK_OPTIONS.filter((option) => option.name === 'Solana')
    expect(solana).toHaveLength(1)
    expect(solana[0].prefixes).toHaveLength(2)
    // The URL key is the reference still in use.
    expect(solana[0].key).toBe('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
  })
})

describe('URL state', () => {
  it('reads known networks only, in menu order', () => {
    expect(networksFrom('?network=eip155:8453,eip155:1,nope:1')).toEqual([
      'eip155:1',
      'eip155:8453',
    ])
    expect(networksFrom('?q=x')).toEqual([])
  })

  it('toggles a network, clears with all, and drops the page', () => {
    const one = withNetworkToggled('?page=3&q=usdc', 'eip155:137')
    expect(new URLSearchParams(one).get('network')).toBe('eip155:137')
    expect(new URLSearchParams(one).get('page')).toBeNull()
    expect(new URLSearchParams(one).get('q')).toBe('usdc')
    const two = withNetworkToggled(one, 'eip155:1')
    expect(networksFrom(two)).toEqual(['eip155:1', 'eip155:137'])
    expect(networksFrom(withNetworkToggled(two, 'eip155:1'))).toEqual([
      'eip155:137',
    ])
    expect(
      new URLSearchParams(withNetworkToggled(two, 'all')).has('network'),
    ).toBe(false)
  })

  it('summarises the choice for the trigger', () => {
    expect(networkSummary([])).toBe('All')
    expect(networkSummary(['eip155:8453'])).toBe('Base Mainnet')
    expect(networkSummary(['eip155:1', 'eip155:8453'])).toBe('2 networks')
  })
})

describe('query clauses', () => {
  it('matches the network prefix with its colon, so 1 never matches 10', () => {
    expect(networkPrefixes(['eip155:1'])).toEqual(['eip155:1:'])
    expect(standardNetworkWhere(['eip155:1:'])).toEqual({
      key0: { _ilike: 'eip155:1:%' },
    })
  })

  it('ORs several networks, and asks nothing for none', () => {
    expect(standardNetworkWhere([])).toBeUndefined()
    expect(standardNetworkWhere(['eip155:1:', 'eip155:10:'])).toEqual({
      _or: [
        { key0: { _ilike: 'eip155:1:%' } },
        { key0: { _ilike: 'eip155:10:%' } },
      ],
    })
    expect(stakeNetworkWhere(['eip155:100:'])).toEqual({
      metadata_: { key0_starts_with_nocase: 'eip155:100:' },
    })
    expect(stakeNetworkWhere(['eip155:1:', 'eip155:100:'])).toEqual({
      or: [
        { metadata_: { key0_starts_with_nocase: 'eip155:1:' } },
        { metadata_: { key0_starts_with_nocase: 'eip155:100:' } },
      ],
    })
  })

  it('escapes LIKE wildcards in a reference', () => {
    expect(standardNetworkWhere(['a_b:%:'])).toEqual({
      key0: { _ilike: 'a\\_b:\\%:%' },
    })
  })
})
