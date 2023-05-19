export const parseIpfs = (path: string) => {
  // at kleros we encode these paths like: /ipfs/{hash}/{path_to_file}
  // if formatted like ipfs:// ... , hack to parse into proper access
  const ipfsResourceLink = path.includes(':')
    ? `${process.env.REACT_APP_IPFS_GATEWAY}/ipfs/${path.split('//')[1]}`
    : process.env.REACT_APP_IPFS_GATEWAY + path

  return ipfsResourceLink
}
