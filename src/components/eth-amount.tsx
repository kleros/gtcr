import React from 'react'
import { ethers, BigNumberish } from 'ethers'
import { AmountPending } from 'components/curate/chrome-amount'

/** A native-currency amount from wei; a short shimmer while unknown. */
const ETHAmount: React.FC<{
  amount?: BigNumberish | null
  decimals?: number
  displayUnit?: string
}> = ({ amount, displayUnit }) => {
  if (amount == null) return <AmountPending />

  const formattedEther = ethers.utils.formatEther(
    typeof amount === 'number'
      ? amount.toLocaleString('fullwide', { useGrouping: false })
      : String(amount),
  )

  const valueDisplayed = formattedEther.replace(/\.?0+$/, '')

  return <>{valueDisplayed + (displayUnit || '')}</>
}

export default ETHAmount
