import { ethers, BigNumber, type BigNumberish } from 'ethers'
import { trimZeros } from 'components/curate/item-standard-format'
import { plainDecimal } from 'pages/factory-permanent/format'

/*
 * Amounts for the classic factory, where deposits are in the chain's native
 * currency and each one adds the arbitration cost on top.
 */

/** "0.05" from a wei amount, trailing zeros trimmed; null while unknown. */
export const formatNative = (
  amount: BigNumberish | null | undefined,
): string | null => {
  if (amount === null || amount === undefined) return null
  const integer =
    typeof amount === 'number'
      ? amount.toLocaleString('fullwide', { useGrouping: false })
      : String(amount)
  return trimZeros(ethers.utils.formatEther(integer))
}

/** base + arbitration cost in wei, or null while either is unknown or invalid. */
export const totalDeposit = (
  base: unknown,
  arbitrationCost: BigNumberish | null | undefined,
): BigNumber | null => {
  if (arbitrationCost === null || arbitrationCost === undefined) return null
  try {
    // Read as the deploy reads it: "0,5" is 0.5.
    const baseWei = ethers.utils.parseEther(plainDecimal(base ?? '0'))
    // A negative base is invalid (the schema refuses it), not a discount
    // on the arbitration cost.
    if (baseWei.isNegative()) return null
    return baseWei.add(BigNumber.from(arbitrationCost))
  } catch {
    return null
  }
}
