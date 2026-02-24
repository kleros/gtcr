import React, { createContext, useMemo } from 'react'
import { BigNumber } from 'ethers'
import useNotificationWeb3 from '../hooks/notifications-web3'

interface WalletContextValue {
  requestModalOpen: boolean
  cancelRequest: () => void
  pushWeb3Action: (action: unknown) => void
  requestWeb3Auth: (action?: unknown) => void
  setUserSelectedWallet: () => void
  timestamp: BigNumber | undefined
  networkId: number
  latestBlock: number | undefined
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)
const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const ctx = useNotificationWeb3()
  const value = useMemo(
    () => ctx,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx.requestModalOpen,
      ctx.cancelRequest,
      ctx.pushWeb3Action,
      ctx.requestWeb3Auth,
      ctx.setUserSelectedWallet,
      ctx.timestamp,
      ctx.networkId,
      ctx.latestBlock,
    ],
  )
  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  )
}

export { WalletContext, WalletProvider }
