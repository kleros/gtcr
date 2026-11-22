import { describe, expect, it } from 'vitest'
import { namespaces, parseRichAddress, references } from './rich-address'

const ETH = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const BTC = '000000000019d6689c085ae165831e93'
const SOLANA = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
const TON_RAW = `0:${'ab'.repeat(32)}`

const test = (namespaceId: string) =>
  namespaces.find((namespace) => namespace.id === namespaceId)?.test ??
  (() => {
    throw new Error(`No namespace ${namespaceId}`)
  })

describe('parseRichAddress', () => {
  it('reads "<namespace>:<reference>:<address>" with a link to the explorer', () => {
    expect(parseRichAddress(`eip155:1:${ETH}`)).toEqual({
      crude: `eip155:1:${ETH}`,
      address: ETH,
      link: `https://etherscan.io/address/${ETH}`,
      reference: expect.objectContaining({
        id: '1',
        namespaceId: 'eip155',
        name: 'Ethereum Mainnet',
      }),
      passedTest: true,
    })
  })

  it('links Gnosis addresses to the Blockscout explorer the chain config names', () => {
    expect(parseRichAddress(`eip155:100:${ETH}`)?.link).toBe(
      `https://gnosis.blockscout.com/address/${ETH}`,
    )
  })

  it.each([
    ['Bitcoin (legacy)', `bip122:${BTC}:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`],
    ['Bitcoin (P2SH)', `bip122:${BTC}:3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy`],
    [
      'Bitcoin (bech32)',
      `bip122:${BTC}:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq`,
    ],
    ['Solana', `solana:${SOLANA}:So11111111111111111111111111111111111111112`],
    [
      'Solana, on its old chain id',
      'solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ:So11111111111111111111111111111111111111112',
    ],
    [
      'TON (user-friendly)',
      'tvm:-239:EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
    ],
    [
      'Stacks (40 characters)',
      'stacks:1:SPQE3J7XMMK0DN0BWJZHGE6B05VDYQRXRMDV734D',
    ],
  ])('accepts a %s address', (_, crude) => {
    expect(parseRichAddress(crude)?.passedTest).toBe(true)
  })

  it('keeps the colon of a raw TON address in the address', () => {
    const parsed = parseRichAddress(`tvm:-239:${TON_RAW}`)
    expect(parsed?.address).toBe(TON_RAW)
    expect(parsed?.link).toBe(`https://tonscan.org/address/${TON_RAW}`)
    expect(parsed?.passedTest).toBe(true)
  })

  it('tells the networks apart when two namespaces use the same reference id', () => {
    expect(
      parseRichAddress('stacks:1:SPQE3J7XMMK0DN0BWJZHGE6B05VDYQRXRMDV734D')
        ?.reference.name,
    ).toBe('Stacks')
    expect(parseRichAddress(`eip155:1:${ETH}`)?.reference.name).toBe(
      'Ethereum Mainnet',
    )
  })

  it('still parses an address that fails its network test, flagged as such', () => {
    const parsed = parseRichAddress('eip155:1:0x1234')
    expect(parsed?.address).toBe('0x1234')
    expect(parsed?.passedTest).toBe(false)
  })

  it.each([
    ['an empty value', ''],
    ['no address part', 'eip155:1'],
    ['a bare address', ETH],
    ['an unknown namespace', `cosmos:1:${ETH}`],
    ['an unknown reference', `eip155:999999:${ETH}`],
  ])('is null for %s', (_, crude) => {
    expect(parseRichAddress(crude)).toBeNull()
  })

  it.each([
    '__proto__:constructor:x',
    'constructor:1:x',
    'toString:1:x',
    'hasOwnProperty:1:x',
    'eip155:toString:x',
    'eip155:__proto__:x',
    'eip155:constructor:x',
  ])('reads Object members as unknown networks, never as one: %s', (crude) => {
    expect(() => parseRichAddress(crude)).not.toThrow()
    expect(parseRichAddress(crude)).toBeNull()
  })

  it('is null for a value that is not text', () => {
    for (const value of [undefined, null, 5, {}, ['eip155', '1', ETH]])
      expect(parseRichAddress(value as unknown as string)).toBeNull()
  })

  it.each([
    '@evil.example',
    '//evil.example/x',
    '..\\..\\evil.example',
    '../../../../evil.example',
    'x?redirect=https://evil.example#y',
  ])('keeps the link on the explorer for the address %j', (address) => {
    const parsed = parseRichAddress(`eip155:1:${address}`)
    expect(new URL(parsed?.link as string).host).toBe('etherscan.io')
    expect(parsed?.passedTest).toBe(false)
  })

  // Regression: the stacks namespace test took exactly 38 characters after
  // "SP"/"ST", but a c32check address is 40 or 41 characters long (41 for
  // about three in four). The addresses below are real (their checksums
  // verify), and the submit form refuses them as "Invalid format".
  it('accepts 41-character Stacks addresses', () => {
    for (const address of [
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
      'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
      'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    ])
      expect(parseRichAddress(`stacks:1:${address}`)?.passedTest).toBe(true)
  })
})

describe('namespace tests', () => {
  it.each([
    ['eip155', `0x${'a'.repeat(39)}`],
    ['eip155', `${ETH} `],
    ['bip122', '0A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
    ['bip122', 'bc1qar0'],
    ['solana', '0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl'],
    ['tvm', `1:${'ab'.repeat(32)}`],
    ['tvm', 'XQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N'],
    ['stacks', 'SX2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZ'],
  ])('%s refuses %j', (namespaceId, address) => {
    expect(test(namespaceId)(address)).toBe(false)
  })

  // Regression: the tvm namespace test wrote the second character's class as
  // [Q|f], which also takes a literal "|": a TON address can only have Q or
  // f there (basechain or masterchain).
  it('tvm refuses a "|" as the second character', () => {
    expect(test('tvm')(`E|${'A'.repeat(46)}`)).toBe(false)
  })
})

describe('references', () => {
  it('each names a namespace that has a test', () => {
    const known = new Set(namespaces.map((namespace) => namespace.id))
    for (const reference of references)
      expect(known.has(reference.namespaceId)).toBe(true)
  })

  it('each explorer is a bare host, so links read <host>/address/<address>', () => {
    for (const { explorer } of references) {
      const url = new URL(`https://${explorer}`)
      expect(url.host).toBe(explorer)
      expect(url.pathname).toBe('/')
    }
  })

  it('no two share a namespace and reference id, which would hide one', () => {
    const keys = references.map(({ namespaceId, id }) => `${namespaceId}:${id}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
