import { Connectors } from 'web3-react'
import WalletConnectApi from '@walletconnect/web3-subprovider'
import FortmaticApi from 'fortmatic'
import { NETWORK_NAME, NETWORK } from './network-utils'
import { SAVED_NETWORK_KEY } from './string'
import useNetworkEnvVariable from './network-env'

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
    providerURL: supportedNetworkURLs[NETWORK.XDAI]
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

const fortmaticApiKey = useNetworkEnvVariable('REACT_APP_FORMATIC_API_KEYS')
if (fortmaticApiKey)
  connectors.Fortmatic = new FortmaticConnector({
    api: FortmaticApi,
    apiKey: fortmaticApiKey,
    logoutOnDeactivation: false,
    testNetwork:
      defaultNetwork === NETWORK.MAINNET ? null : NETWORK_NAME[defaultNetwork]
  })

if (window.ethereum)
  connectors.Injected = new InjectedConnector({
    supportedNetworks: [
      NETWORK.MAINNET,
      NETWORK.KOVAN,
      NETWORK.RINKEBY,
      NETWORK.XDAI
    ]
  })

export default connectors
