import React, { useContext, useEffect, Suspense, lazy, useMemo } from 'react'
import { TCRViewProvider } from 'contexts/tcr-view-context'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import useTcrNetwork from 'hooks/use-tcr-network'
import useCheckLightCurate from 'hooks/use-check-light-curate'
import Loading from 'components/loading'
import ErrorPage from 'pages/error-page'
import { StakeContext } from 'contexts/stake-context'
import {
  getGraphQLClient,
  getPermanentGraphQLClient,
} from 'utils/graphql-client'
import {
  LIGHT_ITEM_DETAILS_QUERY,
  CLASSIC_ITEM_DETAILS_QUERY,
  PERMANENT_ITEM_DETAILS_QUERY,
} from 'utils/graphql'

const PermanentItemDetails = lazy(
  () => import('./permanent-item-details/index'),
)
const LightItemDetails = lazy(() => import('./light-item-details/index'))
const ItemDetails = lazy(() => import('./item-details/index'))

const ItemDetailsRouter = () => {
  const { tcrAddress, itemID, chainId } = useParams<{
    tcrAddress: string
    itemID: string
    chainId: string
  }>()
  useTcrNetwork()
  const search = window.location.search
  const { isLightCurate, isClassicCurate, isPermanentCurate, checking } =
    useCheckLightCurate()
  const { setIsPermanent } = useContext(StakeContext)
  const queryClient = useQueryClient()
  const client = useMemo(() => getGraphQLClient(chainId), [chainId])
  const pgtcrClient = useMemo(
    () => getPermanentGraphQLClient(chainId),
    [chainId],
  )

  useEffect(() => {
    setIsPermanent(isPermanentCurate)
    return () => setIsPermanent(false)
  }, [isPermanentCurate, setIsPermanent])

  // Prefetch detail data in parallel with the existence check.
  useEffect(() => {
    if (!tcrAddress || !itemID) return
    const compoundId = `${itemID}@${tcrAddress.toLowerCase()}`

    if (client) {
      queryClient.prefetchQuery({
        queryKey: ['lightItemDetails', compoundId],
        queryFn: () =>
          client.request(LIGHT_ITEM_DETAILS_QUERY, { id: compoundId }),
      })
      queryClient.prefetchQuery({
        queryKey: ['classicItemDetails', compoundId],
        queryFn: () =>
          client.request(CLASSIC_ITEM_DETAILS_QUERY, { id: compoundId }),
      })
    }
    if (pgtcrClient)
      queryClient.prefetchQuery({
        queryKey: ['permanentItemDetails', compoundId],
        queryFn: () =>
          pgtcrClient.request(PERMANENT_ITEM_DETAILS_QUERY, { id: compoundId }),
      })
  }, [client, pgtcrClient, tcrAddress, itemID, queryClient])

  if (checking) return <Loading />

  if (isLightCurate)
    return (
      <Suspense fallback={<Loading />}>
        <LightTCRViewProvider tcrAddress={tcrAddress}>
          <LightItemDetails search={search} itemID={itemID} />
        </LightTCRViewProvider>
      </Suspense>
    )
  if (isClassicCurate)
    return (
      <Suspense fallback={<Loading />}>
        <TCRViewProvider tcrAddress={tcrAddress}>
          <ItemDetails search={search} itemID={itemID} />
        </TCRViewProvider>
      </Suspense>
    )
  if (isPermanentCurate)
    return (
      <Suspense fallback={<Loading />}>
        <PermanentItemDetails search={search} itemID={itemID} />
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

export default ItemDetailsRouter
