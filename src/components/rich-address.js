import React from 'react'
import { parseRichAddress } from '../utils/helpers/rich-address'

const RichAddress = ({ crude }) => {
  const richAddress = parseRichAddress(crude)
  if (richAddress === null) {
    console.log('Address has wrong format or unknown prepend', crude)
    const errorMessage = `Unknown address "${crude}"`
    return (
      <span style={{ color: 'red' }}>
        {errorMessage}. <b>{richAddress}</b>
      </span>
    )
  }
  const { address, reference, link } = richAddress
  const labelText = `${reference.label}: `
  return (
    <a href={link} style={{ textDecoration: 'underline' }}>
      {labelText}
      {address.slice(0, 6)}...{address.slice(address.length - 4)}
    </a>
  )
}

export default RichAddress
