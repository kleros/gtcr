import React, { useContext } from 'react'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { Link } from 'react-router-dom'
import { Col, Menu, Row, Button, Badge } from 'antd'
import PropTypes from 'prop-types'
import { WalletContext } from './wallet-context'
import { NETWORK_NAME, NETWORK_COLOR } from '../utils/network-utils'
import useMainTCR2 from '../hooks/tcr2'
import Identicon from '../components/identicon'
import Notifications from '../components/notifications'
import { ReactComponent as Logo } from '../assets/images/logo.svg'
import { capitalizeFirstLetter } from '../utils/string'

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

const StyledTopBarRow = styled(Row)`
  padding: 0 9.375vw;
`

const TopBar = ({ menuItems }) => {
  const web3Context = useWeb3Context()
  const { requestWeb3Auth } = useContext(WalletContext)
  const TCR2_ADDRESS = useMainTCR2(web3Context)

  return (
    <StyledTopBarRow type="flex" justify="space-between">
      <StyledColStart md={6} sm={12} xs={0}>
        <StyledRouterLink to={`/tcr/${TCR2_ADDRESS}`}>
          <Logo style={{ maxHeight: '50px', maxWidth: '100px' }} />
        </StyledRouterLink>
      </StyledColStart>
      <StyledCenter md={8} sm={0} xs={0}>
        <StyledMenu mode="horizontal" theme="dark">
          {menuItems({ TCR2_ADDRESS })}
        </StyledMenu>
      </StyledCenter>
      <StyledColEnd md={7} sm={12} xs={24}>
        {web3Context.active && web3Context.networkId && (
          <StyledNetworkStatus>
            <Badge color={NETWORK_COLOR[web3Context.networkId]} />
            {capitalizeFirstLetter(NETWORK_NAME[web3Context.networkId])}
          </StyledNetworkStatus>
        )}
        {process.env.REACT_APP_NOTIFICATIONS_API_URL &&
          web3Context.account &&
          web3Context.networkId && <Notifications />}
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

TopBar.propTypes = {
  menuItems: PropTypes.func.isRequired
}

export default TopBar
