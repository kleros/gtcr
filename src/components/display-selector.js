import React from 'react'
import { Typography, Avatar, Checkbox } from 'antd'
import styled from 'styled-components/macro'
import EthAddress from './eth-address'
import GTCRAddress from './gtcr-address'
import itemTypes from '../utils/item-types'
import { ZERO_ADDRESS, LOREM_IPSUM } from '../utils/string'

const StyledImage = styled.img`
  object-fit: contain;
  height: 100px;
  width: 100px;
  padding: 5px;
`

const DisplaySelector = ({ type, value, linkImage }) => {
  switch (type) {
    case itemTypes.GTCR_ADDRESS:
      return <GTCRAddress address={value || ZERO_ADDRESS} />
    case itemTypes.ADDRESS:
      return <EthAddress address={value || ZERO_ADDRESS} />
    case itemTypes.TEXT:
    case itemTypes.NUMBER:
      return <Typography.Text>{value}</Typography.Text>
    case itemTypes.BOOLEAN:
      return <Checkbox disabled checked={value} />
    case itemTypes.LONGTEXT:
      return <Typography.Paragraph>{value || LOREM_IPSUM}</Typography.Paragraph>
    case itemTypes.IMAGE:
      return value ? (
        linkImage ? (
          <a
            href={`${process.env.REACT_APP_IPFS_GATEWAY}${value}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <StyledImage
              src={`${process.env.REACT_APP_IPFS_GATEWAY}${value}`}
              alt="item"
            />
          </a>
        ) : (
          <StyledImage
            src={`${process.env.REACT_APP_IPFS_GATEWAY}${value}`}
            alt="item"
          />
        )
      ) : (
        <Avatar shape="square" size="large" icon="file-image" />
      )
    default:
      throw new Error(`Unhandled type ${type}.`)
  }
}

export default DisplaySelector
