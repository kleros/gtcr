import React from 'react'
import { Typography, Switch, Skeleton, Avatar } from 'antd'
import styled from 'styled-components/macro'
import EthAddress from './eth-address'
import GTCRAddress from './gtcr-address'
import itemTypes from '../utils/item-types'
import { ZERO_ADDRESS, LOREM_IPSUM } from '../utils/string'

const SkeletonTitleProps = { width: '150px' }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`

const DisplaySelector = ({ type, value }) => {
  switch (type) {
    case itemTypes.GTCR_ADDRESS:
      return <GTCRAddress address={value || ZERO_ADDRESS} />
    case itemTypes.ADDRESS:
      return <EthAddress address={value || ZERO_ADDRESS} />
    case itemTypes.TEXT:
    case itemTypes.NUMBER:
      return (
        <Typography.Text>
          {value || (
            <StyledSkeleton paragraph={false} title={SkeletonTitleProps} />
          )}
        </Typography.Text>
      )
    case itemTypes.BOOLEAN:
      return <Switch disabled checked={value} />
    case itemTypes.LONGTEXT:
      return <Typography.Paragraph>{value || LOREM_IPSUM}</Typography.Paragraph>
    case itemTypes.IMAGE:
      return value ? (
        <img
          src={`${process.env.REACT_APP_IPFS_GATEWAY}${value}`}
          style={{ height: '70px', objectFit: 'contain' }}
          alt="item"
        />
      ) : (
        <Avatar shape="square" size="large" icon="file-image" />
      )
    default:
      throw new Error(`Unhandled type ${type}.`)
  }
}

export default DisplaySelector
