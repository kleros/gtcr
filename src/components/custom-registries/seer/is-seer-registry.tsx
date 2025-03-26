import { seerAddresses } from 'config/tcr-addresses'

export const isSeerRegistry = (tcrAddress: string, chainId: string) =>
  seerAddresses[chainId as keyof typeof seerAddresses] ===
  tcrAddress.toLowerCase()
