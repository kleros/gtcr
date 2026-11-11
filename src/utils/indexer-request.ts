import { print } from 'graphql'
import {
  request as sendOne,
  type RequestDocument,
  type Variables,
} from 'graphql-request'
import { subgraphUrl } from 'config/tcr-addresses'

/*
 * Reads from the indexers, sent together where the indexer allows it.
 *
 * The hosted Envio indexer (Light and Classic lists, every chain behind one
 * URL) counts HTTP requests against a per-minute limit for the whole app:
 * the plan's query rate, 250 a minute when this was written (it says so in
 * the x-ratelimit-* headers of its answers). It also takes several queries
 * in one request, an array in and an array out, and counts that once. A page
 * that mounts asks its queries within a few milliseconds of each other, so
 * every query asked within BATCH_WINDOW_MS goes out as one request, and each
 * caller still gets its own answer or its own error.
 *
 * When the indexer refuses or cannot be reached, the next requests wait a
 * moment (longer each time, up to BACKOFF_MAX_MS) instead of being retried
 * at once by every query on the page: retries spend the same shared limit.
 *
 * Other endpoints (the Stake subgraphs, Seer) do not take arrays; their
 * queries are sent one by one, as graphql-request does.
 */

const BATCH_WINDOW_MS = 12
const BATCH_MAX = 12
const BACKOFF_START_MS = 1_000
const BACKOFF_MAX_MS = 30_000

interface RequestOptions {
  url: string
  document: RequestDocument
  variables?: Variables
  signal?: AbortSignal
}

interface Pending {
  /** Query and variables as text: identical reads share one slot. */
  key: string
  query: string
  variables?: Variables
  resolve: (data: unknown) => void
  reject: (error: unknown) => void
}

interface Queue {
  items: Pending[]
  timer?: number
  /** No request leaves before this time (after a refusal). */
  pausedUntil: number
  backoff: number
}

/** The indexer answered, but with an error for this query or this request. */
export class IndexerError extends Error {
  status?: number
  errors?: unknown
  constructor(message: string, detail?: { status?: number; errors?: unknown }) {
    super(message)
    this.name = 'IndexerError'
    this.status = detail?.status
    this.errors = detail?.errors
  }
}

const batchingUrls = new Set(
  Object.values(subgraphUrl).filter((url): url is string => !!url),
)

const queues = new Map<string, Queue>()

const queueFor = (url: string): Queue => {
  let queue = queues.get(url)
  if (!queue) {
    queue = { items: [], pausedUntil: 0, backoff: 0 }
    queues.set(url, queue)
  }
  return queue
}

const abortError = () =>
  new DOMException('The operation was aborted.', 'AbortError')

const schedule = (url: string, queue: Queue, delay: number) => {
  if (queue.timer !== undefined) return
  const wait = Math.max(delay, queue.pausedUntil - Date.now())
  queue.timer = window.setTimeout(() => {
    queue.timer = undefined
    void flush(url, queue)
  }, wait)
}

const flush = async (url: string, queue: Queue) => {
  const batch = queue.items.splice(0, BATCH_MAX)
  if (queue.items.length > 0) schedule(url, queue, 0)
  if (batch.length === 0) return

  // Identical reads (two components asking the same thing) travel once.
  const slots = new Map<string, Pending[]>()
  for (const item of batch) {
    const slot = slots.get(item.key)
    if (slot) slot.push(item)
    else slots.set(item.key, [item])
  }
  const groups = [...slots.values()]

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(
        groups.map(([first]) => ({
          query: first.query,
          variables: first.variables,
        })),
      ),
    })
    if (!response.ok)
      throw new IndexerError(`The indexer answered ${response.status}.`, {
        status: response.status,
      })
    const answers: unknown = await response.json()
    if (!Array.isArray(answers) || answers.length !== groups.length)
      throw new IndexerError('The indexer answered in an unexpected shape.')

    queue.backoff = 0
    groups.forEach((group, index) => {
      const answer = answers[index] as {
        data?: unknown
        errors?: { message?: string }[]
      } | null
      if (answer?.errors?.length || answer?.data === undefined) {
        const error = new IndexerError(
          answer?.errors?.[0]?.message ?? 'The indexer returned no data.',
          { errors: answer?.errors },
        )
        for (const item of group) item.reject(error)
      } else for (const item of group) item.resolve(answer.data)
    })
  } catch (err) {
    // Refused (rate limit, which browsers report as a failed fetch) or
    // unreachable: hold the next requests back before asking again.
    queue.backoff = Math.min(
      BACKOFF_MAX_MS,
      queue.backoff ? queue.backoff * 2 : BACKOFF_START_MS,
    )
    queue.pausedUntil = Date.now() + queue.backoff
    for (const group of groups) for (const item of group) item.reject(err)
  }
}

const enqueue = <T>({
  url,
  document,
  variables,
  signal,
}: RequestOptions): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const query =
      typeof document === 'string' || document instanceof String
        ? document.toString()
        : print(document)
    const queue = queueFor(url)
    const item: Pending = {
      key: `${query}\n${JSON.stringify(variables ?? {})}`,
      query,
      variables,
      resolve: resolve as (data: unknown) => void,
      reject,
    }
    // A caller that gives up stops waiting; the request itself may still
    // carry other callers' queries.
    signal?.addEventListener(
      'abort',
      () => {
        const index = queue.items.indexOf(item)
        if (index !== -1) queue.items.splice(index, 1)
        reject(abortError())
      },
      { once: true },
    )
    queue.items.push(item)
    if (queue.items.length >= BATCH_MAX && queue.pausedUntil <= Date.now()) {
      window.clearTimeout(queue.timer)
      queue.timer = undefined
      void flush(url, queue)
    } else schedule(url, queue, BATCH_WINDOW_MS)
  })

/**
 * A GraphQL read, with graphql-request's two call forms (and its untyped
 * default). Queries to the Envio indexer are batched; any other endpoint is
 * asked directly.
 */
export function request<T = any>(options: RequestOptions): Promise<T>
export function request<T = any>(
  url: string,
  document: RequestDocument,
  variables?: Variables,
): Promise<T>
export function request<T = any>(
  first: string | RequestOptions,
  document?: RequestDocument,
  variables?: Variables,
): Promise<T> {
  const options: RequestOptions =
    typeof first === 'string'
      ? { url: first, document: document as RequestDocument, variables }
      : first
  if (batchingUrls.has(options.url)) return enqueue<T>(options)
  return sendOne<T, Variables>({
    url: options.url,
    document: options.document,
    variables: options.variables ?? {},
    signal: options.signal,
  })
}
