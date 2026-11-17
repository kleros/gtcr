import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from 'utils/indexer-request'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'
import useCheckPermanentList from './use-check-permanent-list'
import useUrlChainId from 'hooks/use-url-chain-id'
import { getChainById } from 'config/chains'
import { subgraphUrl } from 'config/tcr-addresses'
import { STALE_TIME } from 'consts'

interface ExistenceAnswer {
  lregistry?: { id: string; chainId?: number | null } | null
  registry?: { id: string; chainId?: number | null } | null
}

/** The chain the indexer's record of the list names, if it names one. */
const recordChainId = (data?: ExistenceAnswer): number | undefined => {
  const chainId = Number(data?.lregistry?.chainId ?? data?.registry?.chainId)
  return Number.isSafeInteger(chainId) && chainId > 0 ? chainId : undefined
}

const useCheckStandardCurate = (): {
  isStandardCurate: boolean
  isClassicCurate: boolean
  isPermanentCurate: boolean
  checking: boolean
  error: boolean
  /** Asks again whichever check failed. */
  retry: () => void
  /** Asks both indexers again, as for a list deployed moments ago. */
  recheck: () => void
} => {
  const { tcrAddress } = useParams<{
    tcrAddress: string
  }>()
  const urlChainId = useUrlChainId()
  // Nothing is asked for a chain Curate does not run on: the pages say so.
  const chainId = urlChainId && getChainById(urlChainId) ? urlChainId : null
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()
  const queryClient = useQueryClient()
  // Set by recheck until both checks settle: they already hold a "not found"
  // answer, so their refetch alone never shows the loader.
  const [rechecking, setRechecking] = useState(false)

  const {
    isLoading: loading,
    data,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['tcrExistence', tcrAddress, chainId],
    queryFn: async () => {
      const url = subgraphUrl[chainId!]
      if (!url) throw new Error(`No subgraph URL for chain ${chainId}`)

      return request<ExistenceAnswer>(url, TCR_EXISTENCE_TEST, {
        tcrAddress: tcrAddress?.toLowerCase(),
      })
    },
    enabled: !!chainId && !!tcrAddress,
    retry: 2,
    staleTime: STALE_TIME,
  })

  // One indexer serves every chain and finds a list by its address alone, so
  // a link naming another chain still finds it: it is sent on to the list's
  // own chain (search and hash kept), instead of drawing the list under the
  // wrong network with rows that never load.
  const listChainId = recordChainId(data)
  const elsewhere =
    !!chainId && listChainId !== undefined && listChainId !== chainId
  useEffect(() => {
    if (!elsewhere || listChainId === undefined) return
    const target = pathname.replace(/^\/tcr\/\d+/, `/tcr/${listChainId}`)
    if (target === pathname) return
    // The answer stands there too: the indexer is not asked twice.
    queryClient.setQueryData(['tcrExistence', tcrAddress, listChainId], data)
    navigate({ pathname: target, search, hash }, { replace: true })
  }, [
    elsewhere,
    listChainId,
    data,
    tcrAddress,
    queryClient,
    navigate,
    pathname,
    search,
    hash,
  ])

  const isStandardCurate = !!data?.lregistry
  const isClassicCurate = !!data?.registry

  // Only check Goldsky (permanent) after Envio responds with no match.
  // This prevents the slow Goldsky query from being batched together with
  // the fast Envio query, which would block the entire page render.
  // A failed refetch keeps the answer already shown (react-query keeps its
  // data): only a check with no answer at all is an error.
  const envioFailed = !!queryError && !data
  const envioFoundNothing =
    !loading && !envioFailed && !isStandardCurate && !isClassicCurate
  // Stake lists read nothing from Envio, so they are also looked for when it
  // failed: they still open while it refuses (its rate limit is shared by
  // every visitor).
  const askStake = envioFoundNothing || envioFailed
  const {
    isPermanentList,
    checking: permanentChecking,
    error: permanentError,
    retry: permanentRetry,
  } = useCheckPermanentList(tcrAddress ?? null, chainId, askStake)

  return {
    isStandardCurate,
    isClassicCurate,
    isPermanentCurate: isPermanentList,
    checking:
      loading || rechecking || elsewhere || (askStake && permanentChecking),
    // A Stake list settles the kind even when Envio failed.
    error:
      (envioFailed && !isPermanentList) ||
      (envioFoundNothing && permanentError),
    retry: () => {
      if (envioFailed) void refetch()
      if (envioFailed || permanentError) void permanentRetry()
    },
    recheck: () => {
      setRechecking(true)
      void Promise.allSettled([
        refetch(),
        envioFoundNothing ? permanentRetry() : undefined,
      ]).then(() => setRechecking(false))
    },
  }
}

export default useCheckStandardCurate
