import React from 'react'
import { BigNumberish, ethers } from 'ethers'
import { AmountPending } from 'components/curate/chrome-amount'

const trimToPrecision = (value: string, precision: number) => {
  const [whole, fraction = ''] = value.split('.')
  if (precision <= 0 || !fraction) return whole
  const trimmedFraction = fraction.slice(0, precision).replace(/0+$/, '')
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

/** A token amount from its smallest unit; a short shimmer while unknown. */
const TokenAmount: React.FC<{
  amount: BigNumberish | bigint | null | undefined
  tokenDecimals?: number
  precision?: number
  displayUnit?: string
}> = ({ amount, tokenDecimals = 18, precision = 3, displayUnit = '' }) => {
  if (amount == null) return <AmountPending />

  const formatted = ethers.utils.formatUnits(String(amount), tokenDecimals)
  const valueDisplayed = trimToPrecision(formatted, precision)

  return <>{valueDisplayed + displayUnit}</>
}

export default TokenAmount
