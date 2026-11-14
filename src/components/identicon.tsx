import React, { useEffect, useState } from 'react'
import { Popover } from 'components/ui'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useDisconnect } from 'wagmi'
import ReactBlockies from 'react-blockies'
import styled from 'styled-components'
import { BigNumber } from 'ethers'
import useNativeCurrency from 'hooks/native-currency'
import { Label, Stack } from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import ETHAddress from './eth-address'
import TokenAmount from './token-amount'

/*
 * Account avatar and menu. The blockies avatar sits in a hairline ring (a
 * rounded tile at the large size). The menu leads with the balance as its
 * figure, then the address with copy and explorer, and a quiet disconnect.
 * The email form went with the legacy notification service, which is gone,
 * and Atlas has no Curate email notifications.
 */

const AvatarFrame = styled.span<{ $large?: boolean }>`
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  width: ${({ $large }) => ($large ? '98px' : '32px')};
  height: ${({ $large }) => ($large ? '98px' : '32px')};
  overflow: hidden;
  border-radius: ${({ $large }) =>
    $large ? 'var(--radius-lg)' : 'var(--radius-pill)'};

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow:
      inset 0 0 0 1px var(--glass-border),
      inset 0 1px 0 var(--glass-highlight);
    pointer-events: none;
  }

  canvas {
    display: block;
  }
`

const AvatarButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  cursor: pointer;
  transition:
    box-shadow var(--motion),
    transform var(--motion);

  &:hover,
  &[aria-expanded='true'] {
    box-shadow: 0 0 0 3px var(--color-primary-soft);
  }
`

const Menu = styled.div`
  margin: -12px -14px;
  min-width: 280px;
`

const MenuSection = styled(Stack)`
  padding: 14px 16px;

  &:not(:last-child) {
    box-shadow: inset 0 -1px 0 var(--glass-border);
  }
`

const Balance = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 28px;
  line-height: 32px;
  font-weight: 500;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
`

/** The currency after the figure: half its size, quiet, on its baseline. */
const BalanceUnit = styled.span`
  margin-left: 0.2em;
  color: var(--color-muted);
  font-size: 0.5em;
  font-weight: 400;
  letter-spacing: 0;
`

const Disconnect = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 38px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: transparent;
  color: var(--status-off);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
  cursor: pointer;
  transition:
    background var(--motion),
    border-color var(--motion);

  &:hover {
    border-color: color-mix(in srgb, var(--status-off) 40%, transparent);
    background: var(--status-off-soft);
  }
`

interface IdenticonProps {
  className?: string
  large?: boolean
}

const Identicon = ({ className, large }: IdenticonProps) => {
  const { account, library } = useWeb3Context()
  const { disconnect } = useDisconnect()
  const nativeCurrency = useNativeCurrency()

  const [menuOpen, setMenuOpen] = useState(false)
  const [balance, setBalance] = useState<BigNumber>()
  useEffect(() => {
    if (!library || !account) return
    let live = true
    void (async () => {
      try {
        const next = await library.getBalance(account)
        if (live) setBalance(next)
      } catch {
        // The menu simply shows no balance if the node does not answer.
      }
    })()
    return () => {
      live = false
    }
  }, [library, account])

  if (!account) return null

  const avatar = (
    <AvatarFrame
      className={className}
      $large={large}
      id="react-blockies-identicon"
      aria-hidden="true"
    >
      <ReactBlockies
        scale={large ? 7 : 4}
        seed={account.toLowerCase()}
        size={large ? 14 : 8}
      />
    </AvatarFrame>
  )

  if (large) return avatar

  return (
    <Popover
      content={
        <Menu>
          <MenuSection $gap={6}>
            <Label $tone="faint">Balance</Label>
            <Balance>
              {/* Rounded to 4 decimals: wei would print up to 18. */}
              <TokenAmount amount={balance} precision={4} />
              {balance && <BalanceUnit>{nativeCurrency}</BalanceUnit>}
            </Balance>
            <ETHAddress address={account} />
          </MenuSection>
          <MenuSection>
            <Disconnect type="button" onClick={() => disconnect()}>
              <CurateIcon name="wallet" size={15} />
              Disconnect
            </Disconnect>
          </MenuSection>
        </Menu>
      }
      placement="bottomRight"
      trigger="click"
      visible={menuOpen}
      onVisibleChange={setMenuOpen}
    >
      <AvatarButton
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {avatar}
      </AvatarButton>
    </Popover>
  )
}

export default Identicon
