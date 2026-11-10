import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { coinbaseWallet } from 'wagmi/connectors'
import { SUPPORTED_CHAINS, DEFAULT_CHAIN } from './chains'
import { transports } from './rpc'

const APP_NAME = 'Kleros Curate'
const APP_ICON = '/favicon.ico'

const projectId =
  import.meta.env.REACT_APP_REOWN_PROJECT_ID ||
  process.env.REACT_APP_REOWN_PROJECT_ID ||
  ''

export const wagmiAdapter = new WagmiAdapter({
  networks: SUPPORTED_CHAINS,
  projectId,
  transports,
  // AppKit's own Coinbase connector cannot turn off the Coinbase SDK's
  // telemetry, which loads a tracking script on every page. This one is
  // the same connector with that switched off (see enableCoinbase below).
  connectors: [
    coinbaseWallet({
      appName: APP_NAME,
      appLogoUrl: APP_ICON,
      preference: { options: 'all', telemetry: false },
    }),
  ],
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

export const appKitModal = projectId
  ? createAppKit({
      adapters: [wagmiAdapter],
      networks: SUPPORTED_CHAINS,
      defaultNetwork: DEFAULT_CHAIN,
      projectId,
      allowUnsupportedChain: true,
      enableCoinbase: false,
      metadata: {
        name: APP_NAME,
        description:
          'A UI for the Kleros powered Generalized Token Curated List',
        url: 'https://curate.kleros.builders',
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
