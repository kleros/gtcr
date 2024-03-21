import React from 'react'
import styled from 'styled-components'
import { Skeleton } from 'antd'
import { ethers } from 'ethers'
import { BigNumberish } from 'ethers/utils'

const SkeletonTitleProps = { width: 30 }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`
const ETHAmount: React.FC<{
  amount: BigNumberish
  decimals: number
  displayUnit: string
}> = ({ amount, decimals, displayUnit }) => {
  if (amount === null)
    return (
      <StyledSkeleton active paragraph={false} title={SkeletonTitleProps} />
    )

  let valueDisplayed = String(
    Number(
      ethers.utils.formatEther(
        typeof amount === 'number'
          ? amount.toLocaleString('fullwide', { useGrouping: false })
          : String(amount)
      )
    )
  )

  const value = Number(valueDisplayed)

  if (Math.floor(value) !== value) {
    const decimalCount = value.toString().split('.')[1].length
    valueDisplayed = value.toFixed(Math.min(decimalCount, decimals))
  }

  return <>{valueDisplayed + (displayUnit || '')}</>
}

export default ETHAmount
