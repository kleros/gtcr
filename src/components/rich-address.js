import React from 'react'
import { parseRichAddress } from '../utils/rich-address'

const RichAddress = ({ richAddress }) => {
  const { link, info, address, addressType } = parseRichAddress(richAddress)
  if (link === null) {
    console.log('Address has wrong format or unknown prepend', richAddress)
    const errorMessage = `Error: Unknown address type "${addressType}"`
    return (
      <span style={{ color: 'red' }}>
        {errorMessage}. <b>{richAddress}</b>
      </span>
    )
  }
  const labelText = `${info.label}: `
  return (
    <a href={link} style={{ textDecoration: 'underline' }}>
      {labelText}
      {address.slice(0, 6)}...{address.slice(address.length - 4)}
    </a>
  )
}

export default RichAddress
