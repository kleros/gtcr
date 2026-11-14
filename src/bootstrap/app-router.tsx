import React, { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation, useParams } from 'react-router-dom'
import ErrorPage from 'pages/error-page'
import Loading from 'components/loading'
import usePathValidation from 'hooks/use-path-validation'
import { noteNavigation, preloadInBackground } from 'utils/background-preload'

const Dashboard = lazy(() => import('pages/dashboard'))
const Browse = lazy(() => import('pages/browse'))
const AddressPage = lazy(() => import('pages/address'))
const CuratePro = lazy(() => import('pages/curate-pro'))
const Guide = lazy(() => import('pages/guide'))
const LaunchList = lazy(() => import('pages/launch-list'))
const ItemsRouter = lazy(() => import('pages/items-router'))
const ItemDetailsRouter = lazy(() => import('pages/item-details-router'))
const SubmitItem = lazy(() => import('pages/submit-item'))

// The factories' code, loaded early on hover or focus of a link to them
// (instant navigation feel) through the warm* helpers, which never reload a
// tab whose release changed underneath it (utils/background-preload.ts).
export const preloadFactory = () => import('pages/factory/index')
export const preloadPermanentFactory = () =>
  import('pages/factory-permanent/index')
export const warmFactory = () => preloadInBackground(preloadFactory)
export const warmPermanentFactory = () =>
  preloadInBackground(preloadPermanentFactory)

const Factory = lazy(preloadFactory)
const PermanentFactory = lazy(preloadPermanentFactory)

/** Forces children to fully remount when URL params change. */
const RouteReset = ({ children }: { children: React.ReactNode }) => {
  const params = useParams()
  const key = Object.values(params).join('/')
  return <React.Fragment key={key}>{children}</React.Fragment>
}

const AppRouter = () => {
  const { pathname } = useLocation()
  const { resolved, invalid, failed, retry } = usePathValidation()

  useEffect(() => {
    noteNavigation()
  }, [pathname])

  if (!resolved) return <Loading />
  if (failed)
    return (
      <ErrorPage
        code="Error"
        title="This link did not load"
        message="The indexer did not answer, so the list this link points to could not be found."
        onRetry={retry}
      />
    )
  if (invalid) return <ErrorPage />

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route
          path="/tcr/:chainId/:tcrAddress/submit"
          element={
            <RouteReset>
              <SubmitItem />
            </RouteReset>
          }
        />
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
        <Route
          path="/factory-permanent/:chainId"
          element={<PermanentFactory />}
        />
        <Route path="/" element={<Dashboard />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/launch/:chainId" element={<LaunchList />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/address/:address" element={<AddressPage />} />
        <Route path="/pro" element={<CuratePro />} />
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </Suspense>
  )
}

export default AppRouter
