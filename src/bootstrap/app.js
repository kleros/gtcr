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
import {
  Col,
  Layout,
  Menu,
  Row,
  Spin,
  message,
  Button,
  Modal,
  Icon
} from 'antd'
import { ReactComponent as TrustLogo } from '../assets/images/trust.svg'
import { register } from './service-worker'
import { WalletContext, WalletProvider } from './wallet-context'
import { NETWORK_NAME } from '../utils/network-names'
import ErrorPage from '../pages/error-page'
import useMainTCR2 from '../hooks/tcr2'
import Identicon from '../components/identicon'
import { TCRViewProvider } from './tcr-view-context'
import useNetworkEnvVariable from '../hooks/network-env'
import { ReactComponent as Logo } from '../assets/images/logo.svg'
import { ReactComponent as MetamaskLogo } from '../assets/images/metamask.svg'
import { ReactComponent as FortmaticLogo } from '../assets/images/fortmatic.svg'
import { ReactComponent as PortisLogo } from '../assets/images/portis.svg'
import { ReactComponent as WalletConnectLogo } from '../assets/images/walletconnect.svg'
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
  height: 64px;
  justify-content: space-evenly;

  @media (max-width: 575px) {
    &.ant-col-xs-0 {
      display: none;
    }
  }
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

const StyledRouterLink = styled(Link)`
  color: #fff;
  display: flex;
`

const StyledWalletButton = styled(Button)`
  margin-right: 10px;
  margin-bottom: 10px;
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
  <Menu.Item key="tcrs-item">
    <NavLink to={`/tcr/${TCR2_ADDRESS}`}>TCRs</NavLink>
  </Menu.Item>,
  <Menu.Item key="factory-item">
    <NavLink to="/factory">Create a TCR</NavLink>
  </Menu.Item>
]

const {
  NetworkOnlyConnector,
  InjectedConnector,
  LedgerConnector,
  FortmaticConnector,
  PortisConnector,
  WalletConnectConnector
} = Connectors

const supportedNetworks = [42, 1]
const Injected = new InjectedConnector({ supportedNetworks })
const connectors = { Injected }
const defaultNetwork = Number(process.env.REACT_APP_DEFAULT_NETWORK) || 42
if (process.env.REACT_APP_INFURA_PROJECT_ID) {
  const supportedNetworkURLs = {
    1: `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`,
    42: `https://kovan.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`
  }

  const Infura = new NetworkOnlyConnector({
    providerURL: supportedNetworkURLs[defaultNetwork]
  })
  connectors.Infura = Infura

  const Ledger = new LedgerConnector({
    supportedNetworkURLs,
    defaultNetwork
  })
  connectors.Ledger = Ledger

  if (process.env.REACT_APP_WALLETCONNECT_BRIDGE_URL) {
    const WalletConnect = new WalletConnectConnector({
      api: WalletConnectApi,
      bridge: process.env.REACT_APP_WALLETCONNECT_BRIDGE_URL,
      supportedNetworkURLs,
      defaultNetwork
    })
    connectors.WalletConnect = WalletConnect
  }
}

const fortmaticApiKey = useNetworkEnvVariable('REACT_APP_FORMATIC_API_KEYS')
if (fortmaticApiKey) {
  const Fortmatic = new FortmaticConnector({
    api: FortmaticApi,
    apiKey: fortmaticApiKey,
    logoutOnDeactivation: false,
    testNetwork: defaultNetwork === 1 ? null : NETWORK_NAME[defaultNetwork]
  })
  connectors.Fortmatic = Fortmatic
}

if (process.env.REACT_APP_PORTIS_DAPP_ID) {
  const Portis = new PortisConnector({
    api: PortisApi,
    dAppId: process.env.REACT_APP_PORTIS_DAPP_ID,
    network: NETWORK_NAME[defaultNetwork]
  })
  connectors.Portis = Portis
}

const WalletModal = () => {
  const { cancelRequest, setUserSelectedWallet, requestModalOpen } = useContext(
    WalletContext
  )
  return (
    <Modal
      title="Connect a Wallet"
      visible={requestModalOpen}
      onCancel={cancelRequest}
      footer={[
        <Button key="back" onClick={cancelRequest}>
          Return
        </Button>
      ]}
    >
      <StyledWalletButton
        onClick={() => {
          if (window.ethereum && window.ethereum.isMetaMask) {
            window.ethereum.autoRefreshOnNetworkChange = true
            setUserSelectedWallet('Injected')
          } else {
            const tab = window.open(
              process.env.REACT_APP_METAMASK_SITE_URL,
              '_blank'
            )
            tab.focus()
          }
        }}
      >
        <Icon component={MetamaskLogo} />
        Metamask
      </StyledWalletButton>
      <StyledWalletButton
        onClick={() => {
          if (window.ethereum && window.ethereum.isTrust)
            setUserSelectedWallet('Injected')
          else {
            const tab = window.open(
              process.env.REACT_APP_TRUST_SITE_URL,
              '_blank'
            )
            tab.focus()
          }
        }}
      >
        <Icon component={TrustLogo} />
        Trust Wallet
      </StyledWalletButton>
      {process.env.REACT_APP_FORMATIC_API_KEYS && (
        <StyledWalletButton onClick={() => setUserSelectedWallet('Fortmatic')}>
          <Icon component={FortmaticLogo} />
          Fortmatic
        </StyledWalletButton>
      )}
      {process.env.REACT_APP_PORTIS_DAPP_ID && (
        <StyledWalletButton onClick={() => setUserSelectedWallet('Portis')}>
          <Icon component={PortisLogo} />
          Portis
        </StyledWalletButton>
      )}
      {process.env.REACT_APP_WALLETCONNECT_BRIDGE_URL && (
        <StyledWalletButton
          onClick={() => setUserSelectedWallet('WalletConnect')}
        >
          <Icon component={WalletConnectLogo} />
          WalletConnect
        </StyledWalletButton>
      )}
    </Modal>
  )
}

const TopBar = () => {
  const web3Context = useWeb3Context()
  const { requestWeb3Auth } = useContext(WalletContext)
  const TCR2_ADDRESS = useMainTCR2(web3Context)

  return (
    <Row>
      <StyledCol md={4} sm={20} xs={0}>
        <StyledRouterLink to="/">
          <Logo />
        </StyledRouterLink>
      </StyledCol>
      <Col md={15} xs={0}>
        <StyledMenu mode="horizontal" theme="dark">
          {MenuItems({ TCR2_ADDRESS })}
        </StyledMenu>
      </Col>
      <StyledCol md={5} sm={4} xs={24}>
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
      </StyledCol>
    </Row>
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
  const { active } = useWeb3Context()
  return (
    <Switch>
      {!active && <Route path="*" exact component={NoWeb3Detected} />}
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
                      <NavLink to={`/tcr/${TCR2_ADDRESS}`}>
                        <Logo style={{ marginTop: '20px' }} />
                      </NavLink>
                    </Menu.Item>
                  ].concat(MenuItems({ TCR2_ADDRESS }))}
                </Menu>
              </StyledLayoutSider>
              <Layout>
                <Layout.Header>
                  <TopBar />
                </Layout.Header>
                <Content />
                <StyledClickaway
                  isMenuClosed={isMenuClosed}
                  onClick={isMenuClosed ? null : () => setIsMenuClosed(true)}
                />
                <FooterWrapper>
                  <Footer appName="Kleros · GTCR" />
                </FooterWrapper>
              </Layout>
            </StyledLayout>
            <WalletModal />
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
