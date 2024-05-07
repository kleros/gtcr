export interface IPFSResultObject {
  cids: string[]
}

export const getIPFSPath = (ipfsResultObject: IPFSResultObject): string =>
  `/ipfs/${ipfsResultObject.cids[0].split('ipfs://')[1]}`
