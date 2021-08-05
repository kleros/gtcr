export const xDaiInfo = {
  name: 'xDAI Chain',
  chainId: 100,
  shortName: 'xdai',
  chain: 'XDAI',
  network: 'mainnet',
  networkId: 100,
  nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  rpc: [
    'https://rpc.xdaichain.com',
    'https://xdai.poanetwork.dev',
    'wss://rpc.xdaichain.com/wss',
    'wss://xdai.poanetwork.dev/wss',
    'http://xdai.poanetwork.dev',
    'https://dai.poa.network',
    'ws://xdai.poanetwork.dev:8546'
  ],
  faucets: [],
  explorers: [
    {
      name: 'blockscout',
      url: 'https://blockscout.com/xdai/',
      standard: 'EIP3091'
    }
  ],
  infoURL: 'https://forum.poa.network/c/xdai-chain'
}

export const supportedNetworkURLs = JSON.parse(process.env.REACT_APP_RPC_URLS)
export const mainnetInfo = {
  name: 'Ethereum Mainnet',
  chainId: 1,
  shortName: 'eth',
  chain: 'ETH',
  network: 'mainnet',
  networkId: 1,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpc: [supportedNetworkURLs[1]],
  faucets: [],
  explorers: [
    {
      name: 'etherscan',
      url: 'https://etherscan.io',
      standard: 'EIP3091'
    }
  ],
  infoURL: 'https://ethereum.org'
}
