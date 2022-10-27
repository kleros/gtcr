import React, { useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import Footer from '../components/footer.tsx'
import styled from 'styled-components/macro'
import Web3Provider from 'web3-react'
import { Layout } from 'antd'
import { register } from './service-worker'
import { WalletProvider } from 'contexts/wallet-context'
import { TourProvider } from 'contexts/tour-context'
import WalletModal from 'components/modals/wallet-modal'
import WelcomeModal from 'components/modals/welcome-modal'
import AppBar from 'components/layout/app-bar'
import AppMenu from 'components/layout/app-menu'
import AppRouter from './app-router'
import connectors from 'config/connectors'
import 'antd/dist/antd.css'
import './theme.css'
import './fontawesome'

const StyledLayoutSider = styled(Layout.Sider)`
  height: 100%;
  position: fixed;
  z-index: 2000;

  @media (min-width: 992px) {
    display: none;
  }

  .ant-layout-sider-zero-width-trigger {
    right: -50px;
    top: 12px;
    width: 50px;
  }
`

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

const StyledHeader = styled(Layout.Header)`
  padding: 0 !important;
`

const FooterWrapper = styled.div`
  margin-top: auto !important;
`

const App = () => {
  const [isMenuClosed, setIsMenuClosed] = useState(true)

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
              <StyledLayoutSider
                breakpoint="lg"
                collapsedWidth={0}
                collapsed={isMenuClosed}
                onClick={() => setIsMenuClosed(previousState => !previousState)}
              >
                <AppMenu mode="vertical" />
              </StyledLayoutSider>
              {/* Overflow x property must be visible for reactour scrolling to work properly. */}
              <Layout style={{ overflowX: 'visible' }}>
                <StyledHeader>
                  <AppBar />
                </StyledHeader>
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
