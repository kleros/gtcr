import React from 'react'
import styled from 'styled-components'
import { Modal, Button, Icon } from 'antd'

const StyledModal = styled(Modal)`
  & > .ant-modal-content {
    border-radius: 12px;
    box-shadow: 0px 6px 36px ${({ theme }) => theme.shadowColor};
    background: ${({ theme }) => theme.componentBackground};

    & > .ant-modal-body {
      padding: 24px;
    }

    & > .ant-modal-close {
      color: ${({ theme }) => theme.primaryColor};
    }
  }
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`

const WarningIcon = styled(Icon)`
  font-size: 24px;
  color: ${({ theme }) => theme.warningColor};
`

const Title = styled.h3`
  color: ${({ theme }) => theme.textPrimary};
  font-size: 18px;
  font-weight: 600;
  margin: 0;
`

const Message = styled.p`
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 16px 0;
`

const UrlContainer = styled.div`
  background-color: ${({ theme }) => theme.elevatedBackground};
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 8px;
  padding: 12px;
  margin: 16px 0;
  word-break: break-all;
`

const Url = styled.code`
  color: ${({ theme }) => theme.primaryColor};
  font-size: 13px;
  font-family: monospace;
`

const SafetyTips = styled.div`
  color: ${({ theme }) => theme.textPrimary};
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 8px;

  strong {
    display: block;
    margin-bottom: 8px;
  }

  ul {
    margin: 0;
    padding-left: 20px;
  }
`

const ButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
`

const CancelButton = styled(Button)`
  background-color: transparent !important;
  border-color: ${({ theme }) => theme.borderColor} !important;
  color: ${({ theme }) => theme.textPrimary} !important;

  &:hover,
  &:focus {
    background-color: transparent !important;
    border-color: ${({ theme }) => theme.primaryColor} !important;
    color: ${({ theme }) => theme.primaryColor} !important;
  }
`

const ConfirmButton = styled(Button)`
  background-color: #009aff !important;
  border-color: #009aff !important;
  color: #1a1a2e !important;

  &:hover,
  &:focus {
    background-color: #33b1ff !important;
    border-color: #33b1ff !important;
    color: #1a1a2e !important;
  }
`

const ExternalLinkWarning = ({ visible, url, onConfirm, onCancel }) => (
  <StyledModal
    visible={visible}
    footer={null}
    onCancel={onCancel}
    width={480}
    centered
  >
    <Header>
      <WarningIcon type="warning" />
      <Title>External Link Warning</Title>
    </Header>

    <Message>
      You are about to navigate to an external website. Please verify this is a
      trusted destination before proceeding.
    </Message>

    <UrlContainer>
      <Url>{url}</Url>
    </UrlContainer>

    <SafetyTips>
      <strong>Safety Tips:</strong>
      <ul>
        <li>Verify the domain matches your expected destination</li>
        <li>Check for suspicious characters or misspellings</li>
        <li>Only proceed if you trust this website</li>
      </ul>
    </SafetyTips>

    <ButtonContainer>
      <CancelButton onClick={onCancel}>Cancel</CancelButton>
      <ConfirmButton type="primary" onClick={onConfirm}>
        Continue to External Site
      </ConfirmButton>
    </ButtonContainer>
  </StyledModal>
)

export default ExternalLinkWarning
