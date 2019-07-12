import 'antd/dist/antd.css'
import './theme.css'
import { BrowserRouter, Route, Switch } from 'react-router-dom'
import { Col, Layout, Menu, Row, Spin, message } from 'antd'
import { Helmet } from 'react-helmet'
import { ReactComponent as Logo } from '../assets/images/logo.svg'
import React, { useState } from 'react'
import loadable from '@loadable/component'
import { register } from './service-worker'
import styled from 'styled-components/macro'

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
  opacity: ${props => props.isMenuClosed ? 0 : 0.4};
  transition: opacity 0.3s;
  pointer-events: ${props => props.isMenuClosed ? 'none' : 'auto'};
`

export default () => {
  const [isMenuClosed, setIsMenuClosed] = useState(true)
  return (
    <>
      <Helmet>
        <title>Kleros · GTCR</title>
        <link
          href='https://fonts.googleapis.com/css?family=Roboto:400,400i,500,500i,700,700i'
          rel='stylesheet'
        />
      </Helmet>
      <BrowserRouter>
        <Layout>
          <StyledLayoutSider
            breakpoint='md'
            collapsedWidth={0}
            collapsed={isMenuClosed}
            onClick={() => setIsMenuClosed(prevState => !prevState)}
          >
            <Menu theme='dark'>{MenuItems}</Menu>
          </StyledLayoutSider>
          <Layout>
            <Layout.Header>
              <Row>
                <StyledCol md={4} sm={16} xs={0}>
                  <StyledLink href='https://kleros.io'>
                    <Logo />
                  </StyledLink>
                </StyledCol>
                <Col md={16} sm={16} xs={0}>
                  <StyledMenu mode='horizontal' theme='dark'>
                    {MenuItems}
                  </StyledMenu>
                </Col>
                <StyledCol md={4} sm={16} xs={0} />
              </Row>
            </Layout.Header>
            <StyledLayoutContent>
              <Switch>
                <Route component={Factory} exact path='/' />
              </Switch>
            </StyledLayoutContent>
            <StyledClickaway isMenuClosed={isMenuClosed} onClick={isMenuClosed ? null : () => setIsMenuClosed(true)} />
          </Layout>
        </Layout>
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
