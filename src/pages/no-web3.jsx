import React, { useContext } from 'react'
import styled from 'styled-components/macro'
import { WalletContext } from 'contexts/wallet-context'
import ErrorPage from './error-page'

const StyledSpan = styled.span`
  text-decoration: underline;
  cursor: pointer;
`

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

export default NoWeb3Detected
