export const getFormattedPath = (url: string) => {
  // Handle already formatted or prefixed URLs
  if (url.startsWith('/ipfs/')) return url
  if (url.startsWith('ipfs/')) return `/${url}`
  if (url.startsWith('ipfs://')) return url.replace('ipfs://', '/ipfs/')

  // Handle raw IPFS hashes (CIDv0 or CIDv1)
  const ipfsHashPattern = /^[a-zA-Z0-9]{46,59}$/
  if (ipfsHashPattern.test(url)) return `/ipfs/${url}`

  return url
}

export const parseIpfs = (path: string) => {
  const formatted = getFormattedPath(path)
  // The link stays on the gateway whatever the path holds: glued on without
  // a slash, ".evil.example/x" or "@evil.example/x" would change the host.
  const onGateway = formatted.startsWith('/') ? formatted : `/${formatted}`
  return `${process.env.REACT_APP_IPFS_GATEWAY}${onGateway}`
}
