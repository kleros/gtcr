import React, { useEffect, useMemo } from 'react'
import { Route, Switch, Redirect } from 'react-router-dom'
import { ApolloProvider } from '@apollo/client'
import { useWeb3Context, Connectors } from 'web3-react'
import getNetworkEnv from 'utils/helpers/network-env'
import loadable from '@loadable/component'
import ErrorPage from 'pages/error-page'
import NoWeb3Detected from 'pages/no-web3'
import Loading from 'components/loading'
import connectors from 'config/connectors'
import { DEFAULT_NETWORK } from 'utils/constants/networks'
import { hexlify } from 'utils/helpers/string'
import usePathValidation from 'hooks/use-path-validation'
import useGraphQLClient from 'hooks/use-graphql-client'
import { Web3ContextCurate } from 'types/web3-context'

const { Connector } = Connectors

const ItemsRouter = loadable(
  () => import(/* webpackPrefetch: true */ 'pages/items-router'),
  { fallback: <Loading /> }
)

const ItemDetailsRouter = loadable(
  () => import(/* webpackPrefetch: true */ 'pages/item-details-router'),
  { fallback: <Loading /> }
)

const Factory = loadable(
  () => import(/* webpackPrefetch: true */ 'pages/factory/index'),
  { fallback: <Loading /> }
)

const ClassicFactory = loadable(
  () => import(/* webpackPrefetch: true */ 'pages/factory-classic/index'),
  { fallback: <Loading /> }
)

const AppRouter = () => {
  const { networkId, error }: Web3ContextCurate = useWeb3Context()
  const isUnsupported = useMemo(
    () => error?.code === Connector.errorCodes.UNSUPPORTED_NETWORK,
    [error]
  )
  const tcrAddress = getNetworkEnv(
    'REACT_APP_DEFAULT_TCR_ADDRESSES',
    networkId as number
  )
  const [pathResolved, invalidTcrAddr] = usePathValidation()
  const client = useGraphQLClient(networkId)

  useEffect(() => {
    if (isUnsupported && window.ethereum) {
      const chainIdTokens = window.location.pathname.match(/\/tcr\/(\d+)\//)
      const chainId = hexlify(
        chainIdTokens && chainIdTokens?.length > 1
          ? chainIdTokens[1]
          : DEFAULT_NETWORK
      )

      window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      })
    }
  }, [isUnsupported])

  if (Object.entries(connectors).length === 0) return <NoWeb3Detected />

  if (isUnsupported && error)
    return (
      <ErrorPage
        code={' '}
        title={error.code as string}
        message={error.message}
        tip={
          <>
            <p>Switching network to supported one</p>
            <Loading />
          </>
        }
      />
    )
  else if (!networkId || !pathResolved) return <Loading />
  else if (invalidTcrAddr || !client) return <ErrorPage />

  return (
    <ApolloProvider client={client}>
      <Switch>
        <Route
          path="/tcr/:chainId/:tcrAddress/:itemID"
          component={ItemDetailsRouter}
        />
        <Route path="/tcr/:chainId/:tcrAddress" component={ItemsRouter} />
        <Route path="/factory" exact component={Factory} />
        <Route path="/factory-classic" exact component={ClassicFactory} />
        <Redirect from="/" exact to={`/tcr/${networkId}/${tcrAddress}`} />
        <Route path="*" exact component={ErrorPage} />
      </Switch>
    </ApolloProvider>
  )
}

export default AppRouter
