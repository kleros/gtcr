import { seerAddresses } from 'config/tcr-addresses'

export const isSeerRegistry = (tcrAddress: string, chainId: string | number) =>
  seerAddresses[String(chainId) as keyof typeof seerAddresses] ===
  tcrAddress.toLowerCase()
