import React from 'react'
import { parseRichAddress } from '../utils/rich-address'
import { Icon, Tooltip } from 'antd'

const RichAddress: React.FC<{ crude: string }> = ({ crude }) => {
  const richAddress = parseRichAddress(crude)
  if (richAddress === null) {
    console.log('Address has wrong format or unknown prepend', crude)
    const errorMessage = `Unknown address "${crude}"`
    return <span style={{ color: 'red' }}>{errorMessage}</span>
  }
  const { address, reference, link, passedTest } = richAddress
  const labelText = `${reference.label}: `
  if (!passedTest)
    return (
      <Tooltip title="Address is invalid">
        <Icon type="warning" theme="filled" style={{ color: '#787800' }} />
        &nbsp;
        <a
          href={link}
          rel="noreferrer"
          target="_blank"
          style={{ color: '#787800', textDecoration: 'underline' }}
        >
          {labelText}
          {address.slice(0, 6)}...{address.slice(address.length - 4)}
        </a>
      </Tooltip>
    )

  return (
    <a
      href={link}
      rel="noreferrer"
      target="_blank"
      style={{ textDecoration: 'underline' }}
    >
      {labelText}
      {address.slice(0, 6)}...{address.slice(address.length - 4)}
    </a>
  )
}

export default RichAddress
