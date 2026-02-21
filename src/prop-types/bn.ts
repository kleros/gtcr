import { BigNumber } from 'ethers'

export type BNType = BigNumber

// Runtime dummy kept for unconverted .jsx consumers that still reference
// BNPropType in their .propTypes blocks.  Will be removed once all
// consumers are migrated to TypeScript.
const BNPropType: Record<string, unknown> = {}
export default BNPropType
