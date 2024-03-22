import React from 'react'
import styled from 'styled-components'
import { Icon, Tooltip } from 'antd'
import { parseRichAddress } from '../utils/rich-address'

const StyledSpan = styled.span`
  color: red;
`

const NotValidAddressAnchor = styled.a`
  color: #787800;
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
        <Icon type="warning" theme="filled" style={{ color: '#787800' }} />
        &nbsp;
        <NotValidAddressAnchor href={link} rel="noreferrer" target="_blank">
          {labelText}
          {address.slice(0, 6)}...{address.slice(address.length - 4)}
        </NotValidAddressAnchor>
      </Tooltip>
    )

  return (
    <ValidAddressAnchor href={link} rel="noreferrer" target="_blank">
      {labelText}
      {address.slice(0, 6)}...{address.slice(address.length - 4)}
    </ValidAddressAnchor>
  )
}

export default RichAddress
