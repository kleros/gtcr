import React, { useContext, useEffect, Suspense, lazy } from 'react'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { STALE_TIME } from 'consts'
import Loading from 'components/loading'
import ErrorPage from 'pages/error-page'
import ClassicRetired from 'pages/classic-retired'
import AttachmentDisplay from 'components/attachment-display'
import useTcrNetwork from 'hooks/use-tcr-network'
import useCheckLightCurate from 'hooks/use-check-light-curate'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useAttachmentPlace } from 'hooks/use-attachment'
import { usePolicyHistory } from 'hooks/use-policy-history'
import { StakeContext } from 'contexts/stake-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { getChainById } from 'config/chains'
import { LIGHT_ITEMS_QUERY } from 'utils/graphql'
import { searchStrToFilterObjLight } from 'utils/filters'
import { getAllowedAttachmentUrl } from 'utils/url-validation'

const LIGHT_ITEMS_PER_PAGE = 40

const LightItems = lazy(() => import('./light-items/index'))
const PermanentItems = lazy(() => import('./permanent-items/index'))

function computeItemsWhere(queryOptions: Record<string, any>, addr: string) {
  const {
    absent,
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
  } = queryOptions
  const conditions: Record<string, any>[] = []

  if (absent) conditions.push({ status: { _eq: 'Absent' } })
  if (registered) conditions.push({ status: { _eq: 'Registered' } })
  if (submitted)
    conditions.push({
      status: { _eq: 'RegistrationRequested' },
      disputed: { _eq: false },
    })
  if (removalRequested)
    conditions.push({
      status: { _eq: 'ClearingRequested' },
      disputed: { _eq: false },
    })
  if (challengedSubmissions)
    conditions.push({
      status: { _eq: 'RegistrationRequested' },
      disputed: { _eq: true },
    })
  if (challengedRemovals)
    conditions.push({
      status: { _eq: 'ClearingRequested' },
      disputed: { _eq: true },
    })

  if (conditions.length === 0) return { registry_id: { _eq: addr } }
  if (conditions.length === 1)
    return { registry_id: { _eq: addr }, ...conditions[0] }
  return { registry_id: { _eq: addr }, _or: conditions }
}

const ItemsRouter = () => {
  const { tcrAddress } = useParams<{
    tcrAddress: string
  }>()
  const urlChainId = useUrlChainId()
  // The URL's chain when Curate runs on it. Any other gets its own page
  // (below) at once, and nothing is asked for it.
  const chainId = urlChainId && getChainById(urlChainId) ? urlChainId : null
  const [searchParams] = useSearchParams()
  // A file the viewer cannot show (no value, or not on the IPFS gateway)
  // leaves the list in view.
  const isAttachmentOpen = !!getAllowedAttachmentUrl(
    searchParams.get('attachment'),
  )
  useAttachmentPlace(isAttachmentOpen)
  const {
    isLightCurate,
    isClassicCurate,
    isPermanentCurate,
    checking,
    error,
    retry,
    recheck,
  } = useCheckLightCurate()
  // The wallet is asked once the list's chain is known (useTcrNetwork).
  useTcrNetwork(!checking)
  const setIsPermanent = useContext(StakeContext)?.setIsPermanent
  const queryClient = useQueryClient()
  const { graphqlBatcher } = useGraphqlBatcher()

  useEffect(() => {
    setIsPermanent?.(isPermanentCurate)
    return () => setIsPermanent?.(false)
  }, [isPermanentCurate, setIsPermanent])

  // Prefetch the latest policy timestamp so the "(updated X ago)" badge
  // is warm in cache by the time the banner renders.
  usePolicyHistory(tcrAddress, chainId ?? undefined, 'latest')

  // Prefetch items data in parallel with the existence check.
  // This overlaps the items fetch with the registry type check,
  // eliminating the serial waterfall.
  useEffect(() => {
    if (!chainId || !tcrAddress) return
    const addr = tcrAddress.toLowerCase()
    const search = window.location.search || ''
    const queryOptions = searchStrToFilterObjLight(search)
    const orderDirection = queryOptions.oldestFirst ? 'asc' : 'desc'
    const page = Number(queryOptions.page) || 1
    const where = computeItemsWhere(queryOptions, addr)

    const lightVars = {
      offset: (page - 1) * LIGHT_ITEMS_PER_PAGE,
      limit: LIGHT_ITEMS_PER_PAGE,
      order_by: [{ latestRequestSubmissionTime: orderDirection }],
      where,
      registryId: addr,
    }
    queryClient.prefetchQuery({
      queryKey: ['lightItems', lightVars],
      queryFn: () =>
        graphqlBatcher.fetch({
          id: crypto.randomUUID(),
          document: LIGHT_ITEMS_QUERY,
          variables: lightVars,
          chainId,
        }),
      staleTime: STALE_TIME,
    })
  }, [chainId, tcrAddress, queryClient, graphqlBatcher])

  if (!chainId)
    return (
      <ErrorPage
        code="404"
        title="Chain not supported"
        message="Curate runs on Ethereum, Gnosis and Sepolia."
      />
    )

  // The viewer shows in the list's place. What the list shows stays mounted
  // under it, hidden, so its search, filters and place are there on Return.
  const withViewer = (list: React.ReactNode) => (
    <>
      {isAttachmentOpen && <AttachmentDisplay />}
      <div hidden={isAttachmentOpen}>{list}</div>
    </>
  )

  if (checking) return withViewer(<Loading />)

  if (error)
    return withViewer(
      <ErrorPage
        code="Error"
        title="This list did not load"
        message="The indexer did not answer."
        onRetry={retry}
      />,
    )

  if (!tcrAddress)
    return withViewer(
      <ErrorPage
        code="Error"
        title="List not found"
        message="No Curate list answers at this address on this chain."
      />,
    )

  if (isLightCurate)
    return withViewer(
      <Suspense fallback={<Loading />}>
        <LightTCRViewProvider tcrAddress={tcrAddress}>
          <LightItems />
        </LightTCRViewProvider>
      </Suspense>,
    )
  if (isClassicCurate)
    return withViewer(
      <ClassicRetired chainId={chainId} tcrAddress={tcrAddress} />,
    )
  if (isPermanentCurate)
    return withViewer(
      <Suspense fallback={<Loading />}>
        <PermanentItems />
      </Suspense>,
    )

  return withViewer(
    <ErrorPage
      code="Error"
      title="List not found"
      message="No Curate list was found at this address on this chain. A list created in the last few minutes may not be indexed yet: check again in a minute."
      onRetry={recheck}
    />,
  )
}

export default ItemsRouter
