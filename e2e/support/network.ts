/*
 * Every request the app under test makes to a service, answered from
 * e2e/recordings, so the browser tests run the same on every machine, need
 * no keys, and never spend the indexers' shared request budget.
 *
 * The test build (e2e/build.mjs) names each service by a placeholder URL
 * from e2e/e2e.env. A request is filed under the variable that names its
 * service (REACT_APP_SUBGRAPH_GNOSIS, ipfs, font; a public RPC under its
 * host, rpc:rpc.gnosischain.com) and what it asks (the GraphQL query and
 * variables, the JSON-RPC method and params, the path), never under a full
 * URL, so a recording holds no key.
 *
 * `yarn test:e2e:record` (E2E_RECORD=1) sends each request to the real
 * service your .env names for the same variable instead, keeps the answer,
 * and writes them all to e2e/recordings when the run ends. While it records,
 * every list in an indexer's answer is cut to MAX_ROWS rows before the app
 * sees it: pages then follow every code path on a few rows each, ask for no
 * second page, and the recordings stay small. Record the whole suite at
 * once: every test's browser clock starts at the time of the recording
 * (time windows are part of the queries), so a partial recording would not
 * match the rest.
 *
 * Batches are split: the Standard indexer takes many queries in one request,
 * grouped by timing (utils/indexer-request.ts), so each query is kept and
 * answered on its own and a batch's answer is assembled in the order asked.
 * JSON-RPC calls are keyed without their `id`, which depends on order.
 */
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { BrowserContext, Route } from '@playwright/test'
import { readEnvFile } from './env-file.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const STORE_FILE = path.join(ROOT, 'e2e/recordings/network.json.gz')
const META_FILE = path.join(ROOT, 'e2e/recordings/meta.json')

export const RECORDING = !!process.env.E2E_RECORD

const DAY_MS = 24 * 3600 * 1000

/** The longest list an indexer answer keeps while recording. */
const MAX_ROWS = 25

interface Entry {
  /** What was asked, for a person reading a miss: never a URL. */
  ask: string
  status: number
  type: string
  /** Text, or base64 when `base64` is set. */
  body: string
  base64?: boolean
}

interface Meta {
  /** The browser clock of every test (ms since epoch). */
  recordedAt: number
  entries: number
}

const placeholders = readEnvFile(path.join(ROOT, 'e2e/e2e.env')) as Record<
  string,
  string
>
const real = (RECORDING ? readEnvFile(path.join(ROOT, '.env')) : {}) as Record<
  string,
  string
>

/** Variables whose value is a service URL the app calls (GraphQL, APIs). */
const URL_SERVICES = Object.entries(placeholders)
  .filter(
    ([key, value]) =>
      /^https?:\/\//.test(value) && key !== 'REACT_APP_IPFS_GATEWAY',
  )
  .sort(([, a], [, b]) => b.length - a.length)

const IPFS_HOST = new URL(placeholders.REACT_APP_IPFS_GATEWAY).host
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])
/** Wallet-kit telemetry and remote config: refused, as an offline browser. */
const REFUSED_HOSTS =
  /(^|\.)(walletconnect\.(org|com)|web3modal\.(org|com)|reown\.com|coinbase\.com)$/
/**
 * Fixed hosts the app reads files from, recorded by path: Kleros's rewards
 * site, whose index the dashboard reads (pages/dashboard/rewards.ts).
 */
const PLAIN_HOSTS = new Set(['rewards.kleros.io'])

type Service =
  | { kind: 'url'; name: string; prefix: string }
  | { kind: 'rpc' | 'ipfs' | 'font' | 'refused' | 'plain'; name: string }

/** A JSON-RPC request: one call, or a batch of them. */
const isJsonRpc = (body: string | null) =>
  !!body && /^\s*[[{]/.test(body) && /"(jsonrpc|method)"\s*:/.test(body)

const serviceOf = (url: URL, body: string | null): Service | undefined => {
  const href = url.href
  for (const [name, prefix] of URL_SERVICES)
    if (
      href === prefix ||
      href.startsWith(`${prefix}/`) ||
      href.startsWith(`${prefix}?`)
    )
      return { kind: 'url', name, prefix }
  if (url.host === IPFS_HOST) return { kind: 'ipfs', name: 'ipfs' }
  if (FONT_HOSTS.has(url.hostname)) return { kind: 'font', name: 'font' }
  if (PLAIN_HOSTS.has(url.hostname))
    return { kind: 'plain', name: url.hostname }
  if (REFUSED_HOSTS.test(url.hostname))
    return { kind: 'refused', name: url.hostname }
  // The build has no Alchemy key, so its chain reads go to public RPCs
  // (config/chains.ts, utils/fetch-policy-history.ts' fallbacks): each is
  // recorded from the very host the app asked, as a key-less site reads.
  if (isJsonRpc(body)) return { kind: 'rpc', name: `rpc:${url.host}` }
  return undefined
}

/** Where a recording run sends a request: the real service's URL. */
const realUrl = (url: URL, service: Service): string => {
  if (service.kind === 'url') {
    const base = real[service.name]
    if (!base)
      throw new Error(
        `Recording needs ${service.name} in your .env (the real service).`,
      )
    return base + url.href.slice(service.prefix.length)
  }
  if (service.kind === 'ipfs' && real.REACT_APP_IPFS_GATEWAY)
    return real.REACT_APP_IPFS_GATEWAY + url.pathname + url.search
  return url.href
}

/* ---------- Keys ---------- */

/** Locale-free order, so a key is the same on every machine. */
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort(byCodeUnit)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`
  return JSON.stringify(value)
}

const hash = (text: string) =>
  createHash('sha256').update(text).digest('hex').slice(0, 32)

interface GraphqlAsk {
  query: string
  variables?: unknown
  operationName?: string
}

const graphqlKey = (service: string, ask: GraphqlAsk) =>
  hash(
    `${service}\n${ask.query.replace(/\s+/g, ' ').trim()}\n${canonical(ask.variables ?? {})}\n${ask.operationName ?? ''}`,
  )

const graphqlName = (ask: GraphqlAsk) =>
  ask.operationName ??
  /\b(?:query|mutation)\s+(\w+)/.exec(ask.query)?.[1] ??
  ask.query.replace(/\s+/g, ' ').trim().slice(0, 60)

interface RpcCall {
  jsonrpc?: string
  id?: number | string
  method: string
  params?: unknown
}

const rpcKey = (service: string, call: RpcCall) =>
  hash(`${service}\n${call.method}\n${canonical(call.params ?? [])}`)

/* ---------- Answers that are never recorded ---------- */

/** A 1×1 transparent PNG: every picture, logo and cover. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)
const TINY_PDF = '%PDF-1.4\n%%EOF\n'
const isPicture = (url: URL) =>
  /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(url.pathname)
const isDocument = (url: URL) =>
  /\.(pdf|mp4|webm|mov|mp3|wav|zip)$/i.test(url.pathname)

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

/* ---------- Indexer answers, cut while recording ---------- */

const cutRows = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.slice(0, MAX_ROWS).map(cutRows)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, cutRows(inner)]),
    )
  return value
}

const cutAnswer = (answer: unknown): unknown =>
  answer && typeof answer === 'object' && 'data' in answer
    ? { ...answer, data: cutRows((answer as { data: unknown }).data) }
    : answer

/* ---------- The store ---------- */

const readStore = (): Record<string, Entry> =>
  existsSync(STORE_FILE)
    ? (JSON.parse(
        gunzipSync(new Uint8Array(readFileSync(STORE_FILE))).toString('utf8'),
      ) as Record<string, Entry>)
    : {}

/** Each request a recording run sends, with its time: e2e/record.log. */
const logForward = (line: string, always = false) => {
  if (!RECORDING && !always) return
  mkdirSync(path.join(ROOT, 'e2e'), { recursive: true })
  appendFileSync(path.join(ROOT, 'e2e/record.log'), `${line}\n`)
}

const writeMeta = (meta: Meta) => {
  mkdirSync(path.dirname(META_FILE), { recursive: true })
  writeFileSync(META_FILE, `${JSON.stringify(meta, null, 2)}\n`)
}

/**
 * Starts a recording run (support/global-setup.ts): an empty store and the
 * one time every test of the run sees. Each worker then adds to the store,
 * so one that Playwright restarts after a failure loses nothing.
 */
export const startRecording = () => {
  // E2E_RECORD=add keeps the store and its time, to record a new spec while
  // writing it; the recordings that ship come from one full fresh run.
  if (process.env.E2E_RECORD === 'add' && existsSync(META_FILE)) return
  if (existsSync(STORE_FILE)) writeFileSync(STORE_FILE, new Uint8Array())
  // Clear of a UTC midnight, so no test's clock crosses into another day
  // (the dashboard's 30-day window starts at a day boundary).
  const now = Date.now()
  const toMidnight = DAY_MS - (now % DAY_MS)
  const recordedAt = toMidnight < 15 * 60_000 ? now - 15 * 60_000 : now
  writeMeta({ recordedAt, entries: 0 })
}

export class Recordings {
  readonly entries: Record<string, Entry>
  readonly recordedAt: number
  private changed = false

  constructor() {
    if (!existsSync(META_FILE) || (!RECORDING && !existsSync(STORE_FILE)))
      throw new Error(
        'No recordings in e2e/recordings: run `yarn test:e2e:record` once (needs a .env with the real services).',
      )
    this.recordedAt = (
      JSON.parse(readFileSync(META_FILE, 'utf8')) as Meta
    ).recordedAt
    const hasStore =
      existsSync(STORE_FILE) && readFileSync(STORE_FILE).length > 0
    this.entries = hasStore ? readStore() : {}
  }

  keep(key: string, entry: Entry) {
    this.entries[key] = entry
    this.changed = true
  }

  save() {
    if (!RECORDING || !this.changed) return
    mkdirSync(path.dirname(STORE_FILE), { recursive: true })
    // Sorted, so a re-recording of the same answers writes the same file.
    const sorted = Object.fromEntries(
      Object.keys(this.entries)
        .sort(byCodeUnit)
        .map((key) => [key, this.entries[key]]),
    )
    writeFileSync(
      STORE_FILE,
      new Uint8Array(gzipSync(JSON.stringify(sorted), { level: 9 })),
    )
    writeMeta({
      recordedAt: this.recordedAt,
      entries: Object.keys(sorted).length,
    })
  }
}

/* ---------- The router ---------- */

export interface Traffic {
  /** Requests with no recording: re-record. */
  misses: string[]
  /** Requests to a host the router does not know: add it or refuse it. */
  unknown: string[]
  /** Requests being answered now, and when the last one began or ended. */
  pending: number
  lastActivity: number
}

/**
 * Until no request has been in flight for `quietMs` (at most `maxMs`):
 * how a test ends in both modes, so a read a debounce or a timer starts
 * late (a cost read behind a one-second debounce) is recorded, and the
 * replay checks the same set of requests every time. Playwright's
 * networkidle cannot do this: once a page reached it, it resolves at once.
 */
export const settle = async (
  traffic: Traffic,
  quietMs = 1500,
  maxMs = 30_000,
) => {
  const until = Date.now() + maxMs
  while (Date.now() < until) {
    if (traffic.pending === 0 && Date.now() - traffic.lastActivity >= quietMs)
      return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

const fulfillJson = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export const routeNetwork = async (
  context: BrowserContext,
  recordings: Recordings,
  appOrigin: string,
): Promise<Traffic> => {
  const traffic: Traffic = {
    misses: [],
    unknown: [],
    pending: 0,
    lastActivity: Date.now(),
  }

  const forward = async (
    route: Route,
    target: string,
    body?: string,
    // A wide log scan on a public RPC can take a minute (the policy history).
    timeout = 30_000,
  ) => {
    const request = route.request()
    const started = Date.now()
    const host = new URL(target).host
    try {
      const response = await route.fetch({
        url: target,
        method: request.method(),
        headers: {
          'content-type':
            request.headers()['content-type'] ?? 'application/json',
          accept: request.headers().accept ?? '*/*',
        },
        postData: body ?? request.postData() ?? undefined,
        // A public endpoint that hangs is a failed read, not a stalled run.
        timeout,
      })
      logForward(`${Date.now() - started}ms ${response.status()} ${host}`)
      return response
    } catch (err) {
      logForward(
        `${Date.now() - started}ms failed ${host}: ${String(err).slice(0, 120)}`,
      )
      throw err
    }
  }

  /*
   * Recording and replay answer from the same store; a recording run only
   * goes to the network for what nobody has asked yet. So a question asked
   * twice gets the same answer both times while recording, as in replay
   * (eth_blockNumber once moved on between two log scans, and the replay
   * then asked for a range nobody had recorded).
   *
   * Only clean answers are kept: no HTTP error, no GraphQL `errors`, no
   * rate limit. A failure while recording reaches the app but is not kept,
   * so the replay reports it as missing instead of baking it in.
   */

  const answerGraphql = async (
    route: Route,
    service: Extract<Service, { kind: 'url' }>,
    url: URL,
  ) => {
    const payload = JSON.parse(route.request().postData() ?? 'null') as
      | GraphqlAsk
      | GraphqlAsk[]
    const batch = Array.isArray(payload)
    const asks = batch ? payload : [payload]
    const keys = asks.map((ask) => graphqlKey(service.name, ask))
    const answers: unknown[] = keys.map((key) =>
      recordings.entries[key]
        ? (JSON.parse(recordings.entries[key].body) as unknown)
        : undefined,
    )

    const unanswered = answers.flatMap((answer, index) =>
      answer === undefined ? [index] : [],
    )
    if (RECORDING && unanswered.length > 0) {
      const sent = unanswered.map((index) => asks[index])
      const response = await forward(
        route,
        realUrl(url, service),
        JSON.stringify(batch ? sent : sent[0]),
      )
      const status = response.status()
      const parsed = (await response.json().catch(() => null)) as unknown
      const got = batch ? (parsed as unknown[] | null) : [parsed]
      unanswered.forEach((index, at) => {
        const answer = cutAnswer(got?.[at])
        const clean =
          status === 200 &&
          !!answer &&
          typeof answer === 'object' &&
          'data' in answer &&
          !('errors' in answer)
        if (clean)
          recordings.keep(keys[index], {
            ask: `${service.name} ${graphqlName(asks[index])}`,
            status: 200,
            type: 'application/json',
            body: JSON.stringify(answer),
          })
        else
          console.warn(
            `[e2e record] ${service.name} ${graphqlName(asks[index])}: HTTP ${status}, not kept`,
          )
        answers[index] = answer ?? {
          errors: [{ message: `e2e: HTTP ${status} while recording` }],
        }
      })
    }

    const replies = answers.map((answer, index) => {
      if (answer !== undefined) return answer
      traffic.misses.push(`${service.name} ${graphqlName(asks[index])}`)
      return { errors: [{ message: 'e2e: this query was not recorded' }] }
    })
    return fulfillJson(route, 200, batch ? replies : replies[0])
  }

  /*
   * An RPC refusing a request is kept when it is the RPC's fixed answer: a
   * public endpoint's range cap ("ranges over 100 blocks are not supported
   * on free plan", "Maximum allowed number of requested blocks is 1000")
   * is what a key-less site always gets, and the app answers it by
   * scanning in chunks. Being throttled is not kept.
   */
  const THROTTLED =
    /rate.?limit|too many requests|capacity|try again|temporarily|overloaded/i

  const answerRpc = async (route: Route, service: Service, url: URL) => {
    const payload = JSON.parse(route.request().postData() ?? 'null') as
      | RpcCall
      | RpcCall[]
    const calls = Array.isArray(payload) ? payload : [payload]
    const replies = []
    let status = 200
    for (const call of calls) {
      const key = rpcKey(service.name, call)
      // An eth_call names its contract and function, so a miss says which.
      const target = (call.params as { to?: string; data?: string }[])?.[0]
      const ask =
        call.method === 'eth_call' && target?.to
          ? `${service.name} eth_call ${target.to.slice(0, 10)}… ${target.data?.slice(0, 10) ?? ''}`
          : `${service.name} ${call.method}`
      const entry = recordings.entries[key]
      let outcome = entry ? (JSON.parse(entry.body) as object) : undefined
      let callStatus = entry?.status ?? 200
      if (!outcome && RECORDING) {
        // One call at a time, to the very endpoint the app asked.
        const response = await forward(
          route,
          realUrl(url, service),
          JSON.stringify({ ...call, jsonrpc: '2.0', id: 1 }),
          call.method === 'eth_getLogs' ? 90_000 : 30_000,
        ).catch(() => null)
        const reply = (await response?.json().catch(() => null)) as {
          result?: unknown
          error?: { message?: string; code?: number }
        } | null
        if (reply && 'result' in reply) outcome = { result: reply.result }
        else if (reply?.error) outcome = { error: reply.error }
        callStatus = response?.status() ?? 0
        const throttled =
          !response ||
          callStatus === 429 ||
          callStatus >= 500 ||
          THROTTLED.test(reply?.error?.message ?? '')
        if (outcome && !throttled)
          recordings.keep(key, {
            ask,
            status: callStatus,
            type: 'application/json',
            body: JSON.stringify(outcome),
          })
        else
          console.warn(
            `[e2e record] ${ask}: HTTP ${callStatus || 'failed'} ${JSON.stringify(reply?.error ?? null).slice(0, 160)}, not kept`,
          )
      }
      if (!outcome && !RECORDING) {
        traffic.misses.push(ask)
        if (process.env.E2E_DEBUG)
          logForward(
            `miss ${ask} ${canonical(call.params).slice(0, 400)}`,
            true,
          )
      }
      status = callStatus || 502
      replies.push({
        jsonrpc: '2.0',
        id: call.id,
        ...(outcome ?? {
          error: { code: -32603, message: 'e2e: this call was not recorded' },
        }),
      })
    }
    // One call keeps the endpoint's own status (drpc refuses with a 400).
    return Array.isArray(payload)
      ? fulfillJson(route, 200, replies)
      : fulfillJson(route, status, replies[0])
  }

  /** IPFS files, court functions, fonts: by method, path and body. */
  const answerPlain = async (route: Route, service: Service, url: URL) => {
    const request = route.request()
    const key = hash(
      `${service.name}\n${request.method()}\n${url.pathname}${url.search}\n${request.postData() ?? ''}`,
    )
    const ask = `${service.name} ${request.method()} ${url.pathname.slice(0, 80)}`

    if (!recordings.entries[key] && RECORDING) {
      const response = await forward(route, realUrl(url, service))
      let type = response.headers()['content-type'] ?? ''
      let bytes = await response.body()
      // A picture or a document with no extension in its path (most IPFS
      // logos) is known by its type: kept and shown as the stand-in, as
      // those with one are, so a recording holds no file of a megabyte.
      if (response.status() === 200 && /^(image|video|audio)\//.test(type)) {
        type = 'image/png'
        bytes = PIXEL
      } else if (response.status() === 200 && /application\/pdf/.test(type))
        bytes = Buffer.from(TINY_PDF)
      const text = /json|text|css|javascript|xml/.test(type)
      // A 404 is an answer (a missing file); a 5xx or 429 is not.
      if (response.status() < 500 && response.status() !== 429)
        recordings.keep(key, {
          ask,
          status: response.status(),
          type,
          body: text ? bytes.toString('utf8') : bytes.toString('base64'),
          base64: text ? undefined : true,
        })
      else
        console.warn(`[e2e record] ${ask}: HTTP ${response.status()}, not kept`)
      return route.fulfill({
        status: response.status(),
        headers: { ...CORS, 'content-type': type },
        body: bytes,
      })
    }

    const entry = recordings.entries[key]
    if (!entry) {
      traffic.misses.push(ask)
      return route.fulfill({ status: 404, headers: CORS, body: '' })
    }
    return route.fulfill({
      status: entry.status,
      headers: { ...CORS, 'content-type': entry.type },
      body: entry.base64 ? Buffer.from(entry.body, 'base64') : entry.body,
    })
  }

  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === appOrigin || url.protocol === 'data:')
      return route.continue()
    if (request.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS })

    const service = serviceOf(url, request.postData())
    traffic.pending += 1
    traffic.lastActivity = Date.now()
    try {
      if (!service) {
        traffic.unknown.push(`${request.method()} ${url.host}`)
        return await route.abort('blockedbyclient')
      }
      if (service.kind === 'refused')
        return await route.abort('internetdisconnected')
      if (service.kind === 'ipfs' && isPicture(url))
        return await route.fulfill({
          status: 200,
          headers: { ...CORS, 'content-type': 'image/png' },
          body: PIXEL,
        })
      if (service.kind === 'ipfs' && isDocument(url))
        return await route.fulfill({
          status: 200,
          headers: { ...CORS, 'content-type': 'application/pdf' },
          body: TINY_PDF,
        })
      if (service.kind === 'rpc') return await answerRpc(route, service, url)
      if (
        service.kind === 'url' &&
        request.method() === 'POST' &&
        /query/.test(request.postData() ?? '')
      )
        return await answerGraphql(route, service, url)
      return await answerPlain(route, service, url)
    } catch (err) {
      // The page went away mid-request, or a recording read failed.
      if (!/closed|disposed|Target page/i.test(String(err)))
        traffic.misses.push(`${service?.name ?? url.host}: ${String(err)}`)
      return route.abort('failed').catch(() => undefined)
    } finally {
      traffic.pending -= 1
      traffic.lastActivity = Date.now()
    }
  })

  // Wallet-kit sockets: refused like their HTTP calls.
  await context.routeWebSocket(/.*/, (socket) => socket.close())

  return traffic
}
