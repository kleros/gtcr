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
 * Reads in flight at once. A dashboard load asks for every list's
 * MetaEvidence (hundreds); the rest wait their turn instead of all hitting
 * the gateway together. The timeout starts when a read leaves the queue.
 */
const MAX_IN_FLIGHT = 6

/**
 * A path whose read failed (gateway error or timeout) is not asked again
 * before this pause, doubling with each failure in a row: the dashboard's
 * refreshes cannot re-request a failing set every time.
 */
const RETRY_BASE_MS = 30_000
const RETRY_MAX_MS = 10 * 60_000

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
/** Failed paths: how many times in a row, and when they may be read again. */
const failures = new Map<string, { count: number; retryAt: number }>()

/* A small queue: urgent reads (lists on screen) go before background ones. */
interface Waiter {
  path: string
  start: () => void
}
let inFlight = 0
const urgentQueue: Waiter[] = []
const backgroundQueue: Waiter[] = []

const takeSlot = (path: string, urgent: boolean): Promise<void> =>
  new Promise((resolve) => {
    const start = () => {
      inFlight += 1
      resolve()
    }
    if (inFlight < MAX_IN_FLIGHT) start()
    else (urgent ? urgentQueue : backgroundQueue).push({ path, start })
  })

const releaseSlot = () => {
  inFlight -= 1
  ;(urgentQueue.shift() ?? backgroundQueue.shift())?.start()
}

/** A queued background read becomes urgent: a list on screen waits for it. */
const promote = (path: string) => {
  const index = backgroundQueue.findIndex((waiter) => waiter.path === path)
  if (index >= 0) urgentQueue.push(...backgroundQueue.splice(index, 1))
}

const read = async (path: string): Promise<RegistryMetadata | null> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(parseIpfs(`/ipfs/${path}`), {
      signal: controller.signal,
    })
    // A server error, a gateway timeout or rate limiting may pass: throw so it
    // is retried (with backoff) instead of reading as "no metadata".
    if (
      response.status >= 500 ||
      response.status === 408 ||
      response.status === 429
    )
      throw new Error(`Gateway ${response.status}`)
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
 * the gateway did not answer, so callers can retry, and at once while a
 * failed path waits out its pause. Answers are kept for the session. At most
 * MAX_IN_FLIGHT reads run at once; `urgent` ones (a list on screen) go first.
 */
export const readRegistryMetadata = async (
  uri?: string | null,
  { urgent = false }: { urgent?: boolean } = {},
): Promise<RegistryMetadata | null> => {
  const path = ipfsPath(uri)
  if (!path) return null
  if (settled.has(path)) return settled.get(path) ?? null
  const running = pending.get(path)
  if (running) {
    if (urgent) promote(path)
    return running
  }
  const failure = failures.get(path)
  if (failure && Date.now() < failure.retryAt)
    throw new Error('MetaEvidence read failed recently; trying again later')

  const request = (async () => {
    await takeSlot(path, urgent)
    try {
      return await read(path)
    } finally {
      releaseSlot()
    }
  })()
    .then(
      (result) => {
        settled.set(path, result)
        failures.delete(path)
        return result
      },
      (err: unknown) => {
        const count = (failures.get(path)?.count ?? 0) + 1
        failures.set(path, {
          count,
          retryAt:
            Date.now() +
            Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (count - 1)),
        })
        throw err
      },
    )
    .finally(() => pending.delete(path))
  pending.set(path, request)
  return request
}
