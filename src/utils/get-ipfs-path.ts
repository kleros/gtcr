export interface IPFSResultObject {
  cids: { split: (delimiter: string) => string[] }[]
}

export const getIPFSPath = (ipfsResultObject: IPFSResultObject): string =>
  `/ipfs/${ipfsResultObject.cids[0].split('ipfs://')[1]}`
