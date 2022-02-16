import React, { useEffect, useState } from 'react'
import WalletConnectApi from '@walletconnect/web3-subprovider'
import FortmaticApi from 'fortmatic'
import { Helmet } from 'react-helmet'
import { Footer } from '@kleros/react-components'
import loadable from '@loadable/component'
import styled from 'styled-components/macro'
import Web3Provider, { Connectors, useWeb3Context } from 'web3-react'
import PropTypes from 'prop-types'
import 'antd/dist/antd.css'
import './theme.css'
import {
  BrowserRouter,
  Route,
  Switch,
  NavLink,
  Redirect,
  useLocation
} from 'react-router-dom'
import { Layout, Menu, Spin, Icon } from 'antd'
import { register } from './service-worker'
import { WalletProvider } from './wallet-context'
import { TourProvider } from './tour-context'
import { NETWORK_NAME, NETWORK } from '../utils/network-utils'
import ErrorPage from '../pages/error-page'
import useMainTCR2 from '../hooks/tcr2'
import useNetworkEnvVariable from '../hooks/network-env'
import WalletModal from './wallet-modal'
import './fontawesome'
import TopBar from './top-bar'
import NoWeb3Detected from './no-web3'
import WelcomeModal from './welcome-modal'
import { SAVED_NETWORK_KEY } from '../utils/string'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { HttpLink } from '@apollo/client/link/http'
import ItemsRouter from '../pages/items-router'
import ItemDetailsRouter from '../pages/item-details-router'
import { useHistory } from 'react-router-dom/cjs/react-router-dom.min'

const StyledSpin = styled(Spin)`
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
`

const StyledLayoutContent = styled(Layout.Content)`
  padding: 42px 9.375vw 42px;
`

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
  min-height: 100vh;
`

const StyledHeader = styled(Layout.Header)`
  padding: 0;
`

const FooterWrapper = styled.div`
  margin-top: auto;
`

const StyledMenuItem = styled(Menu.Item)`
  background-color: transparent !important;
`

const Factory = loadable(
  () => import(/* webpackPrefetch: true */ '../pages/factory/index'),
  {
    fallback: (
      <StyledLayoutContent>
        <StyledSpin />
      </StyledLayoutContent>
    )
  }
)

const ClassicFactory = loadable(
  () => import(/* webpackPrefetch: true */ '../pages/factory-classic/index'),
  {
    fallback: (
      <StyledLayoutContent>
        <StyledSpin />
      </StyledLayoutContent>
    )
  }
)

const MenuItems = ({ TCR2_ADDRESS }) => [
  <StyledMenuItem key="tcrs-item">
    <NavLink to={`/tcr/${TCR2_ADDRESS}`}>Browse</NavLink>
  </StyledMenuItem>,
  <StyledMenuItem key="factory-item">
    <NavLink to="/factory">Create a List</NavLink>
  </StyledMenuItem>,
  <StyledMenuItem key="twitter-link">
    <a href="https://twitter.com/KlerosCurate">
      Follow Curate <Icon type="twitter" />
    </a>
  </StyledMenuItem>,
  <StyledMenuItem key="telegram-link">
    <a href="https://t.me/KlerosCurate">
      Get Help <Icon type="info-circle" />
    </a>
  </StyledMenuItem>
]

MenuItems.propTypes = {
  TCR2_ADDRESS: PropTypes.string.isRequired
}

const {
  NetworkOnlyConnector,
  InjectedConnector,
  LedgerConnector,
  FortmaticConnector,
  WalletConnectConnector
} = Connectors

const connectors = {}
const urlSearchParams = new URLSearchParams(window.location.search)
const params = Object.fromEntries(urlSearchParams.entries())
const { chainId } = params || {}

let defaultNetwork =
  chainId ??
  localStorage.getItem(SAVED_NETWORK_KEY) ??
  process.env.REACT_APP_DEFAULT_NETWORK
defaultNetwork = Number(defaultNetwork)

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

const Content = () => {
  const TCR2_ADDRESS = useMainTCR2()
  const location = useLocation()
  const history = useHistory()
  const web3Context = useWeb3Context()

  useEffect(() => {
    if (![null, undefined].includes(web3Context.networkId) && !location.search)
      history.push(`?chainId=${web3Context.networkId}`)
  }, [web3Context.networkId, location.pathname, location.search, history])

  if (Object.entries(connectors).length === 0) return <NoWeb3Detected />

  return (
    <Switch>
      <Route path="/tcr/:tcrAddress">
        {({
          match: {
            params: { tcrAddress }
          },
          location: { search },
          history
        }) => (
          <Switch>
            <Route path="/tcr/:tcrAddress/:itemID">
              {({
                match: {
                  params: { itemID }
                }
              }) => (
                <ItemDetailsRouter
                  search={search}
                  itemID={itemID}
                  tcrAddress={tcrAddress}
                  history={history}
                />
              )}
            </Route>
            <Route path="/tcr/:tcrAddress">
              <ItemsRouter
                search={search}
                history={history}
                tcrAddress={tcrAddress}
              />
            </Route>
          </Switch>
        )}
      </Route>
      <Route path="/factory" exact component={Factory} />
      <Route path="/factory-classic" exact component={ClassicFactory} />
      <Redirect from="/" exact to={`/tcr/${TCR2_ADDRESS}`} />
      <Route path="*" exact component={ErrorPage} />
    </Switch>
  )
}

const AppWrapper = () => {
  const [isMenuClosed, setIsMenuClosed] = useState(true)
  const web3Context = useWeb3Context()
  const TCR2_ADDRESS = useMainTCR2(web3Context)

  const GTCR_SUBGRAPH_URL = useNetworkEnvVariable(
    'REACT_APP_SUBGRAPH_URL',
    web3Context.networkId
  )

  const httpLink = new HttpLink({
    uri: GTCR_SUBGRAPH_URL
  })

  const client = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache()
  })

  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <TourProvider>
          <WalletProvider>
            <StyledLayout>
              <StyledLayoutSider
                breakpoint="lg"
                collapsedWidth={0}
                collapsed={isMenuClosed}
                onClick={() => setIsMenuClosed(previousState => !previousState)}
              >
                <Menu theme="dark">
                  {[
                    <Menu.Item key="tcrs" style={{ height: '70px' }}>
                      <NavLink to={`/tcr/${TCR2_ADDRESS}`}>K L E R O S</NavLink>
                    </Menu.Item>
                  ].concat(MenuItems({ TCR2_ADDRESS }))}
                </Menu>
              </StyledLayoutSider>
              {/* Overflow x property must be visible for reactour scrolling to work properly. */}
              <Layout style={{ overflowX: 'visible' }}>
                <StyledHeader>
                  <TopBar menuItems={MenuItems} />
                </StyledHeader>
                <Content />
                <StyledClickaway
                  isMenuClosed={isMenuClosed}
                  onClick={isMenuClosed ? null : () => setIsMenuClosed(true)}
                />
              </Layout>
            </StyledLayout>
            <FooterWrapper>
              <Footer appName="Kleros · Curate" />
            </FooterWrapper>
            <WalletModal connectors={connectors} />
          </WalletProvider>
          <WelcomeModal />
        </TourProvider>
      </BrowserRouter>
    </ApolloProvider>
  )
}

export default () => (
  <>
    <Helmet>
      <title>Kleros · Curate</title>
      <link
        href="https://fonts.googleapis.com/css?family=Roboto:400,400i,500,500i,700,700i"
        rel="stylesheet"
      />
    </Helmet>
    <Web3Provider connectors={connectors} libraryName="ethers.js">
      <AppWrapper />
    </Web3Provider>
  </>
)

register({
  onUpdate: () =>
    console.info('An update is ready. Please close and reopen all tabs.', 0)
})
