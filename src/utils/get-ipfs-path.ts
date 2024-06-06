export interface IPFSResultObject {
  cids: string[]
}

export const getIPFSPath = (ipfsResultObject: IPFSResultObject): string =>
  getFormattedPath(ipfsResultObject.cids[0])

/**
 *
 * @param url an ipfs cid
 * @returns formats an ipfs cid to be in /ipfs/hash format, reolaces ipfs://, ipfs/, with /ipfs/
 */
export const getFormattedPath = (url: string) =>
  url.replace(/^(ipfs:\/\/|ipfs\/?)/, '/ipfs/')
