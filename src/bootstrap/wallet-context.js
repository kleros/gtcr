import React, { createContext, useState, useEffect } from 'react'
import { notification } from 'antd'
import { useWeb3Context } from 'web3-react'
import useFunctionAsState from '../utils/fn-as-state-hook'
import PropTypes from 'prop-types'

const useNotificationWeb3 = () => {
  const web3Context = useWeb3Context()
  const [pendingCallback, setPendingCallback] = useFunctionAsState(null)
  const initialState = {
    modalOpen: false,
    method: null,
    requestSentToProvider: false
  }
  const [connectionState, setConnectionState] = useState(
    JSON.parse(JSON.stringify(initialState))
  ) // Make a copy.
  const NOTIFICATION_KEY = 'WALLET_AUTHORIZATION'
  const cancelRequest = () => {
    setPendingCallback(null)
    setConnectionState(JSON.parse(JSON.stringify(initialState)))
  }
  const setUserSelectedWallet = method =>
    setConnectionState(prev => ({ ...prev, method }))

  useEffect(() => {
    if (!pendingCallback) return
    if (
      !web3Context.active &&
      !connectionState.modalOpen &&
      !connectionState.method
    )
      setConnectionState(prev => ({ ...prev, modalOpen: true }))
    else if (connectionState.modalOpen && connectionState.method) {
      setConnectionState(prev => ({ ...prev, modalOpen: false }))
      web3Context.setFirstValidConnector([connectionState.method])
    } else if (
      !web3Context.active &&
      !web3Context.error &&
      !connectionState.modalOpen
    ) {
      notification.info({
        message: 'Awaiting authorization',
        duration: 0,
        key: NOTIFICATION_KEY
      })
      setConnectionState(prev => ({ ...prev, requestSentToProvider: true }))
    } else if (web3Context.error && connectionState.method) {
      notification.error({
        message: 'Authorization denied',
        duration: 5,
        key: NOTIFICATION_KEY
      })
      setPendingCallback(null)
      setConnectionState(JSON.parse(JSON.stringify(initialState)))
      web3Context.error = null
    } else if (web3Context.active && connectionState.requestSentToProvider) {
      notification.success({
        message: 'Authorization accquired',
        duration: 5,
        key: NOTIFICATION_KEY
      })
      pendingCallback()
      setPendingCallback(null)
      setConnectionState(JSON.parse(JSON.stringify(initialState)))
    } else if (web3Context.active) {
      pendingCallback()
      setPendingCallback(null)
      setConnectionState(JSON.parse(JSON.stringify(initialState)))
    }
  }, [
    pendingCallback,
    web3Context,
    setPendingCallback,
    connectionState,
    initialState
  ])

  return {
    requestModalOpen: connectionState.modalOpen,
    cancelRequest,
    setPendingCallback,
    setUserSelectedWallet
  }
}

const WalletContext = createContext()
const WalletProvider = ({ children }) => (
  <WalletContext.Provider value={{ ...useNotificationWeb3() }}>
    {children}
  </WalletContext.Provider>
)

WalletProvider.propTypes = {
  children: PropTypes.node.isRequired
}

export { WalletContext, WalletProvider }
