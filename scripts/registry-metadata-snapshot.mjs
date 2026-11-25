// Reads every Standard list's registration MetaEvidence once and writes the
// list metadata snapshot that utils/registry-metadata.ts ships with: the
// title, description and logo of each file, by its IPFS path. A path is the
// address of its content, so an entry can never go stale; a browser reads
// from IPFS only the files added since (new lists, new policies). Run it now
// and then (e.g. before a release):
//   node scripts/registry-metadata-snapshot.mjs
// It reads the indexer and gateway URLs from the repo's .env and writes
// src/config/registry-metadata-snapshot.json; both paths are fixed, relative
// to this script. Only files the gateway served are kept: a missing file may
// still appear, so the app keeps asking for it.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** CIDv0 (Qm…, base58) or CIDv1 in base32 (b…), as in the app. */
const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/

/**
 * The IPFS path ("<cid>/file.json") a MetaEvidence URI points at, or null:
 * ipfsPath in src/utils/registry-metadata.ts, which looks entries up by it.
 */
export const ipfsPath = (uri) => {
  if (!uri) return null
  const path = uri
    .trim()
    .replace(/^https?:\/\/[^/]+\/ipfs\//i, '')
    .replace(/^ipfs:\/\//i, '')
    .replace(/^\/?ipfs\//i, '')
  return CID.test(path.split('/')[0]) ? path : null
}

const text = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

/**
 * A list's title, description and logo from its MetaEvidence file: the
 * reading of metadataFromFile in src/utils/registry-metadata.ts
 * (registry-metadata.test.ts holds the two to the same answers).
 */
export const metadataFromFile = (file) => {
  const evidence = file?.data ?? file ?? {}
  const metadata = evidence?.metadata ?? file?.metadata ?? {}
  const title = text(
    metadata.tcrTitle ||
      metadata.title ||
      evidence.tcrTitle ||
      evidence.registryTitle,
  )
  return {
    title: title && title !== '-' ? title : undefined,
    description: text(
      metadata.tcrDescription ||
        metadata.description ||
        evidence.tcrDescription ||
        evidence.description,
    ),
    logoURI: text(metadata.logoURI || metadata.logo || evidence.logoURI),
  }
}

const LISTS = `
  query Lists($offset: Int!) {
    LRegistry(limit: 1000, offset: $offset, order_by: { id: asc }) {
      id
      registrationMetaEvidence {
        uri
      }
    }
  }
`

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const envValue = (env, name) =>
  (env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')

/** Every Standard list's registration MetaEvidence URI (one indexer serves every chain). */
const readUris = async (indexer) => {
  const uris = new Set()
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(indexer, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: LISTS, variables: { offset } }),
    })
    const reply = await response.json()
    if (!response.ok || reply.errors)
      throw new Error(
        `Indexer: ${JSON.stringify(reply.errors ?? response.status)}`,
      )
    const rows = reply.data.LRegistry
    for (const row of rows) {
      const uri = row.registrationMetaEvidence?.uri
      if (uri) uris.add(uri)
    }
    if (rows.length < 1000) return [...uris]
  }
}

/**
 * One file: its metadata, null when it holds no JSON (a content address
 * that is not JSON never will be), undefined when the gateway did not serve
 * it (left out, so the app asks again).
 */
const readFile = async (gateway, path) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${gateway}/ipfs/${path}`, {
        signal: AbortSignal.timeout(20_000),
      })
      if (response.status >= 500 || response.status === 429) {
        await sleep(1000 * (attempt + 1))
        continue
      }
      if (!response.ok) return undefined
      const body = await response.text()
      try {
        return metadataFromFile(JSON.parse(body))
      } catch {
        return null
      }
    } catch {
      await sleep(1000 * (attempt + 1))
    }
  }
  return undefined
}

/** Drops the fields a file did not have, as JSON would. */
const compact = (metadata) =>
  metadata &&
  Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  )

const main = async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const output = resolve(root, 'src/config/registry-metadata-snapshot.json')
  const env = readFileSync(resolve(root, '.env'), 'utf8')
  const indexer = envValue(env, 'REACT_APP_SUBGRAPH_GNOSIS')
  const gateway = envValue(env, 'REACT_APP_IPFS_GATEWAY').replace(/\/+$/, '')
  if (!indexer || !gateway)
    throw new Error(
      'No REACT_APP_SUBGRAPH_GNOSIS or REACT_APP_IPFS_GATEWAY in .env',
    )

  const paths = [
    ...new Set((await readUris(indexer)).map(ipfsPath).filter(Boolean)),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  console.log(`${paths.length} MetaEvidence files`)

  const files = {}
  let missing = 0
  for (let i = 0; i < paths.length; i += 6) {
    const slice = paths.slice(i, i + 6)
    const read = await Promise.all(slice.map((path) => readFile(gateway, path)))
    read.forEach((metadata, index) => {
      if (metadata === undefined) missing += 1
      else files[slice[index]] = compact(metadata)
    })
  }
  writeFileSync(output, `${JSON.stringify({ files }, null, 2)}\n`)
  console.log(
    `wrote ${Object.keys(files).length} files to ${output}` +
      (missing ? ` (${missing} not served, left out)` : ''),
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
