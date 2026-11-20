import { gql } from 'graphql-request'
import { request } from 'utils/indexer-request'
import { subgraphUrlPermanent } from 'config/tcr-addresses'

/*
 * "Is this address a Stake Curate list?", asked for many addresses at once.
 * A list of lists asks it for every row. The Stake subgraph does not take an
 * array of queries, so the addresses asked within WINDOW_MS go out as one
 * query (`id_in`) instead of one request per row.
 */

const WINDOW_MS = 12
const IDS_PER_QUERY = 500

const REGISTRIES_EXIST = gql`
  query PermanentRegistriesExist($ids: [ID!]!) {
    registries(where: { id_in: $ids }, first: 1000) {
      id
    }
  }
`

type Waiter = {
  resolve: (exists: boolean) => void
  reject: (err: unknown) => void
}

interface Queue {
  waiters: Map<string, Waiter[]>
  timer?: number
}

const queues = new Map<string, Queue>()

const flush = async (url: string, queue: Queue) => {
  const ids = [...queue.waiters.keys()].slice(0, IDS_PER_QUERY)
  const asked = ids.map((id) => [id, queue.waiters.get(id) ?? []] as const)
  for (const id of ids) queue.waiters.delete(id)
  if (queue.waiters.size > 0)
    queue.timer = window.setTimeout(() => {
      queue.timer = undefined
      void flush(url, queue)
    }, 0)
  if (ids.length === 0) return
  try {
    const data = await request<{ registries?: { id: string }[] }>(
      url,
      REGISTRIES_EXIST,
      { ids },
    )
    const found = new Set(
      (data.registries ?? []).map((registry) => registry.id.toLowerCase()),
    )
    for (const [id, waiters] of asked)
      for (const waiter of waiters) waiter.resolve(found.has(id))
  } catch (err) {
    for (const [, waiters] of asked)
      for (const waiter of waiters) waiter.reject(err)
  }
}

/** Whether `address` is a Stake Curate list on `chainId`. */
export const isPermanentRegistry = (
  chainId: number | string,
  address: string,
): Promise<boolean> => {
  const url = subgraphUrlPermanent[chainId]
  if (!url)
    return Promise.reject(
      new Error(`No permanent subgraph URL for chain ${chainId}`),
    )
  let queue = queues.get(url)
  if (!queue) {
    queue = { waiters: new Map() }
    queues.set(url, queue)
  }
  const pending = queue
  return new Promise<boolean>((resolve, reject) => {
    const id = address.toLowerCase()
    const waiters = pending.waiters.get(id)
    if (waiters) waiters.push({ resolve, reject })
    else pending.waiters.set(id, [{ resolve, reject }])
    if (pending.timer === undefined)
      pending.timer = window.setTimeout(() => {
        pending.timer = undefined
        void flush(url, pending)
      }, WINDOW_MS)
  })
}
