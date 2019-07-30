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
import { Helmet } from 'react-helmet'
import { ReactComponent as Logo } from '../assets/images/logo.svg'
import { ReactComponent as MetamaskLogo } from '../assets/images/metamask.svg'
import React, { useState, useContext } from 'react'
import loadable from '@loadable/component'
import { register } from './service-worker'
import styled from 'styled-components/macro'
import Web3Provider, { Connectors, useWeb3Context } from 'web3-react'
import { WalletContext, WalletProvider } from './wallet-context'
import { truncateETHAddress } from '../utils/string'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTelegram,
  faGithub,
  faTwitter
} from '@fortawesome/free-brands-svg-icons'
import { faBullhorn } from '@fortawesome/free-solid-svg-icons'
import networkNames from '../utils/network-names'
import NotFound from '../containers/not-found'

const StyledSpin = styled(Spin)`
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
`

const StyledLayoutContent = styled(Layout.Content)`
  background: white;
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

const SocialLink = styled.a`
  margin: 10px;
  color: white;
  :visited {
    color: white;
  }
`

const FirstSocialLink = styled(SocialLink)`
  margin-left: 0;
`

const LastSocialLink = styled(SocialLink)`
  margin-right: 0;
`

const KlerosLink = styled.a`
  color: white;
  :visited {
    color: white;
  }
`

const StyledRouterLink = styled(Link)`
  color: #fff;
  display: flex;
`

const Factory = loadable(
  () => import(/* webpackPrefetch: true */ '../containers/factory/index'),
  {
    fallback: (
      <StyledLayoutContent>
        <StyledSpin />
      </StyledLayoutContent>
    )
  }
)

const Items = loadable(
  () => import(/* webpackPrefetch: true */ '../containers/items/index'),
  {
    fallback: (
      <StyledLayoutContent>
        <StyledSpin />
      </StyledLayoutContent>
    )
  }
)

const MenuItems = ({ TCR2_ADDRESS }) => [
  <Menu.Item key="tcrs">
    <NavLink to={`/tcr/${TCR2_ADDRESS}`}>TCRs</NavLink>
  </Menu.Item>,
  <Menu.Item key="factory">
    <NavLink to="/factory">Factory</NavLink>
  </Menu.Item>
]

const { NetworkOnlyConnector, InjectedConnector } = Connectors
const Injected = new InjectedConnector({ supportedNetworks: [42, 1] })

const DEFAULT_NETWORK = process.env.REACT_APP_DEFAULT_NETWORK || 42
const Infura = new NetworkOnlyConnector({
  providerURL: `https://${networkNames[DEFAULT_NETWORK]}.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`
})
const connectors = { Injected, Infura }

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
      <Button onClick={() => setUserSelectedWallet('Injected')}>
        <Icon component={MetamaskLogo} />
        Metamask
      </Button>
    </Modal>
  )
}

const useTCR2Address = web3Context => {
  const { networkId } = web3Context
  let TCR2_ADDRESS = ''
  if (process.env.REACT_APP_TCR2_ADDRESSES)
    try {
      TCR2_ADDRESS = JSON.parse(process.env.REACT_APP_TCR2_ADDRESSES)[
        networkId || DEFAULT_NETWORK
      ]
    } catch (_) {
      console.error('Failed to parse env variable REACT_APP_TCR2_ADDRESSES')
    }
  return TCR2_ADDRESS
}

const TopBar = () => {
  const web3Context = useWeb3Context()
  const { requestWeb3Auth } = useContext(WalletContext)
  const TCR2_ADDRESS = useTCR2Address(web3Context)

  return (
    <Row>
      <StyledCol md={4} sm={16} xs={0}>
        <StyledRouterLink to="/">
          <Logo />
        </StyledRouterLink>
      </StyledCol>
      <Col md={16} sm={16} xs={0}>
        <StyledMenu mode="horizontal" theme="dark">
          {MenuItems({ TCR2_ADDRESS })}
        </StyledMenu>
      </Col>
      <StyledCol md={4} sm={16} xs={24}>
        <Button
          ghost
          shape="round"
          onClick={!web3Context.account ? () => requestWeb3Auth() : null}
        >
          {web3Context.active && web3Context.account
            ? truncateETHAddress(web3Context.account)
            : 'Connect'}
        </Button>
      </StyledCol>
    </Row>
  )
}

const Footer = () => (
  <Row justify="space-between" type="flex">
    <StyledCol>
      <KlerosLink href="https://kleros.io">
        Find out more about kleros
      </KlerosLink>
    </StyledCol>
    <StyledCol>
      <StyledRouterLink to="/">Kleros · GTCR</StyledRouterLink>
    </StyledCol>
    <StyledCol>
      <FirstSocialLink href="https://t.me/kleros">
        <FontAwesomeIcon size="lg" icon={faTelegram} />
      </FirstSocialLink>
      <SocialLink href="https://github.com/kleros">
        <FontAwesomeIcon size="lg" icon={faGithub} />
      </SocialLink>
      <SocialLink href="https://blog.kleros.io">
        <FontAwesomeIcon size="lg" icon={faBullhorn} />
      </SocialLink>
      <LastSocialLink href="https://twitter.com/kleros_io">
        <FontAwesomeIcon size="lg" icon={faTwitter} />
      </LastSocialLink>
    </StyledCol>
  </Row>
)

const Content = () => {
  const web3Context = useWeb3Context()
  const TCR2_ADDRESS = useTCR2Address(web3Context)

  return (
    <Switch>
      <Route path="/tcr/:tcrAddress?" component={Items} />
      <Route path="/factory" exact component={Factory} />
      <Redirect from="/" exact to={`/tcr/${TCR2_ADDRESS}`} />
      <Route path="*" exact component={NotFound} />
    </Switch>
  )
}

export default () => {
  const [isMenuClosed, setIsMenuClosed] = useState(true)
  return (
    <>
      <Helmet>
        <title>Kleros · GTCR</title>
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
                <Menu theme="dark">{MenuItems}</Menu>
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
                <Layout.Footer>
                  <Footer />
                </Layout.Footer>
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
