import React from 'react'
import { Typography, Switch, Skeleton } from 'antd'
import styled from 'styled-components/macro'
import EthAddress from './eth-address'
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
    default:
      throw new Error(`Unhandled type ${type}.`)
  }
}

export default DisplaySelector
