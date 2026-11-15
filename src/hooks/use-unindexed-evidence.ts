import { useEffect, useMemo, useState } from 'react'
import {
  evidenceFileFields,
  type EvidenceFileFields,
} from 'utils/evidence-file'
import { parseIpfs } from 'utils/ipfs-parse'
import {
  getAllowedAttachmentUrl,
  isSafeNavigationUrl,
} from 'utils/url-validation'

/*
 * Evidence files the indexer could not read, read straight from IPFS for an
 * entry's history. The entry pages re-render every second: the files are
 * asked for once per set, each gets 15 seconds, and a file that does not
 * come back is kept as failed. Asked for again on every render, one missing
 * or hanging file used to send the whole set to the gateway every second
 * for as long as the page stayed open, while its row stayed empty.
 */

/** An evidence file read from IPFS, or one that could not be read. */
export interface UnindexedEvidence extends EvidenceFileFields {
  /** Missing, not JSON, not on the gateway, or no answer in time. */
  failed: boolean
}

const TIMEOUT_MS = 15_000

const FAILED: UnindexedEvidence = {
  title: null,
  description: null,
  fileURI: null,
  fileTypeExtension: null,
  failed: true,
}

/**
 * Where an evidence file is read from: a path or an ipfs:// URI through the
 * gateway. Some tools store the full gateway URL: it is read as it is, since
 * the gateway put in front of it again answers with a redirect, not the
 * file. Any other full URL is not read: evidence is written by anyone, and
 * every visitor's browser would call the host it names.
 */
export const evidenceFileUrl = (uri: string): string | undefined =>
  /^[a-z][\d+.a-z-]*:/i.test(uri) && !/^ipfs:/i.test(uri)
    ? getAllowedAttachmentUrl(uri)
    : parseIpfs(uri)

/**
 * Where a reader can open the file: where it is read from, or a full https
 * URL as stored (the link asks before leaving the site).
 */
export const evidenceFileHref = (uri: string): string | undefined =>
  evidenceFileUrl(uri) ?? (isSafeNavigationUrl(uri) ? uri : undefined)

/** Reads each file once; a file that fails is marked as failed. */
export const readUnindexedEvidence = async (
  uris: string[],
  signal: AbortSignal,
): Promise<Map<string, UnindexedEvidence>> => {
  const results = await Promise.allSettled(
    uris.map(async (uri) => {
      const url = evidenceFileUrl(uri)
      if (!url) throw new Error('Not a file on the IPFS gateway')
      const response = await fetch(url, { signal })
      if (!response.ok)
        throw new Error(`The gateway answered ${response.status}`)
      return evidenceFileFields(await response.json())
    }),
  )
  const files = new Map<string, UnindexedEvidence>()
  results.forEach((result, index) => {
    if (result.status === 'fulfilled')
      files.set(uris[index], { ...result.value, failed: false })
    else {
      console.error(
        'Could not load unindexed evidence',
        uris[index],
        result.reason,
      )
      files.set(uris[index], FAILED)
    }
  })
  return files
}

/**
 * The files of `uris` (evidence the indexer left without fields), by URI.
 * A file still loading is not in the map yet.
 */
const useUnindexedEvidence = (
  uris: string[],
): ReadonlyMap<string, UnindexedEvidence> => {
  // The list is new on every render; only its contents count.
  const key = JSON.stringify([...new Set(uris)])
  const [files, setFiles] = useState<ReadonlyMap<string, UnindexedEvidence>>(
    () => new Map(),
  )

  useEffect(() => {
    const list = JSON.parse(key) as string[]
    if (list.length === 0) return
    let current = true
    const controller = new AbortController()
    // The files are asked for together, so each one gets these 15 seconds.
    // The timer also ends a request still hanging after the page has moved on.
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
    void (async () => {
      const read = await readUnindexedEvidence(list, controller.signal)
      window.clearTimeout(timer)
      if (current) setFiles(read)
    })()
    return () => {
      current = false
    }
  }, [key])

  // This set's files only: a file the indexer has read since then gives way
  // to the indexer's fields.
  return useMemo(() => {
    const own = new Map<string, UnindexedEvidence>()
    for (const uri of JSON.parse(key) as string[]) {
      const file = files.get(uri)
      if (file) own.set(uri, file)
    }
    return own
  }, [files, key])
}

export default useUnindexedEvidence
