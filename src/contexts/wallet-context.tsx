import React, { createContext } from 'react'
import useNotificationWeb3 from '../hooks/notifications-web3'

const WalletContext = createContext<any>(undefined)
const WalletProvider = ({ children }: { children: React.ReactNode }) => (
  <WalletContext.Provider value={{ ...useNotificationWeb3() }}>
    {children}
  </WalletContext.Provider>
)

export { WalletContext, WalletProvider }
