import React from 'react'
import styled from 'styled-components'
import { Tooltip } from 'components/ui'
import Icon from 'components/ui/Icon'
import { parseRichAddress } from '../utils/rich-address'
import { shortenAddress } from '../utils/string'

const StyledSpan = styled.span`
  color: ${({ theme }) => theme.errorColor};
`

const NotValidAddressAnchor = styled.a`
  color: ${({ theme }) => theme.warningColor};
  text-decoration: underline;
`

const ValidAddressAnchor = styled.a`
  text-decoration: underline;
`

const RichAddress: React.FC<{ crude: string }> = ({ crude }) => {
  const richAddress = parseRichAddress(crude)
  if (richAddress === null) {
    console.log('Address has wrong format or unknown prepend', crude)
    const errorMessage = `Unknown address "${crude}"`
    return <StyledSpan>{errorMessage}</StyledSpan>
  }
  const { address, reference, link, passedTest } = richAddress
  const labelText = `${reference.label}: `
  if (!passedTest)
    return (
      <Tooltip title="Address is invalid">
        <Icon type="warning" theme="filled" style={{ color: 'inherit' }} />
        &nbsp;
        <NotValidAddressAnchor href={link} rel="noreferrer" target="_blank">
          {labelText}
          {shortenAddress(address)}
        </NotValidAddressAnchor>
      </Tooltip>
    )

  return (
    <ValidAddressAnchor href={link} rel="noreferrer" target="_blank">
      {labelText}
      {shortenAddress(address)}
    </ValidAddressAnchor>
  )
}

export default RichAddress
