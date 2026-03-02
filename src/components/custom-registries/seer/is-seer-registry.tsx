import { seerAddresses } from 'config/tcr-addresses'

export const isSeerRegistry = (tcrAddress: string, chainId: string | number) =>
  seerAddresses[chainId] === tcrAddress.toLowerCase()
