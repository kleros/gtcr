/**
 * Before adding a new explorer, make sure it respects the format:
 * `/block/${block}`
 * `/address/${address}`
 * `/tx/`${txHash}`
 */

export type Reference = {
  id: string
  namespaceId: string
  name: string
  label: string
  explorer: string // must respect BIP-0122
}

export type Namespace = {
  id: string
  addressRegex: RegExp
}

// Hacky definition of rich-addresses. Refactor into two jsons in the future?
// Hasn't been done because regex doesn't go well with json.

export const namespaces: Namespace[] = [
  {
    id: 'eip155',
    addressRegex: /^0x[a-fA-F0-9]{40}$/
  },
  {
    id: 'bip122',
    addressRegex: /(^[13]{1}[a-km-zA-HJ-NP-Z1-9]{26,33}$)|(^bc1[a-z0-9]{39,59}$)/
  }
]

export const references: Reference[] = [
  {
    id: '1',
    namespaceId: 'eip155',
    name: 'Ethereum Mainnet',
    label: 'ETH',
    explorer: 'etherscan.io'
  },
  {
    id: '100',
    namespaceId: 'eip155',
    name: 'Gnosis Chain',
    label: 'xDAI',
    explorer: 'blockscout.com/xdai/mainnet'
  },
  {
    id: '000000000019d6689c085ae165831e93',
    namespaceId: 'bip122',
    name: 'Bitcoin',
    label: 'BTC',
    explorer: 'mempool.space'
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
  return { reference, crude, address, link }
}

export default {
  namespacesMap,
  referencesMap
}
