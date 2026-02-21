import React, { useContext, useEffect, Suspense, lazy, useMemo } from 'react'
import { TCRViewProvider } from 'contexts/tcr-view-context'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Loading from 'components/loading'
import ErrorPage from 'pages/error-page'
import useTcrNetwork from 'hooks/use-tcr-network'
import useCheckLightCurate from 'hooks/use-check-light-curate'
import { StakeContext } from 'contexts/stake-context'
import { getGraphQLClient } from 'utils/graphql-client'
import { LIGHT_ITEMS_QUERY, CLASSIC_REGISTRY_ITEMS_QUERY } from 'utils/graphql'
import { searchStrToFilterObjLight } from 'utils/filters'

const LIGHT_ITEMS_PER_PAGE = 40
const CLASSIC_MAX_ENTITIES = 1000

const LightItems = lazy(() => import('./light-items/index'))
const Items = lazy(() => import('./items/index'))
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
  const { tcrAddress, chainId } = useParams<{
    tcrAddress: string
    chainId: string
  }>()
  const { isLightCurate, isClassicCurate, isPermanentCurate, checking } =
    useCheckLightCurate()
  useTcrNetwork()
  const { setIsPermanent } = useContext(StakeContext)
  const queryClient = useQueryClient()
  const client = useMemo(() => getGraphQLClient(chainId), [chainId])

  useEffect(() => {
    setIsPermanent(isPermanentCurate)
    return () => setIsPermanent(false)
  }, [isPermanentCurate, setIsPermanent])

  // Prefetch items data in parallel with the existence check.
  // This overlaps the items fetch with the registry type check,
  // eliminating the serial waterfall.
  useEffect(() => {
    if (!client || !tcrAddress) return
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
      queryFn: () => client.request(LIGHT_ITEMS_QUERY, lightVars),
    })

    const classicVars = {
      offset: (page - 1) * LIGHT_ITEMS_PER_PAGE,
      limit: CLASSIC_MAX_ENTITIES,
      order_by: [{ latestRequestSubmissionTime: orderDirection }],
      where,
    }
    queryClient.prefetchQuery({
      queryKey: ['classicItems', classicVars],
      queryFn: () => client.request(CLASSIC_REGISTRY_ITEMS_QUERY, classicVars),
    })
  }, [client, tcrAddress, queryClient, chainId])

  if (checking) return <Loading />

  if (isLightCurate)
    return (
      <Suspense fallback={<Loading />}>
        <LightTCRViewProvider tcrAddress={tcrAddress}>
          <LightItems />
        </LightTCRViewProvider>
      </Suspense>
    )
  if (isClassicCurate)
    return (
      <Suspense fallback={<Loading />}>
        <TCRViewProvider tcrAddress={tcrAddress}>
          <Items />
        </TCRViewProvider>
      </Suspense>
    )
  if (isPermanentCurate)
    return (
      <Suspense fallback={<Loading />}>
        <PermanentItems />
      </Suspense>
    )

  return (
    <ErrorPage
      code="Error"
      title="Registry Not Found"
      message="This registry could not be found on any subgraph. The subgraph endpoint may be down or the registry address may be invalid."
    />
  )
}

export default ItemsRouter
