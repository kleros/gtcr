import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import { useWeb3Context } from 'hooks/use-web3-context'
import { CurateIcon } from 'components/curate/icons'
import { StatusDot } from 'components/curate/primitives'
import { reveal } from 'components/curate/motion/reveal'

/*
 * Shown when the connected account is a contract (not an EOA or an EIP-7702
 * delegated EOA): a quiet panel at the top of the frame, a warning dot, one
 * line and a link. Dismissing it is remembered per account.
 */

const EIP7702_PREFIX = '0xef0100'
const STORAGE_KEY = '@kleros/curate/alert/smart-contract-wallet-warning'

const Slot = styled.div`
  width: 100%;
  max-width: var(--page-max-width);
  margin: 12px auto 0;
  padding: 0 var(--horizontal-padding);
`

const Panel = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 8px 8px 8px 16px;
  border: 1px solid
    color-mix(in srgb, var(--status-contested) 24%, var(--glass-border));
  border-radius: var(--radius);
  background: color-mix(
    in srgb,
    var(--status-contested) 6%,
    var(--color-surface)
  );
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  ${reveal}

  @media (max-width: 600px) {
    align-items: flex-start;
    padding-top: 12px;
    padding-bottom: 12px;

    > span:first-child {
      margin-top: 6px;
    }
  }
`

const Copy = styled.p`
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  strong {
    margin-right: 6px;
    color: var(--color-text);
    font-weight: 500;
  }

  a {
    margin-left: 6px;
    color: var(--color-primary);
    font-weight: 500;
    white-space: nowrap;
  }
`

const Close = styled.button`
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-faint);
  cursor: pointer;
  transition:
    background var(--motion),
    color var(--motion);

  &:hover {
    background: var(--color-raised);
    color: var(--color-text);
  }
`

export default function SmartContractWalletWarning() {
  const { account, library } = useWeb3Context()
  const [isSmartContractWallet, setIsSmartContractWallet] =
    useState<boolean>(false)
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
    (account: string, library: EthersLibrary) => {
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
    [],
  )

  const handleClose = useCallback(() => {
    setShowWarning(false)
    try {
      localStorage.setItem(`${STORAGE_KEY}:${account}`, JSON.stringify(false))
    } catch {
      // Storage can be blocked; the panel stays closed for this visit.
    }
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
    <Slot>
      <Panel role="status">
        <StatusDot $tone="contested" aria-hidden />
        <Copy>
          <strong>Smart contract wallet detected.</strong>
          Some Curate actions may fail from a contract wallet; use an externally
          owned account.
          <a
            href="https://docs.kleros.io/welcome/faq#can-i-use-a-smart-contract-account-to-stake-in-the-court"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more
          </a>
        </Copy>
        <Close
          type="button"
          onClick={handleClose}
          aria-label="Dismiss the smart contract wallet notice"
        >
          <CurateIcon name="close" size={14} />
        </Close>
      </Panel>
    </Slot>
  )
}
