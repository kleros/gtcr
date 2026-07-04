import React from 'react'
import styled from 'styled-components'
import { Skeleton } from 'components/ui'
import { ethers, BigNumberish } from 'ethers'

const SkeletonTitleProps = { width: '30px' }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ui-skeleton-title {
    margin: -3px 0;
  }
`
const ETHAmount: React.FC<{
  amount?: BigNumberish | null
  decimals?: number
  displayUnit?: string
}> = ({ amount, displayUnit }) => {
  if (amount == null)
    return (
      <StyledSkeleton active paragraph={false} title={SkeletonTitleProps} />
    )

  const formattedEther = ethers.utils.formatEther(
    typeof amount === 'number'
      ? amount.toLocaleString('fullwide', { useGrouping: false })
      : String(amount),
  )

  const valueDisplayed = formattedEther.replace(/\.?0+$/, '')

  return <>{valueDisplayed + (displayUnit || '')}</>
}

export default ETHAmount
