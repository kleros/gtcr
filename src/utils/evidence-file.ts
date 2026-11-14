/*
 * An evidence file read straight from IPFS, when the indexer could not read
 * it (it rejects files whose fields are not strings). Anyone can submit
 * evidence while a request is open, so only string fields are kept: a number
 * or an object would reach the timeline as text to split or to render, and
 * take the whole entry page down for everyone.
 */

export interface EvidenceFileFields {
  title: string | null
  description: string | null
  fileURI: string | null
  fileTypeExtension: string | null
}

const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : null

export const evidenceFileFields = (file: unknown): EvidenceFileFields => {
  const raw =
    file && typeof file === 'object' ? (file as Record<string, unknown>) : {}
  return {
    title: text(raw.title),
    description: text(raw.description),
    fileURI: text(raw.fileURI),
    fileTypeExtension: text(raw.fileTypeExtension),
  }
}
