import React, { useMemo, createContext, useContext } from 'react'
import {
  create,
  windowedFiniteBatchScheduler,
  type Batcher,
} from '@yornaath/batshit'
import { request, type RequestDocument } from 'graphql-request'
import { toast } from 'react-toastify'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'

interface IGraphqlBatcher {
  graphqlBatcher: Batcher<any, IQuery>
}

export interface IQuery {
  id: string
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

// A failed read is an error, not an empty answer: an empty answer would read
// as "this entry does not exist" and be cached as fresh, so the page could not
// tell an outage from a missing entry and React Query would not retry it.
const fetchGraphql = async (
  url: string,
  document: RequestDocument,
  variables: Record<string, any>,
) => {
  try {
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

const getSubgraphUrl = (
  chainId: number | string,
  isPermanent: boolean,
): string => {
  const urlMap = isPermanent ? subgraphUrlPermanent : subgraphUrl
  const url = urlMap[chainId]
  if (!url) throw new Error(`No subgraph URL for chain ${chainId}`)
  return url
}

type BatchResult = { id: string; result?: any; error?: unknown }

// Each query in a batch succeeds or fails on its own.
const fetcher = (queries: IQuery[]): Promise<BatchResult[]> =>
  Promise.all(
    queries.map(async ({ id, document, variables, isPermanent, chainId }) => {
      try {
        const url = getSubgraphUrl(chainId, isPermanent ?? false)
        return { id, result: await fetchGraphql(url, document, variables) }
      } catch (err) {
        return { id, error: err ?? new Error('The indexer did not answer.') }
      }
    }),
  )

export const GraphqlBatcherProvider: React.FC<{
  children?: React.ReactNode
}> = ({ children }) => {
  const graphqlBatcher = useMemo(
    () =>
      create({
        fetcher,
        resolver: (results, query) => {
          const answer = results.find((result) => result.id === query.id)
          if (!answer) throw new Error('The indexer did not answer.')
          if (answer.error) throw answer.error
          return answer.result
        },
        scheduler: windowedFiniteBatchScheduler({
          windowMs: 100,
          maxBatchSize: 5,
        }),
      }),
    [],
  )

  return (
    <Context.Provider
      value={useMemo(() => ({ graphqlBatcher }), [graphqlBatcher])}
    >
      {children}
    </Context.Provider>
  )
}

export const useGraphqlBatcher = () => {
  const context = useContext(Context)
  if (!context) throw new Error('GraphqlBatcherProvider not found.')

  return context
}
