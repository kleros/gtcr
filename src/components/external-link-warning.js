import React from 'react'
import styled from 'styled-components'
import { Modal, Button, Icon } from 'antd'

const StyledModal = styled(Modal)`
  & > .ant-modal-content {
    border-radius: 12px;
    box-shadow: 0px 6px 36px #bc9cff;

    & > .ant-modal-body {
      padding: 24px;
    }

    & > .ant-modal-close {
      color: #6826bf;
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
  color: #faad14;
`

const Title = styled.h3`
  color: #4d00b4;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
`

const Message = styled.p`
  color: #4d00b4;
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 16px 0;
`

const UrlContainer = styled.div`
  background-color: #f2e3ff;
  border: 1px solid #bc9cff;
  border-radius: 8px;
  padding: 12px;
  margin: 16px 0;
  word-break: break-all;
`

const Url = styled.code`
  color: #6826bf;
  font-size: 13px;
  font-family: monospace;
`

const SafetyTips = styled.div`
  color: #4d00b4;
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
  border-color: #bc9cff !important;
  color: #4d00b4 !important;

  &:hover,
  &:focus {
    background-color: transparent !important;
    border-color: #6826bf !important;
    color: #6826bf !important;
  }
`

const ConfirmButton = styled(Button)`
  background-color: #4d00b4 !important;
  border-color: #4d00b4 !important;
  color: white !important;

  &:hover,
  &:focus {
    background-color: #6826bf !important;
    border-color: #6826bf !important;
    color: white !important;
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
      <ConfirmButton onClick={onConfirm}>
        Continue to External Site
      </ConfirmButton>
    </ButtonContainer>
  </StyledModal>
)

export default ExternalLinkWarning
