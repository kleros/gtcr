export const NETWORKS = Object.freeze({
  ethereum: 1,
  xDai: 100,
  rinkeby: 4,
  kovan: 42
})

export const DEFAULT_NETWORK = NETWORKS.ethereum

export const NETWORK_STATUS = Object.freeze({
  unknown: 'unknown',
  unsupported: 'unsupported',
  swtiching: 'switching',
  adding: 'adding',
  supported: 'supported'
})

const { REACT_APP_RPC_URLS } = process.env
const RPC_URLS = REACT_APP_RPC_URLS && JSON.parse(REACT_APP_RPC_URLS)

export const NETWORKS_INFO = Object.freeze({
  [NETWORKS.ethereum]: {
    name: 'Ethereum Mainnet',
    color: '#29b6af',
    supported: true,
    chainId: 1,
    shortName: 'eth',
    chain: 'ETH',
    network: 'mainnet',
    networkId: 1,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpc: [RPC_URLS[NETWORKS.ethereum]],
    faucets: [],
    explorers: [
      {
        name: 'etherscan',
        url: 'https://etherscan.io',
        standard: 'EIP3091'
      }
    ],
    infoURL: 'https://ethereum.org'
  },
  [NETWORKS.xDai]: {
    name: 'xDAI Chain',
    color: '#48A9A6',
    supported: true,
    chainId: 100,
    shortName: 'xdai',
    chain: 'XDAI',
    network: 'mainnet',
    networkId: 100,
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    rpc: [
      'https://rpc.gnosischain.com',
      'https://xdai.poanetwork.dev',
      'wss://rpc.gnosischain.com/wss',
      'wss://xdai.poanetwork.dev/wss',
      'https://xdai.poanetwork.dev',
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
  },
  // [NETWORKS.ropsten]: {
  //   name: 'Ropsten',
  //   color: '#ff4a8d',
  // },
  [NETWORKS.rinkeby]: {
    name: 'Rinkeby',
    color: '#f6c343'
  },
  // [NETWORKS.goerli]: {
  //   name: 'Göerli',
  //   color: '#3099f2',
  // },
  [NETWORKS.kovan]: {
    name: 'Kovan',
    color: '#690496'
  }
})

export default NETWORKS_INFO
