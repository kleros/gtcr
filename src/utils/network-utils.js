import { NETWORKS_INFO } from 'config/networks'

export const getAddressPage = ({ networkId, address }) => {
  const page = NETWORKS_INFO[networkId].explorers[0].url
  const pageWithAddress = `${page}/address/${address}`
  return pageWithAddress
}

export const getTxPage = ({ networkId, txHash }) => {
  const page = NETWORKS_INFO[networkId].explorers[0].url
  const pageWithTx = `${page}/tx/${txHash}`
  return pageWithTx
}
