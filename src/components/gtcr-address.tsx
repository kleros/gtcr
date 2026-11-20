import React from 'react'
import styled, { css } from 'styled-components'
import { Link } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import { CurateIcon } from 'components/curate/icons'
import { ZERO_ADDRESS } from '../utils/string'
import ETHAddress from './eth-address'

/*
 * A registry address (a "list of lists" entry): the contract address with
 * explorer and copy, and a ghost pill that opens the list in Curate.
 */

const Wrap = styled.span`
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  min-width: 0;
  max-width: 100%;
  pointer-events: auto;
`

const pill = css`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  white-space: nowrap;
  text-decoration: none;
  pointer-events: auto;
  transition:
    border-color var(--motion),
    background var(--motion),
    transform var(--motion);

  svg {
    color: var(--color-faint);
    transform: rotate(-90deg);
    transition:
      color var(--motion),
      transform 240ms var(--ease-out);
  }
`

const OpenList = styled(Link)`
  ${pill}

  &&:hover {
    color: var(--color-text);
    border-color: var(--color-border-strong);
    background: var(--color-raised);
    transform: translateY(-1px);
  }

  &:hover svg {
    color: var(--color-text);
    transform: rotate(-90deg) translateY(2px);
  }
`

const OpenListDisabled = styled.button`
  ${pill}
  color: var(--color-faint);
  cursor: not-allowed;
  opacity: 0.6;
`

interface GTCRAddressProps {
  address: string
  disabled?: boolean
}

const GTCRAddress = ({ address, disabled }: GTCRAddressProps) => {
  const chainId = useUrlChainId()

  // this avoids crashes when it looks for the address "Error decoding GTCR address"
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null

  return (
    <Wrap>
      <ETHAddress address={address || ZERO_ADDRESS} />
      {disabled ? (
        <OpenListDisabled type="button" disabled>
          Open list
          <CurateIcon name="chevron-down" size={13} />
        </OpenListDisabled>
      ) : (
        <OpenList to={`/tcr/${chainId}/${address}`}>
          Open list
          <CurateIcon name="chevron-down" size={13} />
        </OpenList>
      )}
    </Wrap>
  )
}

export default GTCRAddress
