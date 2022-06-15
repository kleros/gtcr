export const NETWORK = {
  MAINNET: 1,
  ROPSTEN: 3,
  RINKEBY: 4,
  GOERLI: 5,
  KOVAN: 42,
  XDAI: 100
}

export const NETWORK_NAME = {
  [NETWORK.MAINNET]: 'mainnet',
  [NETWORK.ROPSTEN]: 'ropsten',
  [NETWORK.RINKEBY]: 'rinkeby',
  [NETWORK.GOERLI]: 'göerli',
  [NETWORK.KOVAN]: 'kovan',
  [NETWORK.XDAI]: 'xDai'
}

export const NETWORK_COLOR = {
  [NETWORK.MAINNET]: '#29b6af',
  [NETWORK.ROPSTEN]: '#ff4a8d',
  [NETWORK.RINKEBY]: '#f6c343',
  [NETWORK.GOERLI]: '#3099f2',
  [NETWORK.KOVAN]: '#690496',
  [NETWORK.XDAI]: '#48A9A6'
}

const getFreePage = ({ networkId }) => {
  const corePage =
    networkId === 100 ? 'blockscout.com/xdai/mainnet' : 'etherscan.io'
  const hasSubdomain = ![1, 100].includes(networkId)
  const uri = `${hasSubdomain ? `${NETWORK_NAME[networkId]}.` : ''}${corePage}`
  const fullPage = `https://${uri}`
  return fullPage
}

export const getAddressPage = ({ networkId, address }) => {
  const page = getFreePage({ networkId })
  const pageWithAddress = `${page}/address/${address}`
  return pageWithAddress
}

export const getTxPage = ({ networkId, txHash }) => {
  const page = getFreePage({ networkId })
  const pageWithTx = `${page}/tx/${txHash}`
  return pageWithTx
}
