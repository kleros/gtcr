import React, { Suspense, lazy } from 'react'
import { Route, Routes, Navigate, useParams } from 'react-router-dom'
import { useWeb3Context } from 'hooks/use-web3-context'
import ErrorPage from 'pages/error-page'
import Loading from 'components/loading'
import { DEFAULT_NETWORK } from 'config/networks'
import usePathValidation from 'hooks/use-path-validation'
import useUrlChainId from 'hooks/use-url-chain-id'
import { defaultTcrAddresses, validChains } from 'config/tcr-addresses'
import { SAVED_NETWORK_KEY } from 'utils/string'

/** Redirect "/" to the last-used chain (or wallet chain, or default). */
const HomeRedirect = ({ networkId }: { networkId: number }) => {
  const saved = localStorage.getItem(SAVED_NETWORK_KEY)
  const chainId = saved ? Number(saved) : networkId || DEFAULT_NETWORK
  const addr = defaultTcrAddresses[chainId as validChains]
  return <Navigate to={`/tcr/${chainId}/${addr}`} replace />
}

const ItemsRouter = lazy(() => import('pages/items-router'))
const ItemDetailsRouter = lazy(() => import('pages/item-details-router'))

// Exported for preloading on link hover (instant navigation feel)
export const preloadFactory = () => import('pages/factory/index')
export const preloadClassicFactory = () => import('pages/factory-classic/index')
export const preloadPermanentFactory = () =>
  import('pages/factory-permanent/index')

const Factory = lazy(preloadFactory)
const ClassicFactory = lazy(preloadClassicFactory)
const PermanentFactory = lazy(preloadPermanentFactory)

/** Forces children to fully remount when URL params change. */
const RouteReset = ({ children }: { children: React.ReactNode }) => {
  const params = useParams()
  const key = Object.values(params).join('/')
  return <React.Fragment key={key}>{children}</React.Fragment>
}

const AppRouter = () => {
  const { networkId } = useWeb3Context()
  const urlChainId = useUrlChainId()

  const activeChainId = urlChainId || networkId || DEFAULT_NETWORK
  const _tcrAddress = defaultTcrAddresses[activeChainId as validChains]
  const [pathResolved, invalidTcrAddr] = usePathValidation()

  if (!pathResolved) return <Loading />
  if (invalidTcrAddr) return <ErrorPage />

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route
          path="/tcr/:chainId/:tcrAddress/:itemID"
          element={
            <RouteReset>
              <ItemDetailsRouter />
            </RouteReset>
          }
        />
        <Route
          path="/tcr/:chainId/:tcrAddress"
          element={
            <RouteReset>
              <ItemsRouter />
            </RouteReset>
          }
        />
        <Route path="/factory/:chainId" element={<Factory />} />
        <Route path="/factory-classic/:chainId" element={<ClassicFactory />} />
        <Route
          path="/factory-permanent/:chainId"
          element={<PermanentFactory />}
        />
        <Route path="/" element={<HomeRedirect networkId={networkId} />} />
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </Suspense>
  )
}

export default AppRouter
