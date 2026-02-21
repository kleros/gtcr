import React, { Suspense, lazy, useMemo } from 'react'
import { Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { useWeb3Context } from 'hooks/useWeb3Context'
import ErrorPage from 'pages/error-page'
import Loading from 'components/loading'
import { DEFAULT_NETWORK } from 'config/networks'
import usePathValidation from 'hooks/use-path-validation'
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
const Factory = lazy(() => import('pages/factory/index'))
const ClassicFactory = lazy(() => import('pages/factory-classic/index'))
const PermanentFactory = lazy(() => import('pages/factory-permanent/index'))

const AppRouter = () => {
  const { networkId } = useWeb3Context()
  const location = useLocation()

  // Parse chainId from the URL — the source of truth for data fetching
  const urlChainId = useMemo(() => {
    const match = location.pathname.match(/\/tcr\/(\d+)\//)
    return match ? Number(match[1]) : null
  }, [location.pathname])

  const activeChainId = urlChainId || networkId || DEFAULT_NETWORK
  const tcrAddress = defaultTcrAddresses[activeChainId as validChains]
  const [pathResolved, invalidTcrAddr] = usePathValidation()

  if (!pathResolved) return <Loading />
  if (invalidTcrAddr) return <ErrorPage />

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route
          path="/tcr/:chainId/:tcrAddress/:itemID"
          element={<ItemDetailsRouter />}
        />
        <Route path="/tcr/:chainId/:tcrAddress" element={<ItemsRouter />} />
        <Route path="/factory" element={<Factory />} />
        <Route path="/factory-classic" element={<ClassicFactory />} />
        <Route path="/factory-permanent" element={<PermanentFactory />} />
        <Route
          path="/"
          element={<HomeRedirect networkId={networkId} />}
        />
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </Suspense>
  )
}

export default AppRouter
