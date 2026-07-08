// Ambient declaration for the untyped react-blockies package. Must live in a
// file with no top-level imports: index.d.ts is a module (it imports ethers),
// so a `declare module` there is treated as an augmentation of a module that
// has no declaration and is silently dropped.
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
