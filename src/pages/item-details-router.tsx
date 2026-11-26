import React, { useContext, useEffect, useMemo, Suspense, lazy } from 'react'
import { StandardTCRViewProvider } from 'contexts/standard-tcr-view-context'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { STALE_TIME } from 'consts'
import useTcrNetwork from 'hooks/use-tcr-network'
import useCheckStandardCurate from 'hooks/use-check-standard-curate'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useAttachmentPlace } from 'hooks/use-attachment'
import { policyKindOf, usePolicyHistory } from 'hooks/use-policy-history'
import Loading from 'components/loading'
import ErrorPage from 'pages/error-page'
import ClassicRetired from 'pages/classic-retired'
import AttachmentDisplay from 'components/attachment-display'
import { StakeContext } from 'contexts/stake-context'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { getChainById } from 'config/chains'
import { STANDARD_ITEM_DETAILS_QUERY } from 'utils/graphql'
import { getAllowedAttachmentUrl } from 'utils/url-validation'

/** The viewer's parameters (see useAttachment), not the entry page's. */
const VIEWER_PARAMS = ['attachment', 'isPolicy', 'policyTx']

const PermanentItemDetails = lazy(
  () => import('./permanent-item-details/index'),
)
const StandardItemDetails = lazy(() => import('./standard-item-details/index'))

const ItemDetailsRouter = () => {
  const { tcrAddress, itemID } = useParams<{
    tcrAddress: string
    itemID: string
  }>()
  const urlChainId = useUrlChainId()
  // The URL's chain when Curate runs on it. Any other gets its own page
  // (below) at once, and nothing is asked for it.
  const chainId = urlChainId && getChainById(urlChainId) ? urlChainId : null
  const [searchParams] = useSearchParams()
  // A file the viewer cannot show (no value, or not on the IPFS gateway)
  // leaves the entry in view.
  const isAttachmentOpen = !!getAllowedAttachmentUrl(
    searchParams.get('attachment'),
  )
  useAttachmentPlace(isAttachmentOpen)
  // The entry page stays mounted under the viewer and runs an ?action= link
  // whenever this string changes: opening a file and coming back must not
  // run it again, so the viewer's parameters are left out.
  const search = useMemo(() => {
    const params = new URLSearchParams(searchParams)
    VIEWER_PARAMS.forEach((key) => params.delete(key))
    const query = params.toString()
    return query ? `?${query}` : ''
  }, [searchParams])
  const {
    isStandardCurate,
    isClassicCurate,
    isPermanentCurate,
    checking,
    error,
    retry,
    recheck,
  } = useCheckStandardCurate()
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
  // on the PolicyLink is warm in cache by the time the banner renders.
  // Once the check names the kind: Standard and Stake mark their policy
  // differently (fetch-policy-history isPolicyLog).
  const policyKind = policyKindOf({
    checking,
    isStandardCurate,
    isPermanentCurate,
  })
  // Only a Standard page shows the badge: on Stake this read (a backward
  // log scan) would warm nothing.
  usePolicyHistory(
    tcrAddress,
    chainId ?? undefined,
    policyKind === 'standard' ? policyKind : undefined,
    'latest',
  )

  // Prefetch detail data in parallel with the existence check.
  useEffect(() => {
    if (!chainId || !tcrAddress || !itemID) return
    const compoundId = `${itemID}@${tcrAddress.toLowerCase()}`

    queryClient.prefetchQuery({
      queryKey: ['standardItemDetails', compoundId],
      queryFn: () =>
        graphqlBatcher.fetch({
          id: crypto.randomUUID(),
          document: STANDARD_ITEM_DETAILS_QUERY,
          variables: { id: compoundId },
          chainId,
        }),
      staleTime: STALE_TIME,
    })
  }, [chainId, tcrAddress, itemID, queryClient, graphqlBatcher])

  if (!chainId)
    return (
      <ErrorPage
        code="404"
        title="Chain not supported"
        message="Curate runs on Ethereum, Gnosis and Sepolia."
      />
    )

  // The viewer shows in the entry's place. What the entry page shows stays
  // mounted under it, hidden, so a half-written evidence and the reader's
  // place are there on Return.
  const withViewer = (entry: React.ReactNode) => (
    <>
      {isAttachmentOpen && <AttachmentDisplay policyKind={policyKind} />}
      <div hidden={isAttachmentOpen}>{entry}</div>
    </>
  )

  if (checking) return withViewer(<Loading />)

  if (error)
    return withViewer(
      <ErrorPage
        code="Error"
        title="This entry did not load"
        message="The indexer did not answer."
        onRetry={retry}
      />,
    )

  if (!tcrAddress || !itemID)
    return withViewer(
      <ErrorPage
        code="Error"
        title="List not found"
        message="No Curate list answers at this address on this chain."
      />,
    )

  if (isStandardCurate)
    return withViewer(
      <Suspense fallback={<Loading />}>
        <StandardTCRViewProvider tcrAddress={tcrAddress}>
          <StandardItemDetails search={search} itemID={itemID} />
        </StandardTCRViewProvider>
      </Suspense>,
    )
  if (isClassicCurate)
    return withViewer(
      <ClassicRetired chainId={chainId} tcrAddress={tcrAddress} />,
    )
  if (isPermanentCurate)
    return withViewer(
      <Suspense fallback={<Loading />}>
        <PermanentItemDetails search={search} itemID={itemID} />
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

export default ItemDetailsRouter
