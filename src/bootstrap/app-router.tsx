import React, { Suspense, lazy } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import ErrorPage from 'pages/error-page'
import Loading from 'components/loading'
import usePathValidation from 'hooks/use-path-validation'

const Dashboard = lazy(() => import('pages/dashboard'))
const Browse = lazy(() => import('pages/browse'))
const AddressPage = lazy(() => import('pages/address'))
const CuratePro = lazy(() => import('pages/curate-pro'))
const Guide = lazy(() => import('pages/guide'))
const LaunchList = lazy(() => import('pages/launch-list'))
const ItemsRouter = lazy(() => import('pages/items-router'))
const ItemDetailsRouter = lazy(() => import('pages/item-details-router'))
const SubmitItem = lazy(() => import('pages/submit-item'))

// Exported for preloading on link hover (instant navigation feel)
export const preloadFactory = () => import('pages/factory/index')
export const preloadPermanentFactory = () =>
  import('pages/factory-permanent/index')

const Factory = lazy(preloadFactory)
const PermanentFactory = lazy(preloadPermanentFactory)

/** Forces children to fully remount when URL params change. */
const RouteReset = ({ children }: { children: React.ReactNode }) => {
  const params = useParams()
  const key = Object.values(params).join('/')
  return <React.Fragment key={key}>{children}</React.Fragment>
}

const AppRouter = () => {
  const [pathResolved, invalidTcrAddr] = usePathValidation()

  if (!pathResolved) return <Loading />
  if (invalidTcrAddr) return <ErrorPage />

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
