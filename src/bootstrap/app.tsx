import React, { useContext, useEffect, useState } from 'react'
import styled from 'styled-components'
import { BrowserRouter } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import Footer from '../components/footer.tsx'
import Layout from 'components/ui/Layout'
import { unregister } from './service-worker'
import { WalletProvider } from 'contexts/wallet-context'
import { TourProvider } from 'contexts/tour-context'
import { StakeProvider } from 'contexts/stake-context'
import { ThemeProvider, ThemeContext } from 'contexts/theme-context'
import WelcomeModal from 'components/modals/welcome-modal'
import SmartContractWalletWarning from 'components/smart-contract-wallet-warning'
import AppBar from 'components/layout/app-bar'
import AppRouter from './app-router'
import ErrorPage from 'pages/error-page'
import { wagmiConfig } from 'config/wagmi'
import { ToastContainer } from 'react-toastify'
import GlobalStyle from 'styles/global-styles'
import 'react-toastify/dist/ReactToastify.css'
import './fontawesome'

const queryClient = new QueryClient()

const ThemedToastContainer = () => {
  const { isDarkMode } = useContext(ThemeContext)
  return <ToastContainer theme={isDarkMode ? 'dark' : 'light'} />
}

const StyledClickaway = styled.div<{ isMenuClosed: boolean }>`
  background-color: black;
  position: fixed;
  width: 100%;
  height: 100%;
  opacity: ${properties => (properties.isMenuClosed ? 0 : 0.4)};
  transition: opacity 0.3s;
  pointer-events: ${properties => (properties.isMenuClosed ? 'none' : 'auto')};
`

const StyledLayout = styled(Layout)`
  min-height: 100vh !important;
  background: ${({ theme }) => theme.bodyBackground} !important;
  overflow-x: hidden;
`

const App = () => {
  const [isMenuClosed, setIsMenuClosed] = useState(true)

  // this useEffect redirects the URL to a correct one in case Court sent you to an incorrect URL using old ?chainId= syntax
  useEffect(() => {
    const url = window.location.href
    let tcrAddress, itemId, chainId

    if (url.includes('?chainId=')) {
      tcrAddress = url.split('/')[4]
      itemId = url.split('/')[5].split('?')[0]
      chainId = url.split('=')[1]
      const redirectUrl = url.replace(
        `/tcr/${tcrAddress}/${itemId}?chainId=${chainId}`,
        `/tcr/${chainId}/${tcrAddress}/${itemId}`
      )
      window.location.replace(redirectUrl)
    }
  }, [])

  return (
    <ThemeProvider>
      <GlobalStyle />
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ErrorBoundary
              FallbackComponent={({ error }) => (
                <ErrorPage
                  code="Error"
                  title="Something went wrong"
                  message={error?.message || 'An unexpected error occurred.'}
                  tip="Try refreshing the page."
                />
              )}
            >
              <TourProvider>
                <WalletProvider>
                  <Helmet>
                    <title>Kleros · Curate</title>
                    <link
                      href="https://fonts.googleapis.com/css?family=Roboto:400,400i,500,500i,700,700i"
                      rel="stylesheet"
                    />
                  </Helmet>
                  <StakeProvider>
                    <StyledLayout>
                      <SmartContractWalletWarning />
                      <AppBar />
                      <AppRouter />
                      <StyledClickaway
                        isMenuClosed={isMenuClosed}
                        onClick={
                          isMenuClosed ? null : () => setIsMenuClosed(true)
                        }
                      />
                      <Footer />
                    </StyledLayout>
                  </StakeProvider>
                  <WelcomeModal />
                  <ThemedToastContainer />
                </WalletProvider>
              </TourProvider>
            </ErrorBoundary>
          </BrowserRouter>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}

export default App

// Unregister service worker to prevent aggressive caching.
// This ensures users always get the latest version without needing to clear cache.
unregister()
