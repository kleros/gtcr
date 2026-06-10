const parseUrl = (url?: string | null): URL | null => {
  if (!url || typeof url !== 'string') return null
  try {
    return new URL(url.trim())
  } catch {
    return null
  }
}

// Only https is allowed, rejects javascript:, data:, vbscript:, file:, etc.
export function isSafeNavigationUrl(url?: string | null): boolean {
  return parseUrl(url)?.protocol === 'https:'
}

const gatewayOrigin =
  parseUrl(process.env.REACT_APP_IPFS_GATEWAY)?.origin ?? null

// Must be https URLs on the IPFS gateway under an /ipfs/ path.
export function getAllowedAttachmentUrl(
  url?: string | null,
): string | undefined {
  const parsed = parseUrl(url)
  if (!parsed || !gatewayOrigin) return undefined
  if (
    parsed.protocol !== 'https:' ||
    parsed.origin !== gatewayOrigin ||
    !parsed.pathname.startsWith('/ipfs/')
  )
    return undefined
  return parsed.href
}
