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

// What a CSS url("…") may carry as written. Anything else (quotes,
// parentheses, backslash, whitespace, braces, semicolons) is percent-encoded,
// so the value can never close the string, the url() or the declaration.
const CSS_URL_UNSAFE = /[^A-Za-z0-9\-._~:/?#[\]@!$&*+,=%]/g

/**
 * A quoted CSS url() for an image URL taken from list or entry data, or
 * undefined unless it is an https URL. Logo URIs are written by whoever
 * creates a list: pasted raw into a styled-components template, a value
 * holding `)`, `"` or `}` adds rules of its own to the page.
 */
export function cssImageUrl(url?: string | null): string | undefined {
  const parsed = parseUrl(url)
  if (parsed?.protocol !== 'https:') return undefined
  // URL serialisation leaves only ASCII here, so each match is one byte.
  const href = parsed.href.replace(
    CSS_URL_UNSAFE,
    (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  )
  return `url("${href}")`
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
