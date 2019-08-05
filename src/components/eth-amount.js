import PropTypes from 'prop-types'
import React from 'react'
import { Skeleton } from 'antd'
import styled from 'styled-components/macro'
import { ethers } from 'ethers'

const SkeletonTitleProps = { width: 30 }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`
const ETHAmount = ({ amount, decimals }) =>
  amount === null ? (
    <StyledSkeleton active paragraph={false} title={SkeletonTitleProps} />
  ) : (
    Number(
      ethers.utils.formatEther(
        typeof amount === 'number'
          ? amount.toLocaleString('fullwide', { useGrouping: false })
          : String(amount)
      )
    ).toFixed(decimals)
  )

ETHAmount.propTypes = {
  amount: PropTypes.oneOfType([
    PropTypes.string.isRequired,
    PropTypes.number.isRequired,
    PropTypes.object.isRequired
  ]),
  decimals: PropTypes.number
}

ETHAmount.defaultProps = {
  amount: null,
  decimals: 0
}

export default ETHAmount
