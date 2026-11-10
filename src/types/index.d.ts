import { providers, BigNumber } from 'ethers'

declare global {
  interface Window {
    ethereum: providers.ExternalProvider
  }

  type Empty = null | undefined

  /** Column descriptor used by @kleros/gtcr-encoder */
  interface Column {
    label: string
    type: string
    description?: string
    isIdentifier?: boolean
    allowedFileTypes?: string
    [key: string]: unknown
  }

  /** Subgraph round data */
  interface SubgraphRound {
    appealPeriodStart: string
    appealPeriodEnd: string
    ruling: string
    rulingTime?: string
    hasPaidRequester: boolean
    hasPaidChallenger: boolean
    amountPaidRequester: BigNumber
    amountPaidChallenger: BigNumber
  }

  /** Subgraph request data */
  interface SubgraphRequest {
    requester: string
    challenger: string
    submissionTime: string
    disputed: boolean
    resolved: boolean
    requestType?: string
    rounds: SubgraphRound[]
  }

  /** Subgraph challenge data (permanent TCR) */
  interface SubgraphChallenge {
    rounds: SubgraphRound[]
  }

  /** Subgraph item data (light/classic TCR) */
  interface SubgraphItem {
    ID?: string
    id?: string
    itemID?: string
    status: string
    disputed: boolean
    data: string
    decodedData?: unknown[]
    requests?: SubgraphRequest[]
    challenges?: SubgraphChallenge[]
    resolved?: boolean
    submissionTime?: string
    includedAt?: string
    withdrawingTimestamp?: string
    /** Permanent-TCR stake bounty (wei string) */
    stake?: string
    /** Attached by item-details pages when decoding fails */
    errors?: string[]
    /** Present on permanent TCR items */
    registry?: SubgraphRegistry
    [key: string]: unknown
  }

  /** Registry metadata carried by a permanent TCR arbitration setting */
  interface SubgraphArbitrationSettingMetadata {
    title?: string
    description?: string
    itemName?: string
    itemNamePlural?: string
    policyURI?: string
    logoURI?: string
    requireRemovalEvidence?: boolean
    [key: string]: unknown
  }

  /** One arbitration setting revision of a permanent TCR registry */
  interface SubgraphArbitrationSetting {
    timestamp?: string
    arbitratorExtraData?: string
    metaEvidenceURI?: string
    metadata?: SubgraphArbitrationSettingMetadata
  }

  /** Permanent TCR registry data from subgraph */
  interface SubgraphRegistry {
    id?: `0x${string}`
    token?: `0x${string}`
    numberOfSubmitted?: string | number
    numberOfAbsent?: string | number
    numberOfDisputed?: string | number
    arbitrator?: { id?: `0x${string}` }
    arbitrationSettings?: SubgraphArbitrationSetting[]
    submissionMinDeposit?: string | number
    submissionPeriod?: string | number
    reinclusionPeriod?: string | number
    withdrawingPeriod?: string | number
    arbitrationParamsCooldown?: string | number
    challengeStakeMultiplier?: string | number
    winnerStakeMultiplier?: string | number
    loserStakeMultiplier?: string | number
    sharedStakeMultiplier?: string | number
    [key: string]: unknown
  }

  /** MetaEvidence JSON fetched from IPFS */
  interface MetaEvidence {
    address?: string
    title?: string
    description?: string
    columns?: Column[]
    itemName?: string
    itemNamePlural?: string
    metadata?: {
      tcrTitle?: string
      tcrDescription?: string
      /** Some registries publish the plain `title`/`description` keys instead. */
      title?: string
      description?: string
      columns?: Column[]
      itemName?: string
      itemNamePlural?: string
      logoURI?: string
      policyURI?: string
      isTCRofTCRs?: boolean
      requireRemovalEvidence?: boolean
      [key: string]: unknown
    }
    fileURI?: string
    evidenceDisplayInterfaceURI?: string
    [key: string]: unknown
  }

  /** Return type of fetchMetaEvidence */
  interface FetchMetaEvidenceResult {
    metaEvidenceURI: string
    connectedTCR?: string
  }

  /**
   * Struct returned by GeneralizedTCRView/LightGeneralizedTCRView
   * `fetchArbitrable` (identical in both ABIs).
   */
  interface ArbitrableTCRData {
    governor: string
    arbitrator: string
    arbitratorExtraData: string
    submissionBaseDeposit: BigNumber
    removalBaseDeposit: BigNumber
    submissionChallengeBaseDeposit: BigNumber
    removalChallengeBaseDeposit: BigNumber
    challengePeriodDuration: BigNumber
    metaEvidenceUpdates: BigNumber
    winnerStakeMultiplier: BigNumber
    loserStakeMultiplier: BigNumber
    sharedStakeMultiplier: BigNumber
    MULTIPLIER_DIVISOR: BigNumber
    arbitrationCost: BigNumber
  }

  /** Ethers library type used throughout the app (patched provider from useWeb3Context) */
  type EthersLibrary = providers.JsonRpcProvider

  /** IPFS publish result */
  interface IpfsPublishResult {
    cid: string
    path: string
    size: number
    inconsistentCids: string[]
    [key: string]: unknown
  }
}

// @kleros/gtcr-encoder
declare module '@kleros/gtcr-encoder' {
  export const ItemTypes: Record<string, string>
  export function gtcrDecode(args: {
    columns: Column[]
    values: string
  }): unknown[]
  export function gtcrEncode(args: {
    columns: Column[]
    values: Record<string, unknown> | unknown[]
  }): string
  export function searchableFields(columns: Column[]): number[]
  export const typeDefaultValues: Record<string, string | number | boolean>
}

// @kleros/tcr contract ABIs
declare module '@kleros/tcr/build/contracts/GeneralizedTCR.json' {
  export const abi: readonly Record<string, unknown>[]
}
declare module '@kleros/tcr/build/contracts/GeneralizedTCRView.json' {
  export const abi: readonly Record<string, unknown>[]
}
declare module '@kleros/tcr/build/contracts/BatchWithdraw.json' {
  export const abi: readonly Record<string, unknown>[]
}

// @kleros/erc-792 contract ABIs
declare module '@kleros/erc-792/build/contracts/IArbitrator.json' {
  export const abi: readonly Record<string, unknown>[]
}
