import React, { useMemo, createContext, useContext } from 'react'
import type { RequestDocument } from 'graphql-request'
import { toast } from 'react-toastify'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'
import { request } from 'utils/indexer-request'

/*
 * The pages' way to the indexers: `graphqlBatcher.fetch(query)`. The
 * batching itself lives in utils/indexer-request.ts, which sends every Envio
 * query asked within a few milliseconds as one HTTP request (the indexer's
 * rate limit counts requests); Stake subgraph queries go out one by one.
 * This context adds the chain's endpoint and one shared warning when reads
 * fail.
 */

interface IGraphqlBatcher {
  graphqlBatcher: { fetch: (query: IQuery) => Promise<any> }
}

export interface IQuery {
  /** Kept for callers; queries are no longer matched by ID. */
  id?: string
  document: RequestDocument
  variables: Record<string, any>
  isPermanent?: boolean
  chainId: number | string
}

const Context = createContext<IGraphqlBatcher | undefined>(undefined)

// Debounced error toast — matches kleros-v2's debounceErrorToast pattern.
let toastTimeout: ReturnType<typeof setTimeout>
const debounceErrorToast = (msg: string) => {
  if (toastTimeout) clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => {
    toast.error(msg)
  }, 5000)
}

const getSubgraphUrl = (
  chainId: number | string,
  isPermanent: boolean,
): string => {
  const urlMap = isPermanent ? subgraphUrlPermanent : subgraphUrl
  const url = urlMap[chainId]
  if (!url) throw new Error(`No subgraph URL for chain ${chainId}`)
  return url
}

// A failed read is an error, not an empty answer: an empty answer would read
// as "this entry does not exist" and be cached as fresh, so the page could not
// tell an outage from a missing entry and React Query would not retry it.
const fetchGraphql = async ({
  document,
  variables,
  isPermanent,
  chainId,
}: IQuery) => {
  try {
    const url = getSubgraphUrl(chainId, isPermanent ?? false)
    const data = await request(url, document, variables)
    // The indexer answers again: drop a warning still waiting to show.
    clearTimeout(toastTimeout)
    return data
  } catch (err) {
    console.error('Graph error:', { err })
    debounceErrorToast('Some data did not load. Try again in a moment.')
    throw err
  }
}

const graphqlBatcher = { fetch: fetchGraphql }

export const GraphqlBatcherProvider: React.FC<{
  children?: React.ReactNode
}> = ({ children }) => (
  <Context.Provider value={useMemo(() => ({ graphqlBatcher }), [])}>
    {children}
  </Context.Provider>
)

export const useGraphqlBatcher = () => {
  const context = useContext(Context)
  if (!context) throw new Error('GraphqlBatcherProvider not found.')

  return context
}
