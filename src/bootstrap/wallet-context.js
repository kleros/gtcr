import React, { createContext, useState, useEffect } from 'react'
import { notification } from 'antd'
import { useWeb3Context } from 'web3-react'
import PropTypes from 'prop-types'
import uuid from 'uuid/v4'

const actionTypes = {
  TRANSACTION: 'TRANSACTION',
  AUTHORIZATION: 'AUTHORIZATION'
}

const useNotificationWeb3 = () => {
  const web3Context = useWeb3Context()
  const [web3Actions, setWeb3Actions] = useState([])
  const pushWeb3Action = payload =>
    setWeb3Actions(prevState =>
      prevState.concat({ payload, type: actionTypes.TRANSACTION })
    )
  const requestWeb3Auth = () =>
    setWeb3Actions(prevState =>
      prevState.concat({ type: actionTypes.AUTHORIZATION })
    )
  const setUserSelectedWallet = method =>
    setConnectionState(prev => ({ ...prev, method }))

  const initialState = {
    modalOpen: false,
    method: null,
    notifiedAuthAccquired: false
  }
  const [connectionState, setConnectionState] = useState(
    JSON.parse(JSON.stringify(initialState))
  ) // Make a copy.
  const NOTIFICATION_KEY = 'WALLET_AUTHORIZATION'

  useEffect(() => {
    const asyncEffect = async () => {
      if (web3Actions.length === 0) return
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
        setWeb3Actions([])
        setConnectionState(JSON.parse(JSON.stringify(initialState)))
        web3Context.error = null
      } else if (web3Context.active) {
        if (!connectionState.notifiedAuthAccquired) {
          notification.success({
            message: 'Authorization accquired',
            duration: 5,
            key: NOTIFICATION_KEY
          })
          setConnectionState(prev => ({ ...prev, notifiedAuthAccquired: true }))
        }

        while (web3Actions.length > 0) {
          const web3Action = web3Actions.pop()
          if (web3Action.type === actionTypes.AUTHORIZATION) return
          const notificationID = uuid()
          notification.info({
            message: 'Requesting Signature',
            duration: 0,
            key: notificationID
          })
          try {
            const {
              tx,
              actionMessage,
              onTxMined
            } = await web3Action.payload.action(web3Context)
            notification.info({
              message: actionMessage || 'Transaction submitted.',
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
              message: 'Error submitting transaction',
              description: `${err.message}`,
              duration: 0,
              key: notificationID
            })
          }
        }
      }
    }
    asyncEffect()
  }, [web3Context, connectionState, initialState, web3Actions])

  return {
    requestModalOpen: connectionState.modalOpen,
    pushWeb3Action,
    requestWeb3Auth,
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
