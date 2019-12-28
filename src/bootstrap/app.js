import React, { useState, useContext } from 'react'
import WalletConnectApi from '@walletconnect/web3-subprovider'
import FortmaticApi from 'fortmatic'
import PortisApi from '@portis/web3'
import { Helmet } from 'react-helmet'
import { Footer } from '@kleros/react-components'
import loadable from '@loadable/component'
import styled from 'styled-components/macro'
import Web3Provider, { Connectors, useWeb3Context } from 'web3-react'
import 'antd/dist/antd.css'
import './theme.css'
import {
  BrowserRouter,
  Route,
  Switch,
  Link,
  NavLink,
  Redirect
} from 'react-router-dom'
import { Col, Layout, Menu, Row, Spin, message, Button, Badge } from 'antd'
import { register } from './service-worker'
import { WalletProvider, WalletContext } from './wallet-context'
import { NETWORK_NAME, NETWORK_COLOR } from '../utils/network-utils'
import ErrorPage from '../pages/error-page'
import useMainTCR2 from '../hooks/tcr2'
import Identicon from '../components/identicon'
import Notifications from '../components/notifications'
import { TCRViewProvider } from './tcr-view-context'
import useNetworkEnvVariable from '../hooks/network-env'
import { ReactComponent as Logo } from '../assets/images/logo.svg'
import { capitalizeFirstLetter } from '../utils/string'
import WalletModal from './wallet-modal'
import './fontawesome'

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

  @media (min-width: 768px) {
    display: none;
  }

  .ant-layout-sider-zero-width-trigger {
    right: -50px;
    top: 12px;
    width: 50px;
  }
`
const StyledCol = styled(Col)`
  align-items: center;
  display: flex;
  justify-content: center;
  height: 67px;
`

const StyledCenter = styled(StyledCol)`
  @media (max-width: 768px) {
    &.ant-col-xs-0 {
      display: none;
    }
  }
`

const StyledColStart = styled(StyledCol)`
  justify-content: flex-start;

  @media (max-width: 576px) {
    &.ant-col-xs-0 {
      display: none;
    }
  }
`

const StyledColEnd = styled(StyledCol)`
  justify-content: flex-end;

  @media (max-width: 576px) {
    &.ant-col-xs-24 {
      justify-content: center;
    }
  }
`

const StyledNetworkStatus = styled.span`
  color: white;
  margin-right: 24px;
`

const StyledMenu = styled(Menu)`
  font-weight: bold;
  line-height: 64px !important;
  text-align: center;
  background-color: transparent;
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

const StyledRouterLink = styled(Link)`
  color: #fff;
  display: flex;
`

const StyledConnectButton = styled(Button)`
  :focus {
    color: white;
    border-color: white;
  }
`

const FooterWrapper = styled.div`
  margin-top: auto;
`

const StyledSpan = styled.span`
  text-decoration: underline;
  cursor: pointer;
`

const StyledTopBarRow = styled(Row)`
  padding: 0 9.375vw;
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

const Items = loadable(
  () => import(/* webpackPrefetch: true */ '../pages/items/index'),
  {
    fallback: (
      <StyledLayoutContent>
        <StyledSpin />
      </StyledLayoutContent>
    )
  }
)

const ItemDetails = loadable(
  () => import(/* webpackPrefetch: true */ '../pages/item-details/index'),
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
    <NavLink to={`/tcr/${TCR2_ADDRESS}`}>TCRs</NavLink>
  </StyledMenuItem>,
  <StyledMenuItem key="factory-item">
    <NavLink to="/factory">Create a TCR</NavLink>
  </StyledMenuItem>
]

const {
  NetworkOnlyConnector,
  InjectedConnector,
  LedgerConnector,
  FortmaticConnector,
  PortisConnector,
  WalletConnectConnector
} = Connectors

const connectors = {}
const defaultNetwork = Number(process.env.REACT_APP_DEFAULT_NETWORK) || 42
if (process.env.REACT_APP_RPC_URLS) {
  const supportedNetworkURLs = JSON.parse(process.env.REACT_APP_RPC_URLS)
  connectors.Infura = new NetworkOnlyConnector({
    providerURL: supportedNetworkURLs[defaultNetwork]
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
    testNetwork: defaultNetwork === 1 ? null : NETWORK_NAME[defaultNetwork]
  })

if (process.env.REACT_APP_PORTIS_DAPP_ID)
  connectors.Portis = new PortisConnector({
    api: PortisApi,
    dAppId: process.env.REACT_APP_PORTIS_DAPP_ID,
    network: NETWORK_NAME[defaultNetwork]
  })

if (window.ethereum)
  connectors.Injected = new InjectedConnector({ supportedNetworks: [42, 1] })

const TopBar = () => {
  const web3Context = useWeb3Context()
  const { requestWeb3Auth } = useContext(WalletContext)
  const TCR2_ADDRESS = useMainTCR2(web3Context)

  return (
    <StyledTopBarRow type="flex" justify="space-between">
      <StyledColStart md={6} sm={12} xs={0}>
        <StyledRouterLink to={`/tcr/${TCR2_ADDRESS}`}>
          <Logo />
        </StyledRouterLink>
      </StyledColStart>
      <StyledCenter md={8} sm={0} xs={0}>
        <StyledMenu mode="horizontal" theme="dark">
          {MenuItems({ TCR2_ADDRESS })}
        </StyledMenu>
      </StyledCenter>
      <StyledColEnd md={7} sm={12} xs={24}>
        {web3Context.active && web3Context.networkId && (
          <StyledNetworkStatus>
            <Badge color={NETWORK_COLOR[web3Context.networkId]} />
            {capitalizeFirstLetter(NETWORK_NAME[web3Context.networkId])}
          </StyledNetworkStatus>
        )}
        {process.env.REACT_APP_NOTIFICATIONS_API_URL && web3Context.account && (
          <Notifications />
        )}
        {web3Context.active && web3Context.account ? (
          <Identicon />
        ) : (
          <StyledConnectButton
            ghost
            shape="round"
            onClick={() => requestWeb3Auth()}
          >
            Connect
          </StyledConnectButton>
        )}
      </StyledColEnd>
    </StyledTopBarRow>
  )
}

const NoWeb3Detected = () => {
  const { requestWeb3Auth } = useContext(WalletContext)
  return (
    <ErrorPage
      code="Web3 Required"
      message="A provider is required to view blockchain data."
      tip={
        <div>
          Please{' '}
          <StyledSpan
            className="primary-color theme-color"
            onClick={requestWeb3Auth}
          >
            connect a wallet.
          </StyledSpan>
        </div>
      }
    />
  )
}

const Content = () => {
  const TCR2_ADDRESS = useMainTCR2()

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
          <TCRViewProvider tcrAddress={tcrAddress}>
            <Switch>
              <Route path="/tcr/:tcrAddress/:itemID">
                {({
                  match: {
                    params: { itemID }
                  }
                }) => <ItemDetails itemID={itemID} />}
              </Route>
              <Route path="/tcr/:tcrAddress">
                <Items search={search} history={history} />
              </Route>
            </Switch>
          </TCRViewProvider>
        )}
      </Route>
      <Route path="/factory" exact component={Factory} />
      <Redirect from="/" exact to={`/tcr/${TCR2_ADDRESS}`} />
      <Route path="*" exact component={ErrorPage} />
    </Switch>
  )
}

export default () => {
  const [isMenuClosed, setIsMenuClosed] = useState(true)
  const web3Context = useWeb3Context()
  const TCR2_ADDRESS = useMainTCR2(web3Context)
  return (
    <>
      <Helmet>
        <title>Kleros · Generalized Token Curated List</title>
        <link
          href="https://fonts.googleapis.com/css?family=Roboto:400,400i,500,500i,700,700i"
          rel="stylesheet"
        />
      </Helmet>
      <BrowserRouter>
        <Web3Provider connectors={connectors} libraryName="ethers.js">
          <WalletProvider>
            <StyledLayout>
              <StyledLayoutSider
                breakpoint="md"
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
              <Layout>
                <StyledHeader>
                  <TopBar />
                </StyledHeader>
                <Content />
                <StyledClickaway
                  isMenuClosed={isMenuClosed}
                  onClick={isMenuClosed ? null : () => setIsMenuClosed(true)}
                />
              </Layout>
            </StyledLayout>
            <FooterWrapper>
              <Footer appName="Kleros · GTCR" />
            </FooterWrapper>
            <WalletModal connectors={connectors} />
          </WalletProvider>
        </Web3Provider>
      </BrowserRouter>
    </>
  )
}

register({
  onUpdate: () =>
    message.warning('An update is ready. Please close and reopen all tabs.', 0)
})
