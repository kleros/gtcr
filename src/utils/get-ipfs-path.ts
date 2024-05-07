export interface IPFSEvidenceObject {
  cids: { split: (delimiter: string) => string[] }[]
}

export const getIPFSPath = (ipfsEvidenceObject: IPFSEvidenceObject): string =>
  `/ipfs/${ipfsEvidenceObject.cids[0].split('ipfs://')[1]}`
