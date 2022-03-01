/**
 * Before adding a new explorer, make sure it respects the format:
 * `/block/${block}`
 * `/address/${address}`
 * and
 * `/tx/`${txHash}`
 */

// This could be improved by fetching a json instead and maintaining it elsewhere

export const nameToInfoMap = {
  eth: {
    explorer: 'etherscan.io',
    name: 'Ethereum Mainnet',
    shortName: 'eth',
    label: 'ETH',
    test: /^0x[a-fA-F0-9]{40}$/.test
  },
  gno: {
    explorer: 'blockscout.com/xdai/mainnet',
    name: 'Gnosis Chain',
    shortName: 'gno',
    label: 'xDAI',
    test: /^0x[a-fA-F0-9]{40}$/.test
  },
  btc: {
    explorer: 'mempool.space',
    name: 'Bitcoin',
    shortName: 'btc',
    label: 'BTC',
    test: string =>
      /^[13]{1}[a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(string) || // legacy
      /^bc1[a-z0-9]{39,59}$/.test(string) // segwit
  },
  sol: {
    explorer: 'explorer.solana.com',
    name: 'Solana',
    shortName: 'sol',
    label: 'SOL',
    test: () => true // TODO
  }
}

export const parseRichAddress = richAddress => {
  // if no ":", assume it's eth
  const prependedDefault = richAddress.split(':').length === 1 ? 'eth:' : ''
  richAddress = prependedDefault + richAddress
  // parse address type. "gno:0xc0fec0fe...deaddead"
  const [addressType, address] = richAddress.split(':')
  const info = nameToInfoMap[addressType]
  const link = info ? `https://${info.explorer}/address/${address}` : null
  return { addressType, address, info, link }
}
