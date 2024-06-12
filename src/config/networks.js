export const NETWORKS = Object.freeze({
  ethereum: 1,
  gnosis: 100,
  sepolia: 11155111
})

export const DEFAULT_NETWORK = NETWORKS.ethereum

export const NETWORK_STATUS = Object.freeze({
  unknown: 'unknown',
  unsupported: 'unsupported',
  swtiching: 'switching',
  adding: 'adding',
  supported: 'supported'
})

const RPC_URLS = JSON.parse(process.env.REACT_APP_RPC_URLS)

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
  [NETWORKS.gnosis]: {
    name: 'Gnosis Chain',
    color: '#48A9A6',
    supported: true,
    chainId: 100,
    shortName: 'xdai',
    chain: 'XDAI',
    network: 'xdai',
    networkId: 100,
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    rpc: [
      'https://rpc.gnosischain.com/',
      'https://xdai.poanetwork.dev',
      'wss://rpc.gnosischain.com/wss',
      'wss://xdai.poanetwork.dev/wss',
      'http://xdai.poanetwork.dev',
      'https://dai.poa.network',
      'ws://xdai.poanetwork.dev:8546'
    ],
    faucets: [],
    explorers: [
      {
        name: 'gnosisscan',
        url: 'https://gnosisscan.io',
        standard: 'EIP3091'
      }
    ],
    infoURL: 'https://forum.poa.network/c/xdai-chain'
  },
  [NETWORKS.sepolia]: {
    name: 'Ethereum Sepolia',
    color: '#29b6af',
    supported: true,
    chainId: 5,
    shortName: 'sepoliaeth',
    chain: 'SepoliaETH',
    network: 'sepolia',
    networkId: 5,
    nativeCurrency: {
      name: 'SepoliaEther',
      symbol: 'SepoliaEther',
      decimals: 18
    },
    rpc: [RPC_URLS[NETWORKS.sepolia]],
    faucets: [],
    explorers: [
      {
        name: 'etherscan',
        url: 'https://sepolia.etherscan.io',
        standard: 'EIP3091'
      }
    ],
    infoURL: 'https://ethereum.org'
  }
})

export default NETWORKS_INFO
