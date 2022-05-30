import { Web3Context } from 'web3-react/dist/context'

export interface ErrorWithCode extends Error {
  code?: string | number | undefined
}

export interface Web3ContextCurate extends Web3Context {
  error: ErrorWithCode | null
}
