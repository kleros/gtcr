import { describe, expect, it, vi } from 'vitest'
import { request } from 'utils/indexer-request'
import { entryKey, fetchEntryImages, type EntryRef } from './entry-images'

vi.mock('utils/indexer-request', () => ({ request: vi.fn() }))

const LIST = '0x00000000000000000000000000000000000000AA'
const STAKE_LIST = '0x00000000000000000000000000000000000000bb'

const entry = (
  itemID: string,
  overrides: Partial<EntryRef> = {},
): EntryRef => ({
  chainId: 100,
  registryAddress: LIST,
  itemID,
  kind: 'standard',
  ...overrides,
})

type Prop = { type?: string | null; value?: string | null }

/** The Standard indexer (LItem props) and the Stake subgraphs (metadata). */
const indexers = (answers: {
  standard?: Record<string, Prop[]>
  stake?: Record<string, Prop[]>
  failing?: string[]
}) =>
  vi.mocked(request).mockImplementation((async (
    url: string,
    document: string,
    variables: { ids: string[] },
  ) => {
    if (answers.failing?.includes(url)) throw new Error('indexer down')
    if (document.includes('BrowseStakeEntryImages'))
      return {
        items: variables.ids
          .filter((id) => answers.stake?.[id])
          .map((id) => ({ id, metadata: { props: answers.stake?.[id] } })),
      }
    return {
      LItem: variables.ids
        .filter((id) => answers.standard?.[id])
        .map((id) => ({ id, props: answers.standard?.[id] })),
    }
  }) as never)

describe('entryKey', () => {
  it('is the id both indexers give an entry, lowercase', () => {
    expect(entryKey({ itemID: '0xABC', registryAddress: LIST })).toBe(
      `0xabc@${LIST.toLowerCase()}`,
    )
  })
})

describe('fetchEntryImages', () => {
  it('asks each chain’s Standard indexer once for its entries’ images', async () => {
    const id = entryKey(entry('0x01'))
    indexers({ standard: { [id]: [{ value: '/ipfs/QmLogo/logo.png' }] } })
    const images = await fetchEntryImages([
      entry('0x01'),
      entry('0x02'),
      entry('0x03', { chainId: 1 }),
    ])
    expect(images).toEqual({ [id]: '/ipfs/QmLogo/logo.png' })
    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenCalledWith(
      'https://standard.indexer.test/100',
      expect.any(String),
      {
        ids: [entryKey(entry('0x01')), entryKey(entry('0x02'))],
        chainId: 100,
        image: 'image',
      },
    )
  })

  it('reads a Stake entry’s image field from its subgraph', async () => {
    const ref = entry('0x09', {
      kind: 'permanent',
      registryAddress: STAKE_LIST,
    })
    indexers({
      stake: {
        [entryKey(ref)]: [
          { type: 'text', value: 'Kleros' },
          { type: 'image', value: '  /ipfs/QmStake/picture.png ' },
        ],
      },
    })
    expect(await fetchEntryImages([ref])).toEqual({
      [entryKey(ref)]: '/ipfs/QmStake/picture.png',
    })
    expect(request).toHaveBeenCalledWith(
      'https://stake.indexer.test/100',
      expect.any(String),
      { ids: [entryKey(ref)] },
    )
  })

  it.each([
    ['an empty value', ''],
    ['only spaces', '   '],
    ['the "-" placeholder', '-'],
    ['no value', null],
  ])('finds no image in %s', async (_name, value) => {
    const ref = entry('0x01')
    indexers({ standard: { [entryKey(ref)]: [{ value }] } })
    expect(await fetchEntryImages([ref])).toEqual({})
  })

  it('takes a Stake entry’s first image that holds one, never another field', async () => {
    const ref = entry('0x09', { kind: 'permanent' })
    indexers({
      stake: {
        [entryKey(ref)]: [
          { type: 'text', value: '/ipfs/QmNotAPicture' },
          { type: 'image', value: '-' },
          { type: 'image', value: '/ipfs/QmSecond/b.png' },
        ],
      },
    })
    expect(await fetchEntryImages([ref])).toEqual({
      [entryKey(ref)]: '/ipfs/QmSecond/b.png',
    })
  })

  it('leaves a failed chain’s entries on their list’s logo, and keeps the rest', async () => {
    const gnosis = entry('0x01')
    const ethereum = entry('0x02', { chainId: 1 })
    indexers({
      standard: {
        [entryKey(gnosis)]: [{ value: '/ipfs/QmA/a.png' }],
        [entryKey(ethereum)]: [{ value: '/ipfs/QmB/b.png' }],
      },
      failing: ['https://standard.indexer.test/1'],
    })
    expect(await fetchEntryImages([gnosis, ethereum])).toEqual({
      [entryKey(gnosis)]: '/ipfs/QmA/a.png',
    })
  })

  it('asks nothing for a chain with no indexer, or for no entries', async () => {
    expect(await fetchEntryImages([entry('0x01', { chainId: 137 })])).toEqual(
      {},
    )
    expect(await fetchEntryImages([])).toEqual({})
    expect(request).not.toHaveBeenCalled()
  })
})
