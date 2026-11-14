import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { SUPPORTED_CHAINS, DEFAULT_CHAIN } from './chains'
import { transports } from './rpc'

const APP_NAME = 'Kleros Curate'
// Wallets show the name and icon when someone connects and check the URL
// against the page that asked, so both are this site's own absolute
// addresses (curate.kleros.io and curate.kleros.builders serve the app).
const APP_URL = window.location.origin
const APP_ICON = `${APP_URL}/icon-192.png`

const projectId =
  import.meta.env.REACT_APP_REOWN_PROJECT_ID ||
  process.env.REACT_APP_REOWN_PROJECT_ID ||
  ''

export const wagmiAdapter = new WagmiAdapter({
  networks: SUPPORTED_CHAINS,
  projectId,
  transports,
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

export const appKitModal = projectId
  ? createAppKit({
      adapters: [wagmiAdapter],
      networks: SUPPORTED_CHAINS,
      defaultNetwork: DEFAULT_CHAIN,
      projectId,
      allowUnsupportedChain: true,
      // AppKit's own Coinbase connector, with the Coinbase SDK's telemetry
      // (a tracking script it loads on every page) switched off. AppKit
      // hands this option to the connector as its preference; the typings
      // name only the strings, but the SDK takes this object. A connector
      // of our own was registered before the Coinbase extension announced
      // itself, so AppKit dropped the extension as its duplicate and the
      // wallet modal listed no Coinbase Wallet at all.
      coinbasePreference: {
        options: 'all',
        telemetry: false,
      } as unknown as 'all',
      metadata: {
        name: APP_NAME,
        description:
          'A UI for the Kleros powered Generalized Token Curated List',
        url: APP_URL,
        icons: [APP_ICON],
      },
      features: {
        analytics: false,
      },
      // The wallet modal opens from inside the app's dialogs (z-index up
      // to 1070), so it must stack above all of them.
      themeVariables: {
        '--w3m-z-index': 2000,
      },
    })
  : null
