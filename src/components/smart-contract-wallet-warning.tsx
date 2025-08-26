import React, { useEffect, useState } from 'react'
import { Alert } from 'antd'
import styled from 'styled-components'
import { useWeb3Context } from 'web3-react'

const StyledAlert = styled(Alert)`
  text-align: center;

  .ant-alert-message {
    font-weight: bold;
  }
`

const StyledP = styled.p`
  margin: 0;
`

const storageKey = '@kleros/curate/alert/smart-contract-wallet-warning'

export default function SmartContractWalletWarning() {
  const { account, library } = useWeb3Context()
  const [isSmartContractWallet, setIsSmartContractWallet] = useState(false)
  const [showWarning, setShowWarning] = useState(() => {
    try {
      const storedValue = localStorage.getItem(storageKey)
      if (storedValue === null) return true
      return JSON.parse(storedValue)
    } catch {
      return true
    }
  })

  useEffect(() => {
    if (!account || !library) return

    library.provider
      .send('eth_getCode', [account, 'latest'])
      .then((res: { result: string }) => {
        setIsSmartContractWallet(res.result !== '0x')
      })
      .catch((err: Error) => {
        console.error('Error checking smart contract wallet', err)
        setIsSmartContractWallet(false)
      })
  }, [account, library])

  if (!showWarning || !isSmartContractWallet) {
    return null
  }

  const handleClose = () => {
    setShowWarning(false)
    localStorage.setItem(storageKey, JSON.stringify(false))
  }

  return (
    <StyledAlert
      message="Warning"
      description={
        <StyledP>
          You are using a smart contract wallet. This is not recommended.{' '}
          <a
            href="https://docs.kleros.io/kleros-faq#can-i-use-a-smart-contract-account-to-stake-in-the-court"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more.
          </a>
        </StyledP>
      }
      type="warning"
      banner
      closable
      onClose={handleClose}
    />
  )
}
