import React, { useCallback, useEffect, useState } from 'react'
import { Alert } from 'components/ui'
import styled from 'styled-components'
import { useWeb3Context } from 'hooks/useWeb3Context'

const StyledAlert = styled(Alert)`
  text-align: center;

  .ui-alert-message {
    font-weight: bold;
  }
`

const StyledP = styled.p`
  margin: 0;
`

const EIP7702_PREFIX = '0xef0100'
const STORAGE_KEY = '@kleros/curate/alert/smart-contract-wallet-warning'

export default function SmartContractWalletWarning() {
  const { account, library } = useWeb3Context()
  const [isSmartContractWallet, setIsSmartContractWallet] = useState<boolean>(
    false
  )
  const [showWarning, setShowWarning] = useState<boolean>(true)

  const updateAccountWarningDismissalState = useCallback((account: string) => {
    try {
      const storedValue = localStorage.getItem(`${STORAGE_KEY}:${account}`)
      if (storedValue === null) setShowWarning(true)
      else setShowWarning(JSON.parse(storedValue))
    } catch {
      setShowWarning(true)
    }
  }, [])

  const checkIfSmartContractWallet = useCallback(
    (account: string, library: any) => {
      library
        .getCode(account)
        .then((code: string) => {
          const formattedCode = code.toLowerCase()
          const isEip7702Eoa = formattedCode.startsWith(EIP7702_PREFIX)

          // Do not show warning for EIP-7702 EOAs
          setIsSmartContractWallet(formattedCode !== '0x' && !isEip7702Eoa)
          return null
        })
        .catch((err: Error) => {
          console.error('Error checking smart contract wallet', err)
          setIsSmartContractWallet(false)
        })
    },
    []
  )

  const handleClose = useCallback(() => {
    setShowWarning(false)
    localStorage.setItem(`${STORAGE_KEY}:${account}`, JSON.stringify(false))
  }, [account])

  useEffect(() => {
    if (!account || !library) {
      setIsSmartContractWallet(false)
      return
    }

    updateAccountWarningDismissalState(account)
    checkIfSmartContractWallet(account, library)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, library])

  if (!showWarning || !isSmartContractWallet) return null

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
