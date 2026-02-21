interface Window {
  ethereum: any
}

type Empty = null | undefined

// @kleros/gtcr-encoder
declare module '@kleros/gtcr-encoder' {
  export const ItemTypes: Record<string, string>
  export function gtcrDecode(args: { columns: any[]; values: string }): any[]
  export function gtcrEncode(args: { columns: any[]; values: any[] }): string
  export function searchableFields(columns: any[]): number[]
  export function typeDefaultValues(type: string): any
}

// @kleros/tcr contract ABIs
declare module '@kleros/tcr/build/contracts/GeneralizedTCR.json' {
  export const abi: any[]
}
declare module '@kleros/tcr/build/contracts/GeneralizedTCRView.json' {
  export const abi: any[]
}
declare module '@kleros/tcr/build/contracts/GTCRFactory.json' {
  export const abi: any[]
}
declare module '@kleros/tcr/build/contracts/BatchWithdraw.json' {
  export const abi: any[]
}

// @kleros/erc-792 contract ABIs
declare module '@kleros/erc-792/build/contracts/IArbitrator.json' {
  export const abi: any[]
}

// @kleros/kleros contract ABIs
declare module '@kleros/kleros/build/contracts/PolicyRegistry.json' {
  export const abi: any[]
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
  const Reward: any
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
    springConfig?: any
    className?: string
  }
  const TextLoop: ComponentType<TextLoopProps>
  export default TextLoop
}
