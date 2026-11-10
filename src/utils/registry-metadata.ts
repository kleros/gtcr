import { parseIpfs } from 'utils/ipfs-parse'

/*
 * A list's own metadata (title, description, logo), read from its
 * registration MetaEvidence on IPFS.
 *
 * MetaEvidence URIs come in every shape the list factories have written:
 * "/ipfs/<cid>/file.json", "ipfs/<cid>/file.json" (no leading slash, common
 * on lists made by other front ends), "ipfs://<cid>/…", a bare CID or a
 * gateway URL. Test deployments also wrote placeholders such as
 * "ipfs://registrationMetaEvidence" or "/ipfs/dev-…/…json" that are not
 * content addresses; those are never requested, the gateway only answers
 * them with an error.
 */

export interface RegistryMetadata {
  title?: string
  description?: string
  logoURI?: string
}

/** CIDv0 (Qm…, base58) or CIDv1 in base32 (b…). */
const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/

/** Long enough for a cold gateway, short enough not to hold a slot forever. */
const TIMEOUT_MS = 8_000

/**
 * The IPFS path ("<cid>/file.json") a MetaEvidence URI points at, or null
 * when it is not a content address (a placeholder, an empty value).
 */
export const ipfsPath = (uri?: string | null): string | null => {
  if (!uri) return null
  const path = uri
    .trim()
    .replace(/^https?:\/\/[^/]+\/ipfs\//i, '')
    .replace(/^ipfs:\/\//i, '')
    .replace(/^\/?ipfs\//i, '')
  return CID.test(path.split('/')[0]) ? path : null
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

/** Results by IPFS path: the content is immutable, so one read is enough. */
const settled = new Map<string, RegistryMetadata | null>()
const pending = new Map<string, Promise<RegistryMetadata | null>>()

const read = async (path: string): Promise<RegistryMetadata | null> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(parseIpfs(`/ipfs/${path}`), {
      signal: controller.signal,
    })
    // A server error or a gateway timeout may pass: throw so it is retried.
    if (response.status >= 500) throw new Error(`Gateway ${response.status}`)
    if (!response.ok) return null

    // Some lists point their MetaEvidence at a non-JSON object (a dag-cbor
    // node, for one): that is "no metadata", not an error.
    let file: any
    try {
      file = await response.json()
    } catch {
      return null
    }
    const evidence = file?.data ?? file ?? {}
    const metadata = evidence?.metadata ?? file?.metadata ?? {}
    const title = text(
      metadata.tcrTitle ||
        metadata.title ||
        evidence.tcrTitle ||
        evidence.registryTitle,
    )
    return {
      // "-" is what some forms saved for an empty title.
      title: title && title !== '-' ? title : undefined,
      description: text(
        metadata.tcrDescription ||
          metadata.description ||
          evidence.tcrDescription ||
          evidence.description,
      ),
      logoURI: text(metadata.logoURI || metadata.logo || evidence.logoURI),
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Title, description and logo from a list's MetaEvidence, or null when the
 * URI is not a content address or the file holds no metadata. Throws when
 * the gateway did not answer, so callers can retry; answers are kept for
 * the session.
 */
export const readRegistryMetadata = async (
  uri?: string | null,
): Promise<RegistryMetadata | null> => {
  const path = ipfsPath(uri)
  if (!path) return null
  if (settled.has(path)) return settled.get(path) ?? null
  const inFlight = pending.get(path)
  if (inFlight) return inFlight
  const request = read(path)
    .then((result) => {
      settled.set(path, result)
      return result
    })
    .finally(() => pending.delete(path))
  pending.set(path, request)
  return request
}
