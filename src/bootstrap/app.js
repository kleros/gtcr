import 'antd/dist/antd.css'
import './theme.css'
import { BrowserRouter, Route, Switch, Link } from 'react-router-dom'
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

const StyledSpin = styled(Spin)`
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
`

const Factory = loadable(
  () => import(/* webpackPrefetch: true */ '../containers/factory/index'),
  {
    fallback: <StyledSpin />
  }
)
const MenuItems = []

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
const StyledLayoutContent = styled(Layout.Content)`
  background: white;
  padding: 42px 9.375vw 42px;
`

const StyledLink = styled.a`
  display: flex;
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
`

const { NetworkOnlyConnector, InjectedConnector } = Connectors
const Injected = new InjectedConnector({ supportedNetworks: [42, 1] })
const Infura = new NetworkOnlyConnector({
  providerURL: `https://kovan.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`
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

const TopBar = () => {
  const web3Context = useWeb3Context()
  const { requestWeb3Auth } = useContext(WalletContext)
  return (
    <Row>
      <StyledCol md={4} sm={16} xs={0}>
        <StyledLink href="https://kleros.io">
          <Logo />
        </StyledLink>
      </StyledCol>
      <Col md={16} sm={16} xs={0}>
        <StyledMenu mode="horizontal" theme="dark">
          {MenuItems}
        </StyledMenu>
      </Col>
      <StyledCol md={4} sm={16} xs={0}>
        <Button
          ghost
          shape="round"
          onClick={!web3Context.active ? () => requestWeb3Auth() : null}
        >
          {web3Context.active
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
                <StyledLayoutContent>
                  <Switch>
                    <Route component={Factory} exact path="/" />
                  </Switch>
                </StyledLayoutContent>
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
    message.warning(
      'An update is ready to be installed. Please close and reopen all tabs.',
      0
    )
})
