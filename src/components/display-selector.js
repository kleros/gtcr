import React from 'react'
import { Typography, Avatar, Checkbox, Icon } from 'antd'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import EthAddress from './eth-address'
import GTCRAddress from './gtcr-address'
import TwitterUser from './twitter-user'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { ZERO_ADDRESS, LOREM_IPSUM } from '../utils/string'

const StyledImage = styled.img`
  object-fit: contain;
  height: 100px;
  width: 100px;
  padding: 5px;
`

const protocolRegex = new RegExp(/:\/\//g)

const DisplaySelector = ({ type, value, linkImage, allowedFileTypes }) => {
  switch (type) {
    case ItemTypes.GTCR_ADDRESS:
      return <GTCRAddress address={value || ZERO_ADDRESS} />
    case ItemTypes.ADDRESS:
      return <EthAddress address={value || ZERO_ADDRESS} />
    case ItemTypes.TEXT:
    case ItemTypes.NUMBER:
      return <Typography.Text>{value}</Typography.Text>
    case ItemTypes.BOOLEAN:
      return <Checkbox disabled checked={value} />
    case ItemTypes.LONGTEXT:
      return <Typography.Paragraph>{value || LOREM_IPSUM}</Typography.Paragraph>
    case ItemTypes.FILE: {
      if (!value)
        return (
          <a target="_blank" rel="noopener noreferrer" href="/#">
            View File <Icon type="paper-clip" />
          </a>
        )

      if (!allowedFileTypes) return 'No allowed file types specified'

      const allowedFileTypesArr = allowedFileTypes.split(' ')
      if (allowedFileTypesArr.length === 0)
        return 'No allowed file types specified'

      const fileExtension = value.slice(value.lastIndexOf('.') + 1)
      if (!allowedFileTypesArr.includes(fileExtension))
        return 'Forbidden file type'

      return (
        <a
          href={`${process.env.REACT_APP_IPFS_GATEWAY}${value || ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View File <Icon type="paper-clip" />
        </a>
      )
    }
    case ItemTypes.IMAGE:
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
    case ItemTypes.LINK:
      return (
        <a
          href={
            protocolRegex.test(value)
              ? value
              : value.slice(0, 8) === 'https://'
              ? value
              : `https://${value.slice(0, 8)}`
          }
        >
          <Typography.Text>{value}</Typography.Text>
        </a>
      )
    case ItemTypes.TWITTER_USER_ID:
      return <TwitterUser userID={value} />
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
