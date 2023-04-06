import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Archon from '@kleros/archon'
import { notification, Icon } from 'antd'
import { useWeb3Context } from 'web3-react'
import uuid from 'uuid/v4'
import { bigNumberify } from 'ethers/utils'
import WalletConnectQRCodeModal from '@walletconnect/qrcode-modal'
import localforage from 'localforage'
import { ethers } from 'ethers'
import _GTCRFactory from '../assets/abis/LightGTCRFactory.json'
import { getTxPage } from '../utils/network-utils'
import FastJsonRpcSigner from '../utils/fast-signer'
import { useHistory } from 'react-router-dom/cjs/react-router-dom.min'
import { defaultTcrAddresses } from 'config/tcr-addresses'
import { NETWORKS } from 'config/networks'

const actionTypes = {
  TRANSACTION: 'TRANSACTION',
  AUTHORIZATION: 'AUTHORIZATION'
}

const NOTIFICATION_KEY = 'WALLET_AUTHORIZATION'
const LAST_CONNECTION_TIME = 'LAST_CONNECTION_TIME'

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
  const history = useHistory()
  const [web3Actions, setWeb3Actions] = useState([])
  const [infuraSetup, setInfuraSetup] = useState() // Whether infura was set as the provider.
  const [timestamp, setTimestamp] = useState()
  const [network, setNetwork] = useState()
  const [latestBlock, setLatestBlock] = useState()
  const TCR2_ADDRESS =
    defaultTcrAddresses[web3Context?.networkId || NETWORKS.ethereum]
  const initialState = {
    modalOpen: false,
    method: null,
    notifiedAuthAccquired: false
  }
  const [connectionState, setConnectionState] = useState(
    JSON.parse(JSON.stringify(initialState))
  ) // Make a copy.
  const factoryInterface = useMemo(
    () => new ethers.utils.Interface(_GTCRFactory),
    []
  )
  const archon = useMemo(() => {
    if (!web3Context.library || !web3Context.active) return
    return new Archon(
      web3Context.library.provider,
      process.env.REACT_APP_IPFS_GATEWAY
    )
  }, [web3Context.library, web3Context.active])

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
  const pushWeb3Action = useCallback(action => {
    setWeb3Actions(prevState =>
      prevState.concat({ action, type: actionTypes.TRANSACTION })
    )
  }, [])
  const requestWeb3Auth = useCallback(
    action =>
      setWeb3Actions(prevState =>
        prevState.concat({ type: actionTypes.AUTHORIZATION, action })
      ),
    []
  )

  const setUserSelectedWallet = useCallback(method => {
    setConnectionState(prev => ({ ...prev, method }))
  }, [])

  const cancelRequest = useCallback(() => {
    setWeb3Actions([])
    setConnectionState(prevState => ({ ...prevState, modalOpen: false }))
  }, [])

  // Auto-connect wallet if available.
  useEffect(() => {
    ;(async () => {
      if (!window.ethereum || web3Context.account) return

      web3Context.setConnector('Injected')
    })()
  }, [web3Context, web3Context.account])

  // Connect a provider.
  useEffect(() => {
    if (window.ethereum) return
    if (web3Context.active || infuraSetup) return

    if (process.env.REACT_APP_RPC_URLS)
      web3Context.setFirstValidConnector(['Infura'])
    else
      console.warn(
        'No JSON-RPC URL provided for this network. Dapp will only work with a connected wallet.'
      )

    setInfuraSetup(true)
  }, [infuraSetup, web3Context])

  // Notify of network changes.
  useEffect(() => {
    if (!web3Context.networkId) return
    if (!network) {
      setNetwork(web3Context.networkId)
      return
    }

    if (network && network !== web3Context.networkId) {
      setNetwork(web3Context.networkId)
      notification.info({
        message: 'Network Changed'
      })
    }
  }, [web3Context.networkId, network, TCR2_ADDRESS, history])

  // Fetch timestamp.
  useEffect(() => {
    if (!web3Context.active || !web3Context.library || timestamp) return
    ;(async () => {
      try {
        const block = await web3Context.library.getBlock()
        setTimestamp(bigNumberify(block.timestamp))
        setLatestBlock(block.number)
      } catch (err) {
        console.error('Error fetching timestamp', err)
      }
    })()
  }, [timestamp, web3Context.library, web3Context.active])

  // We watch the web3 context props to handle the flow of authorization.
  useEffect(() => {
    ;(async () => {
      if (web3Actions.length === 0) return
      if (
        !web3Context.account &&
        !connectionState.modalOpen &&
        !connectionState.method
      )
        setConnectionState(prev => ({ ...prev, modalOpen: true }))
      else if (connectionState.modalOpen && connectionState.method) {
        setConnectionState(prev => ({ ...prev, modalOpen: false }))
        web3Context.setConnector(connectionState.method)
      } else if (
        !web3Context.account &&
        !connectionState.modalOpen &&
        !connectionState.requestSentToProvider &&
        (!web3Context.error ||
          (connectionState.method && connectionState.method === 'Fortmatic'))
      ) {
        notification.info({
          message: 'Awaiting authorization',
          duration: 0,
          key: NOTIFICATION_KEY,
          icon: <Icon type="loading" style={{ color: '#108ee9' }} />,
          onClose: () => {
            setWeb3Actions([])
            setConnectionState(JSON.parse(JSON.stringify(initialState)))
          }
        })
        setConnectionState(prev => ({ ...prev, requestSentToProvider: true }))
      } else if (
        web3Context.error &&
        connectionState.method &&
        connectionState.method === 'Injected'
      ) {
        console.error(web3Context.error)
        notification.error({
          message: 'Authorization failed',
          description:
            'Please ensure your wallet is set to either Mainnet, xDai, or Goerli and authorize the request.',
          duration: 15,
          key: NOTIFICATION_KEY
        })
        setWeb3Actions([])
        setConnectionState(JSON.parse(JSON.stringify(initialState)))
        web3Context.error = null
      } else if (web3Context.account) {
        if (!connectionState.notifiedAuthAccquired) {
          notification.success({
            message: 'Authorization acquired',
            duration: 3,
            key: NOTIFICATION_KEY
          })
          setConnectionState(prev => ({ ...prev, notifiedAuthAccquired: true }))
          if (connectionState.method === 'Injected')
            localforage.setItem(LAST_CONNECTION_TIME, Date.now())
        }

        while (web3Actions.length > 0) {
          // Process each web3 action.
          // TODO: Remove FastJsonRpcSigner when ethers v5 is out.
          // See https://github.com/ethers-io/ethers.js/issues/511
          const signer = new FastJsonRpcSigner(
            web3Context.library.getSigner(web3Context.account)
          )
          const web3Action = web3Actions.pop()
          if (web3Action.type === actionTypes.TRANSACTION) {
            await processWeb3Action(
              web3Action,
              web3Context,
              signer,
              factoryInterface,
              web3Context.networkId
            )
            return
          }
          if (
            web3Action.type === actionTypes.AUTHORIZATION &&
            web3Action.action &&
            typeof web3Action.action === 'function'
          )
            web3Action.action()
        }
      }
    })()
  }, [
    web3Context,
    connectionState,
    initialState,
    web3Actions,
    factoryInterface
  ])

  // Handle Wallet connect modal state.
  useEffect(() => {
    if (
      web3Context.active &&
      web3Context.connectorName === 'WalletConnect' &&
      web3Context.connector
    )
      if (!web3Context.account) {
        WalletConnectQRCodeModal.open(
          web3Context.connector.walletConnector.uri,
          () => {}
        )
      } else {
        try {
          WalletConnectQRCodeModal.close()
        } catch (err) {
          console.error(err)
        }
      }
  }, [
    web3Context.connector,
    web3Context.account,
    web3Context.active,
    web3Context.connectorName
  ])

  return {
    requestModalOpen: connectionState.modalOpen,
    cancelRequest,
    pushWeb3Action,
    requestWeb3Auth,
    setUserSelectedWallet,
    archon,
    timestamp,
    networkId: web3Context.networkId,
    latestBlock
  }
}

/**
 * @param {{type: string, action: function}} web3Action - The action dispatched to the wallet.
 * @param {object} web3Context - The web3-react context.
 * @param {object} signer - The signer to use.
 */
async function processWeb3Action(
  web3Action,
  web3Context,
  signer,
  factoryInterface,
  networkId
) {
  const notificationID = uuid()
  notification.info({
    message: 'Requesting Signature',
    duration: 0,
    key: notificationID
  })
  try {
    const { tx, actionMessage, onTxMined, deployTCR } = await web3Action.action(
      web3Context,
      signer
    )
    const hash = tx.hash
    const txLink = getTxPage({ networkId, txHash: hash })
    notification.info({
      message: actionMessage || 'Transaction submitted.',
      duration: 0,
      key: notificationID,
      icon: <Icon type="loading" style={{ color: '#108ee9' }} />,
      description: (
        <a href={txLink} target="_blank" rel="noopener noreferrer">
          View on block explorer
        </a>
      )
    })

    const txMined = await web3Context.library.waitForTransaction(hash)

    notification.success({
      message: 'Transaction mined!',
      description: (
        <a href={txLink} target="_blank" rel="noopener noreferrer">
          View on block explorer
        </a>
      ),
      duration: 5,
      key: notificationID
    })

    if (onTxMined)
      if (deployTCR)
        // The 8th log is the NewTCR event emitted when creating the TCR.
        // It has the address of the new TCR.
        onTxMined({
          contractAddress: factoryInterface.parseLog(txMined.logs[7]).values
            ._address
        })
      else onTxMined()
  } catch (err) {
    notification.error({
      message: 'Error submitting transaction',
      description: `${err.message || ''}`,
      duration: 0,
      key: notificationID
    })
  }
}

export default useNotificationWeb3
