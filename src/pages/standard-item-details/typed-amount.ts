import { BigNumber, ethers } from 'ethers'
import { normalizeDecimalInput } from 'utils/decimal-input'

/**
 * An appeal contribution as typed, in wei. Text that is empty, negative or
 * cannot be read as a plain decimal (1e-3, say) is zero, so the dialog's
 * confirm waits for a readable amount and never sends one the field does
 * not show. One comma with no dot reads as the decimal point ("0,5").
 */
export const typedAmountWei = (text: string): BigNumber => {
  try {
    const wei = ethers.utils.parseEther(normalizeDecimalInput(text) || '0')
    return wei.isNegative() ? BigNumber.from(0) : wei
  } catch {
    return BigNumber.from(0)
  }
}

export default typedAmountWei
