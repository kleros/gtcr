import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { BrowserRouter } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import Footer from '../components/footer.tsx'
import Web3Provider from 'web3-react'
import { Layout } from 'antd'
import { register } from './service-worker'
import { WalletProvider } from 'contexts/wallet-context'
import { TourProvider } from 'contexts/tour-context'
import WalletModal from 'components/modals/wallet-modal'
import WelcomeModal from 'components/modals/welcome-modal'
import AppBar from 'components/layout/app-bar'
import AppRouter from './app-router'
import connectors from 'config/connectors'
import 'antd/dist/antd.css'
import './theme.css'
import './fontawesome'

const StyledClickaway = styled.div`
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
`

const FooterWrapper = styled.div`
  margin-top: auto !important;
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
    <Web3Provider connectors={connectors} libraryName="ethers.js">
      <BrowserRouter>
        <TourProvider>
          <WalletProvider>
            <Helmet>
              <title>Kleros · Curate</title>
              <link
                href="https://fonts.googleapis.com/css?family=Roboto:400,400i,500,500i,700,700i"
                rel="stylesheet"
              />
            </Helmet>
            <StyledLayout>
              <Layout>
                <AppBar />
                <AppRouter />
                <StyledClickaway
                  isMenuClosed={isMenuClosed}
                  onClick={isMenuClosed ? null : () => setIsMenuClosed(true)}
                />
              </Layout>
            </StyledLayout>
            <FooterWrapper>
              <Footer />
            </FooterWrapper>
            <WalletModal connectors={connectors} />
            <WelcomeModal />
          </WalletProvider>
        </TourProvider>
      </BrowserRouter>
    </Web3Provider>
  )
}

export default App

register({
  onUpdate: () =>
    console.info('An update is ready. Please close and reopen all tabs.', 0)
})
