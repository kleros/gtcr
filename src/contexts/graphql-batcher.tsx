import React, { useMemo, createContext, useContext } from 'react'
import {
  create,
  windowedFiniteBatchScheduler,
  type Batcher,
} from '@yornaath/batshit'
import { request } from 'graphql-request'
import type { DocumentNode } from 'graphql'
import { toast } from 'react-toastify'
import {
  subgraphUrl,
  subgraphUrlPermanent,
} from 'config/tcr-addresses'

interface IGraphqlBatcher {
  graphqlBatcher: Batcher<any, IQuery>
}

export interface IQuery {
  id: string
  document: DocumentNode
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

const fetchGraphql = async (
  url: string,
  document: DocumentNode,
  variables: Record<string, any>,
) => {
  try {
    return await request(url, document, variables)
  } catch (error) {
    console.error('Graph error: ', { error })
    debounceErrorToast('Graph query error: failed to fetch data.')
    return {}
  }
}

const getSubgraphUrl = (
  chainId: number | string,
  isPermanent: boolean,
): string => {
  const urlMap = isPermanent ? subgraphUrlPermanent : subgraphUrl
  const url = urlMap[String(chainId) as keyof typeof urlMap]
  if (!url) throw new Error(`No subgraph URL for chain ${chainId}`)
  return url
}

const fetcher = async (queries: IQuery[]) => {
  const results = await Promise.all(
    queries.map(({ document, variables, isPermanent, chainId }) => {
      const url = getSubgraphUrl(chainId, isPermanent ?? false)
      return fetchGraphql(url, document, variables)
    }),
  )

  return results.map((result, index) => ({
    id: queries[index].id,
    result,
  }))
}

export const GraphqlBatcherProvider: React.FC<{
  children?: React.ReactNode
}> = ({ children }) => {
  const graphqlBatcher = useMemo(
    () =>
      create({
        fetcher,
        resolver: (results, query) =>
          results.find((result) => result.id === query.id)!['result'],
        scheduler: windowedFiniteBatchScheduler({
          windowMs: 100,
          maxBatchSize: 5,
        }),
      }),
    [],
  )

  return (
    <Context.Provider value={useMemo(() => ({ graphqlBatcher }), [graphqlBatcher])}>
      {children}
    </Context.Provider>
  )
}

export const useGraphqlBatcher = () => {
  const context = useContext(Context)
  if (!context) {
    throw new Error('GraphqlBatcherProvider not found.')
  }
  return context
}
