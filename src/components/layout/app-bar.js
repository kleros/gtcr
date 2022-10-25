import React, { useCallback, useContext, useMemo, useState } from 'react'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { Link } from 'react-router-dom'
import { Col, Row, Button, Badge, Switch } from 'antd'
import { WalletContext } from 'contexts/wallet-context'
import { TourContext } from 'contexts/tour-context'
import { NETWORKS, NETWORKS_INFO } from '../../config/networks'
import Identicon from 'components/identicon'
import Notifications from 'components/notifications'
import { ReactComponent as Logo } from 'assets/images/logo.svg'
import { capitalizeFirstLetter, SAVED_NETWORK_KEY } from 'utils/string'
import AppTour from 'components/tour'
import { useHistory } from 'react-router-dom/cjs/react-router-dom.min'
import getNetworkEnv from 'utils/network-env'
import AppMenu from 'components/layout/app-menu'

const StyledCol = styled(Col)`
  align-items: center !important;
  display: flex !important;
  justify-content: center;
  height: 67px !important;

  @media (max-width: 992px) {
    width: 100% !important;
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

const StyledAppBarRow = styled(Row)`
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

const AppBar = () => {
  const web3Context = useWeb3Context()
  const { requestWeb3Auth } = useContext(WalletContext)
  const { userSubscribed } = useContext(TourContext)
  const history = useHistory()
  const { networkId, account } = web3Context
  const [requestedChain, setRequestedChain] = useState()
  const nextNetworkTCR = getNetworkEnv(
    'REACT_APP_DEFAULT_TCR_ADDRESSES',
    networkId === NETWORKS.xDai ? NETWORKS.ethereum : NETWORKS.xDai
  )
  const currentChainId = useMemo(() => requestedChain ?? networkId, [
    networkId,
    requestedChain
  ])

  const switchChain = useCallback(() => {
    let nextNetwork = NETWORKS.xDai
    if (networkId === NETWORKS.xDai) nextNetwork = NETWORKS.ethereum
    else nextNetwork = NETWORKS.xDai

    setRequestedChain(nextNetwork)
    localStorage.setItem(SAVED_NETWORK_KEY, nextNetwork)
    setTimeout(() => {
      history.push(`/tcr/${nextNetwork}/${nextNetworkTCR}`)
      window.location.reload()
    }, 300)
  }, [history, networkId, nextNetworkTCR])

  return (
    <>
      <StyledAppBarRow type="flex" justify="space-between">
        <StyledColStart md={6} sm={12} xs={0}>
          <StyledRouterLink to="/">
            <Logo style={{ maxHeight: '50px', maxWidth: '100px' }} />
          </StyledRouterLink>
        </StyledColStart>
        <StyledCenter md={8} sm={0} xs={0}>
          <AppMenu mode="horizontal" />
        </StyledCenter>
        <StyledColEnd md={7} sm={12} xs={24}>
          {web3Context.active &&
            web3Context.networkId &&
            (account ? (
              <StyledNetworkStatus>
                <Badge color={NETWORKS_INFO[web3Context.networkId].color} />
                {capitalizeFirstLetter(
                  NETWORKS_INFO[web3Context.networkId].name
                )}
              </StyledNetworkStatus>
            ) : (
              <Switch
                checkedChildren="xDai"
                unCheckedChildren="Mainnet"
                checked={currentChainId === NETWORKS.xDai}
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
      </StyledAppBarRow>
      {userSubscribed && (
        <AppTour
          dismissedKey={NOTIFICATIONS_TOUR_DISMISSED}
          steps={notificationsTourSteps}
        />
      )}
    </>
  )
}

export default AppBar
