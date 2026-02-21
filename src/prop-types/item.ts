import { BigNumber } from 'ethers'

export interface Item {
  ID: string
  status: number | string
  disputed: boolean
  disputeStatus: number
  hasPaid: boolean[]
  data: string
  decodedData?: any[]
  currentRuling: number
  appealStart: BigNumber
  appealEnd: BigNumber
  submissionTime: BigNumber
  amountPaid: BigNumber[]
}

// Runtime dummy kept for unconverted .jsx consumers that still reference
// ItemPropTypes in their .propTypes blocks.  Will be removed once all
// consumers are migrated to TypeScript.
const ItemPropTypes: any = {}
export default ItemPropTypes
