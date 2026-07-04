import React, { createContext, useMemo } from 'react'
import useNotificationWeb3 from '../hooks/notifications-web3'

type WalletContextValue = ReturnType<typeof useNotificationWeb3>

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
