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

/**
 * A logo or picture from list or entry data, always on the IPFS gateway: an
 * /ipfs/ path, an ipfs:// URI or a CID, or a link to any IPFS gateway
 * (https://<host>/ipfs/<cid>…), which is read through ours. Any other web
 * address gives nothing: list creators and submitters write these values,
 * so the browser of everyone who opened the dashboard or a list would call
 * the host they chose, and the picture could change after curators checked
 * it, which content-addressed files cannot.
 */
export const ipfsImageUrl = (uri: unknown): string | undefined => {
  if (typeof uri !== 'string' || !uri.trim()) return undefined
  const text = uri.trim()
  const gatewayPath = /^https?:\/\/[^/?#]+(\/ipfs\/[^?#]+)/i.exec(text)?.[1]
  if (gatewayPath) return parseIpfs(gatewayPath)
  if (/^[a-z][\d+.a-z-]*:/i.test(text) && !/^ipfs:\/\//i.test(text))
    return undefined
  return parseIpfs(text)
}
