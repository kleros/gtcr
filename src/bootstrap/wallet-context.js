import React, { createContext, useState, useEffect } from 'react'
import { notification } from 'antd'
import { useWeb3Context } from 'web3-react'
import PropTypes from 'prop-types'
import uuid from 'uuid/v4'
import { NETWORK, NETWORK_NAME } from '../utils/network-names'

const actionTypes = {
  TRANSACTION: 'TRANSACTION',
  AUTHORIZATION: 'AUTHORIZATION'
}

/* eslint-disable valid-jsdoc */
/**
 * This hook wraps web3-react connectors to request
 * authorization from the wallet when necessary and to manage
 * notifications on the screen.
 *
 * To request connection to the wallet, simply call
 * the `requestWeb3Auth()` method returned by the hook.
 * Alternatively, use the `pushWeb3Action(action)` method directly
 * to send a transaction to the blockchain and it will request
 * connection if it is not yet available.
 */
const useNotificationWeb3 = () => {
  const web3Context = useWeb3Context()
  const [web3Actions, setWeb3Actions] = useState([])

  /**
   * Send a transaction to the blockchain. This handles notifications and
   * requests wallet connection if it is not yet available.
   * @param {{action: function}} action A promise that will be executed when and if
   * the dapp is acquires wallet access. The promise is passed the web3-react `context`
   * object in the arguments and should return an object with the following shape:
   * `{ tx, actionMessage, onTxMined }`.
   * `tx`: required - The object returned when a transaction submitted with `ethersjs` using
   * the `FastJsonRpcSigner` as the provider resolves.
   * `actionMessage`: optional - The message that will be displayed as a notification to
   * the user while the transaction is not resolved.
   * `onTxMined`: optional - A callback to be executed once the transaction is mined.
   *
   * See containers/factory/deploy.js for an example usage.
   */
  const pushWeb3Action = action =>
    setWeb3Actions(prevState =>
      prevState.concat({ action, type: actionTypes.TRANSACTION })
    )
  const requestWeb3Auth = action =>
    setWeb3Actions(prevState =>
      prevState.concat({ type: actionTypes.AUTHORIZATION, action })
    )
  const initialState = {
    modalOpen: false,
    method: null,
    notifiedAuthAccquired: false
  }
  const [connectionState, setConnectionState] = useState(
    JSON.parse(JSON.stringify(initialState))
  ) // Make a copy.
  const NOTIFICATION_KEY = 'WALLET_AUTHORIZATION'

  const setUserSelectedWallet = method =>
    setConnectionState(prev => ({ ...prev, method }))

  const cancelRequest = () => {
    setWeb3Actions([])
    setConnectionState(prevState => ({ ...prevState, modalOpen: false }))
  }

  useEffect(() => {
    if (!web3Context.active) web3Context.setFirstValidConnector(['Infura'])
  }, [web3Context])

  // We watch the web3 context props to handle the flow of authorization.
  useEffect(() => {
    const asyncEffect = async () => {
      if (web3Actions.length === 0) return
      if (
        !web3Context.account &&
        !connectionState.modalOpen &&
        !connectionState.method
      )
        setConnectionState(prev => ({ ...prev, modalOpen: true }))
      else if (connectionState.modalOpen && connectionState.method) {
        setConnectionState(prev => ({ ...prev, modalOpen: false }))
        web3Context.setFirstValidConnector([connectionState.method])
      } else if (
        !web3Context.account &&
        !web3Context.error &&
        !connectionState.modalOpen &&
        !connectionState.requestSentToProvider
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
      } else if (web3Context.account) {
        if (!connectionState.notifiedAuthAccquired) {
          notification.success({
            message: 'Authorization accquired',
            duration: 3,
            key: NOTIFICATION_KEY
          })
          setConnectionState(prev => ({ ...prev, notifiedAuthAccquired: true }))
        }

        while (web3Actions.length > 0) {
          // Process each web3 action.
          const web3Action = web3Actions.pop()
          if (web3Action.type === actionTypes.TRANSACTION) {
            await processWeb3Action(web3Action, web3Context)
            return
          }
          if (
            web3Action.type === actionTypes.AUTHORIZATION &&
            web3Action.action
          )
            web3Action.action()
        }
      }
    }
    asyncEffect()
  }, [web3Context, connectionState, initialState, web3Actions])

  return {
    requestModalOpen: connectionState.modalOpen,
    cancelRequest,
    pushWeb3Action,
    requestWeb3Auth,
    setUserSelectedWallet
  }
}

/**
 * @param {{type: string, action: function}} web3Action - The action dispatched to the wallet.
 * @param {object} web3Context - The web3-react context.
 */
async function processWeb3Action(web3Action, web3Context) {
  const notificationID = uuid()
  notification.info({
    message: 'Requesting Signature',
    duration: 0,
    key: notificationID
  })
  try {
    const { tx, actionMessage, onTxMined } = await web3Action.action(
      web3Context
    )
    const hash = tx.hash || tx.deployTransaction.hash
    const etherscanLink = `https://${
      web3Context.networkId !== NETWORK.MAINNET
        ? `${NETWORK_NAME[web3Context.networkId]}}.`
        : ''
    }etherscan.io/tx/${hash}`
    notification.info({
      message: actionMessage || 'Transaction submitted.',
      duration: 0,
      key: notificationID,
      description: (
        <a target="_blank" rel="noopener noreferrer" href={etherscanLink}>
          View on etherscan
        </a>
      )
    })

    const { contractAddress } = await web3Context.library.waitForTransaction(
      hash
    )

    notification.success({
      message: 'Transaction mined!',
      description: (
        <a target="_blank" rel="noopener noreferrer" href={etherscanLink}>
          View on etherscan
        </a>
      ),
      duration: 0,
      key: notificationID
    })
    if (onTxMined) onTxMined({ contractAddress })
  } catch (err) {
    notification.error({
      message: 'Error submitting transaction',
      description: `${err.message}`,
      duration: 0,
      key: notificationID
    })
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
