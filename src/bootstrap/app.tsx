import React, { useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styled from 'styled-components'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import Footer from '../components/footer'
import Layout from 'components/ui/Layout'
import { unregister } from './service-worker'
import { WalletProvider } from 'contexts/wallet-context'
import { StakeProvider } from 'contexts/stake-context'
import { ThemeProvider, ThemeContext } from 'contexts/theme-context'
import SmartContractWalletWarning from 'components/smart-contract-wallet-warning'
import AppBar from 'components/layout/app-bar'
import RefreshAfterTransactions from 'components/refresh-after-transactions'
import WalletNetworkFollowsPage from 'components/wallet-network-follows-page'
import Stage from 'components/layout/stage'
import AppRouter from './app-router'
import ErrorPage from 'pages/error-page'
import { appKitModal, wagmiConfig } from 'config/wagmi'
import { GraphqlBatcherProvider } from 'contexts/graphql-batcher'
import AtlasProvider from 'contexts/atlas-provider'
import { ToastContainer } from 'react-toastify'
import GlobalStyle from 'styles/global-styles'
import 'react-toastify/dist/ReactToastify.css'
import './fontawesome'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

/*
 * Toasts are rendered on <body>, outside #root. #root is a stacking layer of
 * its own (global styles) and every dialog is portalled to <body> above it,
 * so a toast left inside #root was painted under any open dialog: what a
 * dialog has to say while it works (confirm in your wallet, sent, failed,
 * and every error) went unseen. On <body> they also stay clickable while a
 * modal marks #root inert.
 */
const ThemedToastContainer = () => {
  const themeContext = useContext(ThemeContext)
  return createPortal(
    <ToastContainer
      position="top-center"
      theme={themeContext?.isDarkMode ? 'dark' : 'light'}
    />,
    document.body,
  )
}

/*
 * The wallet modal follows the app's theme. Left alone it is always dark:
 * a black sheet over the Light theme's pale page.
 */
const WalletModalTheme = () => {
  const isDarkMode = useContext(ThemeContext)?.isDarkMode
  useEffect(() => {
    appKitModal?.setThemeMode(isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])
  return null
}

const StyledClickaway = styled.div<{ isMenuClosed: boolean }>`
  background-color: black;
  position: fixed;
  width: 100%;
  height: 100%;
  opacity: ${(properties) => (properties.isMenuClosed ? 0 : 0.4)};
  transition: opacity 0.3s;
  pointer-events: ${(properties) =>
    properties.isMenuClosed ? 'none' : 'auto'};
`

/*
 * Full bleed (round 2): the app runs edge to edge on the stage colour, with
 * the aurora as a soft glow behind the top of the page (Stage). No frame, no
 * corner or side borders. Horizontal overflow is clipped here, not scrolled.
 */
const StyledLayout = styled(Layout)`
  position: relative;
  z-index: 1;
  min-height: 100vh !important;
  background: transparent !important;
  overflow-x: clip;
`

const ContentContainer = styled.div`
  margin: 0 auto;
  width: 100%;
  flex: 1;
`

const App = () => {
  const [isMenuClosed, setIsMenuClosed] = useState(true)

  // Court used to link to entries as /tcr/<list>/<entry>?chainId=<id>: send
  // that one shape on to /tcr/<id>/<list>/<entry>. Any other URL that
  // happens to carry ?chainId= is left alone (cutting it up by position
  // crashed the app or sent it to a broken address).
  useEffect(() => {
    const legacy = /^\/tcr\/(0x[0-9a-fA-F]{40})\/(0x[0-9a-fA-F]{64})\/?$/.exec(
      window.location.pathname,
    )
    const chainId = new URLSearchParams(window.location.search).get('chainId')
    if (legacy && chainId && /^\d+$/.test(chainId))
      window.location.replace(`/tcr/${chainId}/${legacy[1]}/${legacy[2]}`)
  }, [])

  return (
    <ThemeProvider>
      <GlobalStyle />
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AtlasProvider>
            <GraphqlBatcherProvider>
              <BrowserRouter future={{ v7_relativeSplatPath: true }}>
                <ErrorBoundary
                  FallbackComponent={({ error }) => (
                    <ErrorPage
                      code="Error"
                      title="Something went wrong"
                      message={
                        (error instanceof Error && error.message) ||
                        'An unexpected error occurred.'
                      }
                      tip="Try refreshing the page."
                    />
                  )}
                >
                  <WalletProvider>
                    <StakeProvider>
                      <Stage />
                      <StyledLayout>
                        <SmartContractWalletWarning />
                        <AppBar />
                        <ContentContainer>
                          <AppRouter />
                        </ContentContainer>
                        <StyledClickaway
                          isMenuClosed={isMenuClosed}
                          onClick={
                            isMenuClosed
                              ? undefined
                              : () => setIsMenuClosed(true)
                          }
                        />
                        <Footer />
                      </StyledLayout>
                    </StakeProvider>
                    <ThemedToastContainer />
                    <WalletModalTheme />
                    <RefreshAfterTransactions />
                    <WalletNetworkFollowsPage />
                  </WalletProvider>
                </ErrorBoundary>
              </BrowserRouter>
            </GraphqlBatcherProvider>
          </AtlasProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}

export default App

// Unregister service worker to prevent aggressive caching.
// This ensures users always get the latest version without needing to clear cache.
unregister()
