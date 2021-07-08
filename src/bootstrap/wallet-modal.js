import React, { useContext } from 'react'
import PropTypes from 'prop-types'
import { Button, Modal, Icon } from 'antd'
import styled from 'styled-components/macro'
import { ReactComponent as TrustLogo } from '../assets/images/trust.svg'
import { WalletContext } from './wallet-context'
import FrameLogo from '../assets/images/frame.png'
import { ReactComponent as MetamaskLogo } from '../assets/images/metamask.svg'
import { ReactComponent as FortmaticLogo } from '../assets/images/fortmatic.svg'
import { ReactComponent as WalletConnectLogo } from '../assets/images/walletconnect.svg'

const StyledWalletButton = styled(Button)`
  margin-right: 10px;
  margin-bottom: 10px;
`

const StyledModal = styled(Modal)`
  & > .ant-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

const StyledWalletLogo = styled.img`
  width: 15px;
  height: 20px;
  object-fit: contain;
  margin: 0 8px 0 0;
`

const WalletModal = ({ connectors }) => {
  const { cancelRequest, setUserSelectedWallet, requestModalOpen } = useContext(
    WalletContext
  )
  return (
    <StyledModal
      title="Connect a Wallet"
      visible={requestModalOpen}
      onCancel={cancelRequest}
      footer={[
        <Button key="back" onClick={cancelRequest}>
          Back
        </Button>
      ]}
    >
      <StyledWalletButton
        onClick={() => {
          if (window.ethereum && window.ethereum.isFrame)
            setUserSelectedWallet('Injected')
          else {
            const tab = window.open(
              process.env.REACT_APP_FRAME_SITE_URL,
              '_blank'
            )
            tab.focus()
          }
        }}
      >
        <StyledWalletLogo src={FrameLogo} />
        Frame
      </StyledWalletButton>
      <StyledWalletButton
        onClick={() => {
          if (window.ethereum && window.ethereum.isMetaMask)
            setUserSelectedWallet('Injected')
          else {
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
      {connectors.Fortmatic && ( // eslint-disable-line
        <StyledWalletButton onClick={() => setUserSelectedWallet('Fortmatic')}>
          <Icon component={FortmaticLogo} />
          Fortmatic
        </StyledWalletButton>
      )}
      {connectors.WalletConnect && ( // eslint-disable-line
        <StyledWalletButton
          onClick={() => setUserSelectedWallet('WalletConnect')}
        >
          <Icon component={WalletConnectLogo} />
          WalletConnect
        </StyledWalletButton>
      )}
    </StyledModal>
  )
}

WalletModal.propTypes = {
  connectors: PropTypes.shape({})
}

WalletModal.defaultProps = {
  connectors: {}
}

export default WalletModal
