import { Connectors } from 'web3-react'
import WalletConnectApi from '@walletconnect/web3-subprovider'
import FortmaticApi from 'fortmatic'
import { NETWORKS_INFO, NETWORKS } from 'config/networks'
import { SAVED_NETWORK_KEY } from '../utils/string'
import getNetworkEnv from '../utils/network-env'

const {
  NetworkOnlyConnector,
  InjectedConnector,
  LedgerConnector,
  FortmaticConnector,
  WalletConnectConnector
} = Connectors

const connectors = {}

const defaultNetwork = Number(
  localStorage.getItem(SAVED_NETWORK_KEY) ??
    process.env.REACT_APP_DEFAULT_NETWORK
)

if (process.env.REACT_APP_RPC_URLS) {
  const supportedNetworkURLs = JSON.parse(process.env.REACT_APP_RPC_URLS)
  connectors.Infura = new NetworkOnlyConnector({
    providerURL: supportedNetworkURLs[defaultNetwork]
  })
  connectors.xDai = new NetworkOnlyConnector({
    providerURL: supportedNetworkURLs[NETWORKS.gnosis]
  })

  connectors.Ledger = new LedgerConnector({
    supportedNetworkURLs,
    defaultNetwork
  })

  if (process.env.REACT_APP_WALLETCONNECT_BRIDGE_URL)
    connectors.WalletConnect = new WalletConnectConnector({
      api: WalletConnectApi,
      bridge: process.env.REACT_APP_WALLETCONNECT_BRIDGE_URL,
      supportedNetworkURLs,
      defaultNetwork
    })
}

const fortmaticApiKey = getNetworkEnv('REACT_APP_FORMATIC_API_KEYS')
if (fortmaticApiKey)
  connectors.Fortmatic = new FortmaticConnector({
    api: FortmaticApi,
    apiKey: fortmaticApiKey,
    logoutOnDeactivation: false,
    testNetwork:
      defaultNetwork === NETWORKS.ethereum
        ? null
        : NETWORKS_INFO[defaultNetwork].name
  })

if (window.ethereum)
  connectors.Injected = new InjectedConnector({
    supportedNetworks: [NETWORKS.ethereum, NETWORKS.gnosis, NETWORKS.sepolia]
  })

export default connectors
