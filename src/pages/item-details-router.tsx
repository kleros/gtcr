import React, { useContext, useEffect, Suspense, lazy } from 'react'
import { TCRViewProvider } from 'contexts/tcr-view-context'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { STALE_TIME } from 'consts'
import useTcrNetwork from 'hooks/use-tcr-network'
import useCheckLightCurate from 'hooks/use-check-light-curate'
import useUrlChainId from 'hooks/use-url-chain-id'
import Loading from 'components/loading'
import ErrorPage from 'pages/error-page'
import { StakeContext } from 'contexts/stake-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import {
  LIGHT_ITEM_DETAILS_QUERY,
  CLASSIC_ITEM_DETAILS_QUERY,
} from 'utils/graphql'
import {
  fetchLightItemDetailViaRPC,
  fetchClassicItemDetailViaRPC,
} from 'utils/rpc-item-fallback'

const PermanentItemDetails = lazy(
  () => import('./permanent-item-details/index'),
)
const LightItemDetails = lazy(() => import('./light-item-details/index'))
const ItemDetails = lazy(() => import('./item-details/index'))

const ItemDetailsRouter = () => {
  const { tcrAddress, itemID } = useParams<{
    tcrAddress: string
    itemID: string
  }>()
  const chainId = useUrlChainId()
  useTcrNetwork()
  const search = window.location.search
  const { isLightCurate, isClassicCurate, isPermanentCurate, checking } =
    useCheckLightCurate()
  const { setIsPermanent } = useContext(StakeContext)
  const queryClient = useQueryClient()
  const { graphqlBatcher } = useGraphqlBatcher()

  useEffect(() => {
    setIsPermanent(isPermanentCurate)
    return () => setIsPermanent(false)
  }, [isPermanentCurate, setIsPermanent])

  // Prefetch detail data in parallel with the existence check.
  useEffect(() => {
    if (!chainId || !tcrAddress || !itemID) return
    const compoundId = `${itemID}@${tcrAddress.toLowerCase()}`

    queryClient.prefetchQuery({
      queryKey: ['lightItemDetails', compoundId],
      queryFn: async () => {
        const result = await graphqlBatcher.fetch({
          id: crypto.randomUUID(),
          document: LIGHT_ITEM_DETAILS_QUERY,
          variables: { id: compoundId },
          chainId,
        })
        if (result?.litem !== undefined) return result
        return (
          (await fetchLightItemDetailViaRPC(tcrAddress, itemID, chainId)) ??
          result
        )
      },
      staleTime: STALE_TIME,
    })
    queryClient.prefetchQuery({
      queryKey: ['classicItemDetails', compoundId],
      queryFn: async () => {
        const result = await graphqlBatcher.fetch({
          id: crypto.randomUUID(),
          document: CLASSIC_ITEM_DETAILS_QUERY,
          variables: { id: compoundId },
          chainId,
        })
        if (result?.item !== undefined) return result
        return (
          (await fetchClassicItemDetailViaRPC(tcrAddress, itemID, chainId)) ??
          result
        )
      },
      staleTime: STALE_TIME,
    })
  }, [chainId, tcrAddress, itemID, queryClient, graphqlBatcher])

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
