import React, { createContext, useEffect, useMemo } from 'react'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import useNotificationWeb3 from '../hooks/notifications-web3'

type WalletContextValue = ReturnType<typeof useNotificationWeb3>

/**
 * wagmi keys the wallet client by useChainId(), which stays on the last
 * chain the app supports while the wallet sits on one it does not. Coming
 * back from there to that same chain keeps the lookup that failed there, and
 * every write would quietly do nothing: on list and entry pages, in the
 * wizards and in the governance console alike. Once the wallet is on the
 * chain the client is keyed by, a failed lookup is made again. Read without
 * fetching: the pages' own hooks fetch it.
 */
const useWalletClientRecovery = () => {
  const { isConnected, chainId: walletChainId } = useAccount()
  const chainId = useChainId()
  const { isError: walletClientFailed, refetch: refetchWalletClient } =
    useWalletClient({ query: { enabled: false } })
  const onKeyedChain = walletChainId === chainId

  useEffect(() => {
    if (isConnected && onKeyedChain && walletClientFailed)
      void refetchWalletClient({ cancelRefetch: false })
  }, [isConnected, onKeyedChain, walletClientFailed, refetchWalletClient])
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)
const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  useWalletClientRecovery()
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
