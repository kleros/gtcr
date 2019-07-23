import React, { createContext, useState, useEffect } from 'react'
import { notification } from 'antd'
import { useWeb3Context } from 'web3-react'
import useFunctionAsState from '../utils/fn-as-state-hook'
import PropTypes from 'prop-types'
import uuid from 'uuid/v4'

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
    const asyncEffect = async () => {
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
          message: 'Authorization failed',
          description:
            'Please ensure your wallet is set to either Mainnet or Kovan and authorize the request.',
          duration: 15,
          key: NOTIFICATION_KEY
        })
        setPendingCallback(null)
        setConnectionState(JSON.parse(JSON.stringify(initialState)))
        web3Context.error = null
      } else if (web3Context.active) {
        if (connectionState.requestSentToProvider)
          notification.success({
            message: 'Authorization accquired',
            duration: 5,
            key: NOTIFICATION_KEY
          })

        const notificationID = uuid()
        try {
          if (!pendingCallback.action) return
          notification.info({
            message: 'Requesting Signature',
            duration: 0,
            key: notificationID
          })
          const request = await pendingCallback.action(web3Context)
          if (!request) return
          const { tx, actionDescription, onTxMined } = request
          notification.info({
            message: actionDescription,
            duration: 0,
            key: notificationID,
            description: (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://${web3Context.networkId === 42 &&
                  'kovan.'}etherscan.io/tx/${tx.deployTransaction.hash}`}
              >
                View on etherscan
              </a>
            )
          })

          const {
            transactionHash,
            contractAddress
          } = await web3Context.library.waitForTransaction(
            tx.deployTransaction.hash
          )
          notification.success({
            message: 'Transaction mined!',
            description: (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://${web3Context.networkId === 42 &&
                  'kovan.'}etherscan.io/tx/${transactionHash}`}
              >
                View on etherscan
              </a>
            ),
            duration: 0,
            key: notificationID
          })
          onTxMined({ contractAddress })
        } catch (err) {
          notification.error({
            message: `Error submitting transaction`,
            description: `${err.message}`,
            duration: 0,
            key: notificationID
          })
        } finally {
          setPendingCallback(null)
          setConnectionState(JSON.parse(JSON.stringify(initialState)))
        }
      }
    }
    asyncEffect()
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
