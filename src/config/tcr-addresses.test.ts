import { ethers } from 'ethers'
import { describe, expect, it } from 'vitest'
import { SUPPORTED_CHAINS } from './chains'
import * as config from './tcr-addresses'
import {
  defaultArbitrator,
  defaultArbitratorExtraData,
  defaultEvidenceDisplayUri,
  defaultEvidenceDisplayUriPermanent,
  defaultGovernor,
  governorNeedsWallet,
  isKlerosArbitrator,
  klerosAddresses,
  lgtcrFactoryAddresses,
  registryFactories,
  seerAddresses,
  subgraphUrl,
  subgraphUrlPermanent,
} from './tcr-addresses'

const supported = SUPPORTED_CHAINS.map((chain) => Number(chain.id))

/**
 * A well-formed address, consistently cased: all lowercase, or a valid
 * EIP-55 checksum (a typo in a checksummed address fails the checksum).
 */
const expectAddress = (value: string | undefined) => {
  expect(value).toMatch(/^0x[0-9a-fA-F]{40}$/)
  const address = value as string
  if (address !== address.toLowerCase())
    expect(ethers.utils.getAddress(address)).toBe(address)
}

/** The chain-keyed maps of one contract address per chain. */
const ADDRESS_MAPS = {
  defaultTcrAddresses: config.defaultTcrAddresses,
  standardGtcrViewAddresses: config.standardGtcrViewAddresses,
  standardBatchWithdrawAddresses: config.standardBatchWithdrawAddresses,
  lgtcrFactoryAddresses: config.lgtcrFactoryAddresses,
  pgtcrFactoryAddresses: config.pgtcrFactoryAddresses,
}

describe('every supported chain', () => {
  const cases = Object.entries(ADDRESS_MAPS).flatMap(([name, map]) =>
    supported.map((chainId) => [name, chainId, map] as const),
  )

  it.each(cases)('has a valid %s on chain %i', (_name, chainId, map) => {
    expectAddress(map[chainId])
    // The maps take numeric and string chain ids alike.
    expect(map[String(chainId)]).toBe(map[chainId])
  })

  it.each(supported)(
    'has its Kleros court and governor on chain %i',
    (chainId) => {
      expectAddress(defaultArbitrator[chainId]?.address)
      expectAddress(defaultGovernor[chainId]?.address)
      expectAddress(klerosAddresses[chainId]?.arbitrator)
      expectAddress(klerosAddresses[chainId]?.policy)
    },
  )

  it.each(supported)('has evidence displays on IPFS on chain %i', (chainId) => {
    for (const uri of [
      defaultEvidenceDisplayUri[chainId],
      defaultEvidenceDisplayUriPermanent[chainId],
    ])
      expect(uri).toMatch(/^\/ipfs\/Qm[1-9A-HJ-NP-Za-km-z]{44}\/index\.html$/)
  })

  it.each(supported)(
    'has extra data naming a court and at least one juror on chain %i',
    (chainId) => {
      const data = defaultArbitratorExtraData[chainId]?.data ?? ''
      expect(data).toMatch(/^0x[0-9a-f]{128}$/)
      const [court, jurors] = ethers.utils.defaultAbiCoder.decode(
        ['uint256', 'uint256'],
        data,
      )
      expect(court.gte(0)).toBe(true)
      expect(jurors.gte(1)).toBe(true)
    },
  )

  it.each(supported)(
    'has both indexers wired to its own chain’s variable (%i)',
    (chainId) => {
      // vitest.config.ts sets each placeholder URL to end in its chain id.
      expect(subgraphUrl[chainId]).toMatch(new RegExp(`/${chainId}$`))
      expect(subgraphUrlPermanent[chainId]).toMatch(new RegExp(`/${chainId}$`))
      expect(subgraphUrl[chainId]).not.toBe(subgraphUrlPermanent[chainId])
    },
  )

  it.each(supported)(
    'has a tracked Standard factory on chain %i',
    (chainId) => {
      const factories = registryFactories[chainId] ?? []
      expect(factories.length).toBeGreaterThan(0)
      for (const factory of factories) {
        expectAddress(factory.address)
        expect(Number.isInteger(factory.startBlock)).toBe(true)
        expect(factory.startBlock).toBeGreaterThan(0)
      }
    },
  )

  it.each(supported)(
    'creates lists with a factory the indexer tracks on chain %i',
    (chainId) => {
      // A list made by an untracked factory would have no creation time.
      const tracked = (registryFactories[chainId] ?? []).map((factory) =>
        factory.address.toLowerCase(),
      )
      expect(tracked).toContain(lgtcrFactoryAddresses[chainId]?.toLowerCase())
    },
  )

  it.each(supported)(
    'offers the court it names as Kleros as the default arbitrator (%i)',
    (chainId) => {
      expect(defaultArbitrator[chainId]?.address.toLowerCase()).toBe(
        klerosAddresses[chainId]?.arbitrator.toLowerCase(),
      )
    },
  )

  it.each(supported)(
    'links its court cases on its own chain (%i)',
    (chainId) => {
      const url = klerosAddresses[chainId]?.uiURL ?? ''
      expect(url).toMatch(/^https:\/\/court\.kleros\.io\//)
      expect(url).toContain(':disputeID')
      expect(
        new URL(url.replace(':disputeID', '7')).searchParams.get(
          'requiredChainId',
        ),
      ).toBe(String(chainId))
    },
  )
})

describe('seerAddresses', () => {
  it('names Seer on the mainnets only, each a valid address', () => {
    expect(Object.keys(seerAddresses).map(Number).sort()).toEqual([1, 100])
    for (const address of Object.values(seerAddresses)) expectAddress(address)
  })
})

describe('isKlerosArbitrator', () => {
  const ethereum = klerosAddresses[1]?.arbitrator as string
  const gnosis = klerosAddresses[100]?.arbitrator as string

  it.each([
    ['the chain’s court', true, 1, ethereum],
    ['in any case', true, 1, ethereum.toUpperCase().replace('0X', '0x')],
    ['with a string chain id', true, '100', gnosis.toLowerCase()],
    ['another chain’s court', false, 100, ethereum],
    [
      'any other arbitrator',
      false,
      1,
      '0x1111111111111111111111111111111111111111',
    ],
    ['a chain with no court', false, 137, ethereum],
    ['no address', false, 1, undefined],
    ['no chain', false, null, ethereum],
    ['an undefined chain', false, undefined, ethereum],
  ])('%s: %s', (_name, expected, chainId, address) => {
    expect(isKlerosArbitrator(chainId, address)).toBe(expected)
  })
})

describe('governorNeedsWallet', () => {
  const placeholder = defaultGovernor[100]?.address as string
  const klerosGovernor = defaultGovernor[1]?.address as string

  it.each([
    ['an empty value', true, '', 100],
    ['no value', true, undefined, 1],
    ['the chain’s placeholder', true, placeholder, 100],
    [
      'the placeholder in another case',
      true,
      placeholder.toLowerCase(),
      11_155_111,
    ],
    [
      'Ethereum’s Kleros Governor, which is no placeholder',
      false,
      klerosGovernor,
      1,
    ],
    [
      'the creator’s own address',
      false,
      '0x1111111111111111111111111111111111111111',
      100,
    ],
    [
      'an address with no chain to compare it to',
      false,
      placeholder,
      undefined,
    ],
  ])('%s: %s', (_name, expected, value, chainId) => {
    expect(governorNeedsWallet(value, chainId)).toBe(expected)
  })
})
