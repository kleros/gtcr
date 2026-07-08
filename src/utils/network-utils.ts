import { NETWORKS_INFO } from 'config/networks'

const getExplorerUrl = (networkId: number): string =>
  NETWORKS_INFO[networkId as keyof typeof NETWORKS_INFO].explorers[0].url

export const getAddressPage = ({
  networkId,
  address,
}: {
  networkId: number
  address: string
}): string => `${getExplorerUrl(networkId)}/address/${address}`

export const getTxPage = ({
  networkId,
  txHash,
}: {
  networkId: number
  txHash: string
}): string => `${getExplorerUrl(networkId)}/tx/${txHash}`
