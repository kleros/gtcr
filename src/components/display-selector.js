import React from 'react'
import styled from 'styled-components'
import { Typography, Avatar, Checkbox } from 'antd'
import PropTypes from 'prop-types'
import GTCRAddress from './gtcr-address'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { ZERO_ADDRESS } from '../utils/string'
import RichAddress from './rich-address'
import ETHAddress from './eth-address'
import LongText from './long-text'
import FileDisplay from './file-display'
import { parseIpfs } from 'utils/ipfs-parse'

const pohRichAddress = 'eip155:1:0xc5e9ddebb09cd64dfacab4011a0d5cedaf7c9bdb'

const StyledImage = styled.img`
  object-fit: contain;
  height: 100px;
  width: 100px;
  padding: 5px;
`

const protocolRegex = /:\/\//

const DisplaySelector = ({ type, value, linkImage, allowedFileTypes }) => {
  switch (type) {
    case ItemTypes.GTCR_ADDRESS:
      return <GTCRAddress address={value || ZERO_ADDRESS} />
    case ItemTypes.ADDRESS:
      return <ETHAddress address={value || ZERO_ADDRESS} forceEth />
    case ItemTypes.RICH_ADDRESS:
      return <RichAddress crude={value || pohRichAddress} />
    case ItemTypes.TEXT:
    case ItemTypes.NUMBER:
      return <Typography.Text>{value}</Typography.Text>
    case ItemTypes.BOOLEAN:
      return <Checkbox disabled checked={value === 'true'} />
    case ItemTypes.LONG_TEXT:
      return <LongText value={value} />
    case ItemTypes.FILE: {
      return <FileDisplay value={value} allowedFileTypes={allowedFileTypes} />
    }
    case ItemTypes.IMAGE:
      return value ? (
        linkImage ? (
          <a href={parseIpfs(value)} target="_blank" rel="noopener noreferrer">
            <StyledImage src={parseIpfs(value)} alt="item" />
          </a>
        ) : (
          <StyledImage src={parseIpfs(value)} alt="item" />
        )
      ) : (
        <Avatar shape="square" size="large" icon="file-image" />
      )
    case ItemTypes.LINK:
      return (
        <a href={protocolRegex.test(value) ? value : `https://${value}`}>
          <Typography.Text>{value}</Typography.Text>
        </a>
      )
    default:
      return (
        <Typography.Paragraph>
          Error: Unhandled Type {type} for data {value}
        </Typography.Paragraph>
      )
  }
}

DisplaySelector.propTypes = {
  type: PropTypes.oneOf(Object.values(ItemTypes)).isRequired,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.bool,
    PropTypes.object
  ]),
  linkImage: PropTypes.bool,
  allowedFileTypes: PropTypes.string
}

DisplaySelector.defaultProps = {
  linkImage: null,
  allowedFileTypes: null,
  value: null
}

export default DisplaySelector
