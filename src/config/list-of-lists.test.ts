import { describe, expect, it } from 'vitest'
import { SUPPORTED_CHAINS } from './chains'
import {
  VERIFIED_LIST_OF_LISTS_ADDRESSES,
  getListOfListsAddresses,
  getListOfListsHistory,
  isListOfLists,
  replacedListOfLists,
  succeededListOfLists,
} from './list-of-lists'
import { NETWORKS } from './networks'
import { defaultTcrAddresses } from './tcr-addresses'

const ADDRESS = /^0x[0-9a-f]{40}$/

const ETHEREUM = NETWORKS.ethereum
const GNOSIS = NETWORKS.gnosis
const SEPOLIA = NETWORKS.sepolia

const CURRENT = {
  [ETHEREUM]: '0x2acf59a420ca888f46d46974f62570f8a38cd4da',
  [GNOSIS]: '0x5f688a4bac5e2787ef1d9de325831e537ee4cffa',
  [SEPOLIA]: '0xd965ce430afe0423ff19a5eb08f7c5722efabcaf',
}
// The Classic lists of lists Kleros used until 11 Aug 2026.
const RETIRED = {
  [ETHEREUM]: '0xba0304273a54dfec1fc7f4bccbf4b15519aecf15',
  [GNOSIS]: '0x2442d40b0aecad0298c2724a97f2f1bbdf2c2615',
}
// The Standard list of lists Gnosis moved off on 17 Nov 2026.
const FORMER_GNOSIS = '0x2418d887d0d0fe03b793a6af4321fa488226a0b5'

const supported = SUPPORTED_CHAINS.map((chain) => Number(chain.id))

describe('the Kleros lists of lists', () => {
  it.each(supported)('chain %i has one, as a lowercase address', (chainId) => {
    const addresses = getListOfListsAddresses(chainId)
    expect(addresses).toHaveLength(1)
    expect(addresses[0]).toMatch(ADDRESS)
  })

  it('is the list each chain’s wizards submit new lists to', () => {
    for (const chainId of supported)
      expect(getListOfListsAddresses(chainId)).toEqual([
        defaultTcrAddresses[chainId]?.toLowerCase(),
      ])
  })

  it('names a list of lists for exactly the supported chains', () => {
    expect(
      Object.keys(VERIFIED_LIST_OF_LISTS_ADDRESSES).map(Number).sort(),
    ).toEqual([...supported].sort())
  })

  it('has none on a chain the app does not support', () => {
    expect(getListOfListsAddresses(137)).toEqual([])
  })
})

describe('isListOfLists', () => {
  it.each([
    ['the current one', true, ETHEREUM, CURRENT[ETHEREUM]],
    [
      'in any case',
      true,
      GNOSIS,
      CURRENT[GNOSIS].toUpperCase().replace('0X', '0x'),
    ],
    ['Sepolia’s own', true, SEPOLIA, CURRENT[SEPOLIA]],
    ['another chain’s', false, ETHEREUM, CURRENT[GNOSIS]],
    ['a retired Classic one', false, ETHEREUM, RETIRED[ETHEREUM]],
    ['the former Gnosis one', false, GNOSIS, FORMER_GNOSIS],
    [
      'any other list',
      false,
      GNOSIS,
      '0x1111111111111111111111111111111111111111',
    ],
    ['no address', false, GNOSIS, undefined],
    ['no chain', false, undefined, CURRENT[GNOSIS]],
    ['a null chain', false, null, CURRENT[GNOSIS]],
  ])('%s: %s', (_name, expected, chainId, address) => {
    expect(isListOfLists(chainId, address)).toBe(expected)
  })
})

describe('replacedListOfLists', () => {
  it.each([ETHEREUM, GNOSIS])(
    'points chain %i’s retired Classic list of lists to the current one',
    (chainId) => {
      expect(replacedListOfLists(chainId, RETIRED[chainId])).toBe(
        CURRENT[chainId],
      )
      expect(replacedListOfLists(chainId, RETIRED[chainId].toUpperCase())).toBe(
        CURRENT[chainId],
      )
    },
  )

  it.each([
    ['the current list of lists', GNOSIS, CURRENT[GNOSIS]],
    ['another chain’s retired one', GNOSIS, RETIRED[ETHEREUM]],
    ['the former Standard one', GNOSIS, FORMER_GNOSIS],
    ['a chain with none retired', SEPOLIA, RETIRED[ETHEREUM]],
    ['no address', ETHEREUM, null],
    ['no chain', null, RETIRED[ETHEREUM]],
  ])('replaces nothing for %s', (_name, chainId, address) => {
    expect(replacedListOfLists(chainId, address)).toBeNull()
  })
})

describe('succeededListOfLists', () => {
  it('points the former Gnosis list of lists to the current one', () => {
    expect(succeededListOfLists(GNOSIS, FORMER_GNOSIS)).toBe(CURRENT[GNOSIS])
    expect(succeededListOfLists(GNOSIS, FORMER_GNOSIS.toUpperCase())).toBe(
      CURRENT[GNOSIS],
    )
  })

  it.each([
    ['the current list of lists', GNOSIS, CURRENT[GNOSIS]],
    ['the former address on another chain', ETHEREUM, FORMER_GNOSIS],
    ['a retired Classic one', GNOSIS, RETIRED[GNOSIS]],
    ['no address', GNOSIS, undefined],
    ['no chain', undefined, FORMER_GNOSIS],
  ])('succeeds nothing for %s', (_name, chainId, address) => {
    expect(succeededListOfLists(chainId, address)).toBeNull()
  })
})

describe('getListOfListsHistory', () => {
  it('holds the current list of lists first, then the former one', () => {
    expect(getListOfListsHistory(GNOSIS)).toEqual([
      CURRENT[GNOSIS],
      FORMER_GNOSIS,
    ])
  })

  it.each([ETHEREUM, SEPOLIA])(
    'is only the current one on chain %i, which moved nowhere',
    (chainId) => {
      expect(getListOfListsHistory(chainId)).toEqual([CURRENT[chainId]])
    },
  )

  it('never holds a retired Classic list of lists', () => {
    for (const chainId of supported)
      for (const retired of Object.values(RETIRED))
        expect(getListOfListsHistory(chainId)).not.toContain(retired)
  })

  it('is empty on a chain with no list of lists', () => {
    expect(getListOfListsHistory(137)).toEqual([])
  })
})
