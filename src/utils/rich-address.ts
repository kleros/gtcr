/**
 * Before adding a new explorer, make sure it respects the format:
 * `/block/${block}`
 * `/address/${address}`
 * `/tx/`${txHash}`
 */

export type Reference = {
  id: string
  deprecated?: boolean
  namespaceId: string
  name: string
  label: string
  explorer: string // must respect BIP-0122
}

export type Namespace = {
  id: string
  test: (s: string) => boolean
}

// Hacky definition of rich-addresses. Refactor into two jsons in the future?
// Hasn't been done because regex doesn't go well with json.

export const namespaces: Namespace[] = [
  {
    id: 'eip155',
    test: s => /^0x[a-fA-F0-9]{40}$/.test(s)
  },
  {
    id: 'bip122',
    test: s =>
      /(^[13]{1}[a-km-zA-HJ-NP-Z1-9]{26,33}$)|(^bc1[a-z0-9]{39,59}$)/.test(s)
  },
  {
    id: 'solana',
    test: (s: string) => /(^[1-9A-HJ-NP-Za-km-z]{32,44}$)/.test(s)
  },
  {
    id: 'tvm',
    test: (s: string) =>
      /^(0|-1):[a-fA-F0-9]{64}$/.test(s) ||
      /^[EU][Q|f][A-Za-z0-9_-]{46}$/.test(s)
  },
  {
    id: 'stacks',
    test: (s: string) => /^(SP|ST)[\da-km-zA-HJ-NP-Z]{38}$/.test(s)
  }
]

// https://github.com/ethereum-lists/chains
export const references: Reference[] = [
  {
    id: '1',
    namespaceId: 'eip155',
    name: 'Ethereum Mainnet',
    label: 'ETH',
    explorer: 'etherscan.io'
  },
  {
    id: '56',
    namespaceId: 'eip155',
    name: 'Binance Smart Chain',
    label: 'BNB',
    explorer: 'bscscan.com'
  },
  {
    id: '100',
    namespaceId: 'eip155',
    name: 'Gnosis Chain',
    label: 'GNO',
    explorer: 'gnosisscan.io'
  },
  {
    id: '137',
    namespaceId: 'eip155',
    name: 'Polygon',
    label: 'MATIC',
    explorer: 'polygonscan.com'
  },
  {
    id: '000000000019d6689c085ae165831e93',
    namespaceId: 'bip122',
    name: 'Bitcoin',
    label: 'BTC',
    explorer: 'mempool.space'
  },
  {
    deprecated: true,
    id: '4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ',
    namespaceId: 'solana',
    name: 'Solana',
    label: 'SOL',
    explorer: 'solscan.io'
  },
  {
    id: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    namespaceId: 'solana',
    name: 'Solana',
    label: 'SOL',
    explorer: 'solscan.io'
  },
  {
    id: '8453',
    namespaceId: 'eip155',
    name: 'Base Mainnet',
    label: 'Base',
    explorer: 'basescan.org'
  },
  {
    id: '42161',
    namespaceId: 'eip155',
    name: 'Arbitrum One',
    label: 'ARB',
    explorer: 'arbiscan.io'
  },
  {
    id: '1284',
    namespaceId: 'eip155',
    name: 'Moonbeam',
    label: 'GLMR',
    explorer: 'moonscan.io'
  },
  {
    id: '59144',
    namespaceId: 'eip155',
    name: 'Linea',
    label: 'Linea',
    explorer: 'lineascan.build'
  },
  {
    id: '10',
    namespaceId: 'eip155',
    name: 'Optimism',
    label: 'OP',
    explorer: 'optimistic.etherscan.io'
  },
  {
    id: '250',
    namespaceId: 'eip155',
    name: 'Fantom Opera',
    label: 'FTM',
    explorer: 'explorer.fantom.network'
  },
  {
    id: '1285',
    namespaceId: 'eip155',
    name: 'Moonriver',
    label: 'MOVR',
    explorer: 'moonriver.moonscan.io'
  },
  {
    id: '43114',
    namespaceId: 'eip155',
    name: 'Avalanche C-Chain',
    label: 'AVAX',
    explorer: 'snowtrace.io'
  },
  {
    id: '25',
    namespaceId: 'eip155',
    name: 'Cronos Mainnet',
    label: 'CRO',
    explorer: 'cronoscan.com'
  },
  {
    id: '199',
    namespaceId: 'eip155',
    name: 'BitTorrent Chain Mainnet',
    label: 'BTT',
    explorer: 'bttcscan.com'
  },
  {
    id: '1101',
    namespaceId: 'eip155',
    name: 'Polygon zkEVM',
    label: 'zkEVM',
    explorer: 'zkevm.polygonscan.com'
  },
  {
    id: '1111',
    namespaceId: 'eip155',
    name: 'WEMIX3.0 Mainnet',
    label: 'WEMIX',
    explorer: 'wemixscan.com'
  },
  {
    id: '534352',
    namespaceId: 'eip155',
    name: 'Scroll',
    label: 'Scroll',
    explorer: 'scrollscan.dev'
  },
  {
    id: '42220',
    namespaceId: 'eip155',
    name: 'Celo',
    label: 'CELO',
    explorer: 'celoscan.io'
  },
  {
    id: '324',
    namespaceId: 'eip155',
    name: 'zkSync Mainnet',
    label: 'zkSync',
    explorer: 'explorer.zksync.io'
  },
  {
    id: '146',
    namespaceId: 'eip155',
    name: 'Sonic',
    label: 'SONIC',
    explorer: 'sonicscan.org'
  },
  {
    id: '81457',
    namespaceId: 'eip155',
    name: 'Blast',
    label: 'BLAST',
    explorer: 'blastscan.io'
  },
  {
    id: '9745',
    namespaceId: 'eip155',
    name: 'Plasma',
    label: 'XPL',
    explorer: 'explorer.plasma.to'
  },
  {
    id: '999',
    namespaceId: 'eip155',
    name: 'Hyperliquid',
    label: 'HYPE',
    explorer: 'hyperevmscan.io'
  },
  {
    id: '747474',
    namespaceId: 'eip155',
    name: 'Katana',
    label: 'ETH',
    explorer: 'katanascan.com'
  },
  {
    id: '130',
    namespaceId: 'eip155',
    name: 'Unichain',
    label: 'ETH',
    explorer: 'unichain.blockscout.com'
  },
  {
    id: '80094',
    namespaceId: 'eip155',
    name: 'Berachain',
    label: 'BERA',
    explorer: 'berascan.com'
  },
  {
    id: '480',
    namespaceId: 'eip155',
    name: 'World Chain',
    label: 'ETH',
    explorer: 'worldscan.org'
  },
  {
    id: '-239',
    namespaceId: 'tvm',
    name: 'TON',
    label: 'TON',
    explorer: 'tonscan.org'
  },
  {
    id: '1',
    namespaceId: 'stacks',
    name: 'Stacks',
    label: 'STX',
    explorer: 'explorer.hiro.so'
  }
]

// Generate a map for fast and clean access

const namespacesMap: { [namespaceId: string]: Namespace } = {}

const referencesMap: {
  [namespaceId: string]: { [referenceId: string]: Reference }
} = {}

references.forEach(reference => {
  const namespaceId = reference.namespaceId
  if (namespacesMap[namespaceId] === undefined) {
    namespacesMap[namespaceId] = namespaces.find(
      namespace => namespace.id === reference.namespaceId
    ) as Namespace
    referencesMap[namespaceId] = {}
  }
  referencesMap[namespaceId][reference.id] = reference
})

export type RichAddress = {
  crude: string
  address: string
  link: string
  reference: Reference
  passedTest: boolean
}

export const parseRichAddress = (crude: string): RichAddress | null => {
  if (!crude) return null
  // if no 2 colons, it's badly formatted
  if (crude.split(':').length !== 3) return null

  const [namespaceId, referenceId, address] = crude.split(':')
  // namespace not found
  if (!namespacesMap[namespaceId]) return null

  const reference = referencesMap[namespaceId][referenceId]
  // reference not found
  if (!reference) return null
  // correct rich address
  const link = `https://${reference.explorer}/address/${address}`
  const passedTest = namespacesMap[namespaceId].test(address)
  return { reference, crude, address, link, passedTest }
}

export default {
  namespacesMap,
  referencesMap
}
