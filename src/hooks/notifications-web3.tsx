import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'react-toastify'
import { useAccount, useChainId } from 'wagmi'
import { v4 as uuid } from 'uuid'
import localforage from 'localforage'
import { ethers, BigNumber } from 'ethers'
import _GTCRFactory from '../assets/abis/LightGTCRFactory.json'
import { getTxPage } from '../utils/network-utils'
import { defaultTcrAddresses } from 'config/tcr-addresses'
import { NETWORKS, DEFAULT_NETWORK } from 'config/networks'
import { useEthersProvider, useEthersSigner } from './ethers-adapters'
import { appKitModal } from 'config/wagmi'

const actionTypes = {
  TRANSACTION: 'TRANSACTION',
  AUTHORIZATION: 'AUTHORIZATION'
}

/**
 * This hook manages wallet notifications and transaction processing.
 * It uses wagmi for wallet state and Reown AppKit for the connection modal.
 *
 * To request connection to the wallet, call `requestWeb3Auth()`.
 * To send a transaction, use `pushWeb3Action(action)` which will
 * prompt connection if needed.
 */
const useNotificationWeb3 = () => {
  const { address: account, isConnected } = useAccount()
  const chainId = useChainId()
  const networkId = chainId ?? DEFAULT_NETWORK
  const provider = useEthersProvider({ chainId })
  const signer = useEthersSigner({ chainId })
  const [web3Actions, setWeb3Actions] = useState<any[]>([])
  const [timestamp, setTimestamp] = useState<any>()
  const [network, setNetwork] = useState<any>()
  const [latestBlock, setLatestBlock] = useState<any>()
  const TCR2_ADDRESS = defaultTcrAddresses[networkId || NETWORKS.ethereum]

  const factoryInterface = useMemo(
    () => new ethers.utils.Interface(_GTCRFactory),
    []
  )
  const pushWeb3Action = useCallback(action => {
    setWeb3Actions(prevState =>
      prevState.concat({ action, type: actionTypes.TRANSACTION })
    )
  }, [])

  const requestWeb3Auth = useCallback(action => {
    // Open the Reown AppKit modal for wallet connection
    if (appKitModal) {
      appKitModal.open({ view: 'Connect' })
    }
    if (action)
      setWeb3Actions(prevState =>
        prevState.concat({ type: actionTypes.AUTHORIZATION, action })
      )
  }, [])

  const cancelRequest = useCallback(() => {
    setWeb3Actions([])
  }, [])

  // Notify of network changes.
  useEffect(() => {
    if (!networkId) return
    if (!network) {
      setNetwork(networkId)
      return
    }

    if (network && network !== networkId) {
      setNetwork(networkId)
      toast.info('Network Changed')
    }
  }, [networkId, network, TCR2_ADDRESS])

  // Fetch timestamp.
  useEffect(() => {
    if (!provider || timestamp) return
    ;(async () => {
      try {
        const block = await provider.getBlock()
        setTimestamp(BigNumber.from(block.timestamp))
        setLatestBlock(block.number)
      } catch (err) {
        console.error('Error fetching timestamp', err)
      }
    })()
  }, [timestamp, provider])

  // Process queued web3 actions when account becomes available.
  useEffect(() => {
    ;(async () => {
      if (web3Actions.length === 0) return

      // If not connected, open the Reown modal
      if (!account) {
        if (appKitModal) appKitModal.open({ view: 'Connect' })
        return
      }

      if (!signer) return

      // Process actions
      while (web3Actions.length > 0) {
        const web3Action = web3Actions.pop()
        if (web3Action.type === actionTypes.TRANSACTION) {
          const web3Context = {
            account,
            networkId,
            library: provider,
            active: isConnected
          }
          await processWeb3Action(
            web3Action,
            web3Context,
            signer,
            factoryInterface,
            networkId,
            provider
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
    })()
  }, [
    account,
    signer,
    web3Actions,
    factoryInterface,
    networkId,
    provider,
    isConnected
  ])

  return {
    requestModalOpen: false,
    cancelRequest,
    pushWeb3Action,
    requestWeb3Auth,
    setUserSelectedWallet: () => {},
    timestamp,
    networkId,
    latestBlock
  }
}

/**
 * @param {{type: string, action: function}} web3Action - The action dispatched to the wallet.
 * @param {object} web3Context - The web3 context (compatibility shape).
 * @param {object} signer - The ethers v5 signer.
 * @param {object} factoryInterface - The factory ABI interface.
 * @param {number} networkId - Current chain ID.
 * @param {object} provider - The ethers v5 provider.
 */
async function processWeb3Action(
  web3Action: any,
  web3Context: any,
  signer: any,
  factoryInterface: any,
  networkId: number,
  provider: any
): Promise<void> {
  const notificationID = uuid()
  toast.info('Requesting Signature', { toastId: notificationID, autoClose: false })
  try {
    const {
      tx,
      actionMessage,
      onTxMined,
      deployTCR,
      factoryInterface: customFactoryInterface
    } = await web3Action.action(web3Context, signer)
    const hash = tx.hash
    const txLink = getTxPage({ networkId, txHash: hash })
    toast.update(notificationID, {
      render: (
        <div>
          <div>{actionMessage || 'Transaction submitted.'}</div>
          <a href={txLink} target="_blank" rel="noopener noreferrer">
            View on block explorer
          </a>
        </div>
      ),
      type: 'info',
      autoClose: false
    })

    // Use faster polling for faster chains like Gnosis Chain
    const pollingInterval = networkId === 100 ? 2000 : 4000
    const txMined = await provider.waitForTransaction(hash, 1, pollingInterval)

    toast.update(notificationID, {
      render: (
        <div>
          <div>Transaction mined!</div>
          <a href={txLink} target="_blank" rel="noopener noreferrer">
            View on block explorer
          </a>
        </div>
      ),
      type: 'success',
      autoClose: 5000
    })

    if (onTxMined)
      if (deployTCR) {
        try {
          const interfaceToUse = customFactoryInterface || factoryInterface
          const newGTCRLog = txMined.logs.find(log => {
            try {
              const parsed = interfaceToUse.parseLog(log)
              return parsed.name === 'NewTCR' || 'NewGTCR' || 'NewPGTCR'
            } catch {
              return false
            }
          })

          if (newGTCRLog) {
            const parsedLog = interfaceToUse.parseLog(newGTCRLog)
            onTxMined({
              contractAddress: parsedLog.args._address
            })
          } else {
            console.warn('NewGTCR event not found in transaction logs')
            onTxMined({})
          }
        } catch (err) {
          console.error('Error parsing transaction logs:', err)
          onTxMined({})
        }
      } else {
        onTxMined()
      }
  } catch (err) {
    const errorMessage =
      (err as any)?.data?.message || (err as any)?.message || 'Unknown error occurred'
    toast.update(notificationID, {
      render: (
        <div>
          <div>Error submitting transaction</div>
          <div>{errorMessage}</div>
        </div>
      ),
      type: 'error',
      autoClose: false
    })
  }
}

export default useNotificationWeb3
