import React, { useCallback, useContext, useMemo, useState } from 'react'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { Link } from 'react-router-dom'
import { Col, Menu, Row, Button, Badge, Switch } from 'antd'
import PropTypes from 'prop-types'
import { WalletContext } from './wallet-context'
import { TourContext } from './tour-context'
import { NETWORK_NAME, NETWORK_COLOR, NETWORK } from '../utils/network-utils'
import useMainTCR2 from '../hooks/tcr2'
import Identicon from '../components/identicon'
import Notifications from '../components/notifications'
import { ReactComponent as Logo } from '../assets/images/logo.svg'
import { capitalizeFirstLetter, SAVED_NETWORK_KEY } from '../utils/string'
import AppTour from '../components/tour'
import { useHistory } from 'react-router-dom/cjs/react-router-dom.min'
import useNetworkEnvVariable from '../hooks/network-env'

const StyledCol = styled(Col)`
  align-items: center;
  display: flex;
  justify-content: center;
  height: 67px;

  @media (max-width: 992px) {
    width: 100%;
  }
`

const StyledCenter = styled(StyledCol)`
  @media (max-width: 992px) {
    &.ant-col-xs-0 {
      display: none;
    }
  }
`

const StyledColStart = styled(StyledCol)`
  justify-content: flex-start;

  @media (max-width: 992px) {
    &.ant-col-xs-0 {
      display: none;
    }
  }
`

const StyledColEnd = styled(StyledCol)`
  justify-content: flex-end;

  @media (max-width: 992px) {
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
  margin-left: 8px;
`

const StyledTopBarRow = styled(Row)`
  padding: 0 9.375vw;
`

const NOTIFICATIONS_TOUR_DISMISSED = 'NOTIFICATIONS_TOUR_DISMISSED'
const notificationsTourSteps = [
  {
    content: () => (
      <div>
        Congratulations!
        <span role="img" aria-label="celebrate">
          🎉
        </span>
        <br />
        <br />
        We highly suggest you subscribe for notifications if you haven't done so
        already, this way you can learn about updates as soon as possible.
      </div>
    )
  },
  {
    selector: '#react-blockies-identicon',
    content: 'You can do so by clicking here and setting your email.'
  }
]

const TopBar = ({ menuItems }) => {
  const web3Context = useWeb3Context()
  const { requestWeb3Auth } = useContext(WalletContext)
  const TCR2_ADDRESS = useMainTCR2(web3Context)
  const { userSubscribed } = useContext(TourContext)
  const history = useHistory()
  const { networkId, account } = web3Context
  const [requestedChain, setRequestedChain] = useState()
  const nextNetworkTCR = useNetworkEnvVariable(
    'REACT_APP_DEFAULT_TCR_ADDRESSES',
    networkId === NETWORK.XDAI ? NETWORK.MAINNET : NETWORK.XDAI
  )
  const currentChainId = useMemo(() => requestedChain ?? networkId, [
    networkId,
    requestedChain
  ])

  const switchChain = useCallback(() => {
    // Give a little time for the animation to play.
    let nextNetwork = NETWORK.XDAI
    if (networkId === NETWORK.XDAI) nextNetwork = NETWORK.MAINNET
    else nextNetwork = NETWORK.XDAI

    setRequestedChain(nextNetwork)
    localStorage.setItem(SAVED_NETWORK_KEY, nextNetwork)
    setTimeout(() => {
      history.push(`/tcr/${nextNetworkTCR}`)
      window.location.reload()
    }, 500)
  }, [history, networkId, nextNetworkTCR])

  return (
    <>
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
          {web3Context.active &&
            web3Context.networkId &&
            (account ? (
              <StyledNetworkStatus>
                <Badge color={NETWORK_COLOR[web3Context.networkId]} />
                {capitalizeFirstLetter(NETWORK_NAME[web3Context.networkId])}
              </StyledNetworkStatus>
            ) : (
              <Switch
                checkedChildren="xDai"
                unCheckedChildren="Mainnet"
                checked={currentChainId === NETWORK.XDAI}
                onClick={switchChain}
              />
            ))}
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
      {userSubscribed && (
        <AppTour
          dismissedKey={NOTIFICATIONS_TOUR_DISMISSED}
          steps={notificationsTourSteps}
        />
      )}
    </>
  )
}

TopBar.propTypes = {
  menuItems: PropTypes.func.isRequired
}

export default TopBar
