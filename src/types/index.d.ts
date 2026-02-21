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
    [key: string]: unknown
  }

  /** Permanent TCR registry data from subgraph */
  interface SubgraphRegistry {
    submissionPeriod?: string | number
    reinclusionPeriod?: string | number
    withdrawingPeriod?: string | number
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
      columns?: Column[]
      itemName?: string
      logoURI?: string
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

  /** Ethers library type used throughout the app (patched provider from useWeb3Context) */
  type EthersLibrary = providers.JsonRpcProvider | providers.FallbackProvider

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
  export function gtcrDecode(args: { columns: Column[]; values: string }): unknown[]
  export function gtcrEncode(args: { columns: Column[]; values: unknown[] }): string
  export function searchableFields(columns: Column[]): number[]
  export function typeDefaultValues(type: string): string | number | boolean
}

// @kleros/tcr contract ABIs
declare module '@kleros/tcr/build/contracts/GeneralizedTCR.json' {
  export const abi: readonly Record<string, unknown>[]
}
declare module '@kleros/tcr/build/contracts/GeneralizedTCRView.json' {
  export const abi: readonly Record<string, unknown>[]
}
declare module '@kleros/tcr/build/contracts/GTCRFactory.json' {
  export const abi: readonly Record<string, unknown>[]
}
declare module '@kleros/tcr/build/contracts/BatchWithdraw.json' {
  export const abi: readonly Record<string, unknown>[]
}

// @kleros/erc-792 contract ABIs
declare module '@kleros/erc-792/build/contracts/IArbitrator.json' {
  export const abi: readonly Record<string, unknown>[]
}

// @kleros/kleros contract ABIs
declare module '@kleros/kleros/build/contracts/PolicyRegistry.json' {
  export const abi: readonly Record<string, unknown>[]
}

// Untyped npm modules
declare module 'react-blockies' {
  import { ComponentType } from 'react'
  interface BlockiesProps {
    seed: string
    size?: number
    scale?: number
    className?: string
    color?: string
    bgColor?: string
    spotColor?: string
  }
  const Blockies: ComponentType<BlockiesProps>
  export default Blockies
}

declare module 'js-ordinal' {
  export default function ordinal(n: number): string
}

declare module 'react-rewards' {
  import { ComponentType } from 'react'
  interface RewardProps {
    ref?: React.Ref<{ rewardMe: () => void }>
    type?: 'confetti' | 'emoji' | 'memphis'
    config?: Record<string, unknown>
    children?: React.ReactNode
  }
  const Reward: ComponentType<RewardProps>
  export default Reward
}

declare module 'react-text-loop' {
  import { ComponentType, ReactNode } from 'react'
  interface TextLoopProps {
    children: ReactNode
    interval?: number | number[]
    delay?: number
    adjustingSpeed?: number
    fade?: boolean
    mask?: boolean
    noWrap?: boolean
    springConfig?: { stiffness?: number; damping?: number }
    className?: string
  }
  const TextLoop: ComponentType<TextLoopProps>
  export default TextLoop
}
