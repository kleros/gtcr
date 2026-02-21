import { getFormattedPath } from './ipfs-parse'

export interface IPFSResultObject {
  cids: string[]
}

export const getIPFSPath = (ipfsResultObject: IPFSResultObject): string =>
  getFormattedPath(ipfsResultObject.cids[0])
