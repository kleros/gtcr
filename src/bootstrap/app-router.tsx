import React, {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import {
  Route,
  Routes,
  useLocation,
  useNavigationType,
  useParams,
} from 'react-router-dom'
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
  const navigationType = useNavigationType()
  const { resolved, invalid, failed, retry } = usePathValidation()

  useEffect(() => {
    noteNavigation()
  }, [pathname])

  // A link opens its page at the top: without this the new page kept the
  // old page's scroll offset (an entry opened from row 30 of a list showed
  // its history, not its title). Back and Forward are left to the browser,
  // which puts the reader back where they were. Only the path is watched,
  // so filters, page numbers, the file viewer and #anchors never jump.
  const navigationTypeRef = useRef(navigationType)
  navigationTypeRef.current = navigationType
  useLayoutEffect(() => {
    if (navigationTypeRef.current !== 'POP') window.scrollTo(0, 0)
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
        {/* A wizard keeps one draft per chain: another chain in the URL
            mounts it afresh, so it opens that chain's own draft and never
            writes one chain's draft under another's key. */}
        <Route
          path="/factory/:chainId"
          element={
            <RouteReset>
              <Factory />
            </RouteReset>
          }
        />
        <Route
          path="/factory-permanent/:chainId"
          element={
            <RouteReset>
              <PermanentFactory />
            </RouteReset>
          }
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
