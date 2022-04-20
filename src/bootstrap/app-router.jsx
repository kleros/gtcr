import React, { useEffect, useMemo } from 'react'
import {
  Route,
  Switch,
  Redirect
} from 'react-router-dom'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { HttpLink } from '@apollo/client/link/http'
import { useWeb3Context } from 'web3-react'
import getNetworkEnv from 'utils/network-env'

import loadable from '@loadable/component'
import ErrorPage from 'pages/error-page'
import NoWeb3Detected from 'pages/no-web3'
import Loading from 'components/loading'
import connectors from 'config/connectors'
import { DEFAULT_NETWORK } from 'config/networks'
import { hexlify } from 'utils/string'

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
  const { networkId, error } = useWeb3Context();
  const isUnsupported = useMemo(() => error?.code === 'UNSUPPORTED_NETWORK', [error])
  const tcrAddress = getNetworkEnv('REACT_APP_DEFAULT_TCR_ADDRESSES', networkId);

  const client = useMemo(() => {
    if (!networkId) {
      return null
    }

    const GTCR_SUBGRAPH_URL = getNetworkEnv(
      'REACT_APP_SUBGRAPH_URL',
      networkId
    )

    if (!GTCR_SUBGRAPH_URL) {
      return null;
    }

    const httpLink = new HttpLink({
      uri: GTCR_SUBGRAPH_URL
    })
    return new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache()
    })
  }, [networkId])

  useEffect(() => {
    if (isUnsupported && window.ethereum) {
      const chainIdTokens = window.location.pathname.match(/\/tcr\/(\d+)\//);
      const chainId = hexlify(chainIdTokens.length > 1 ? chainIdTokens[1] : DEFAULT_NETWORK);

      window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      });
    }
  }, [isUnsupported]);

  if (Object.entries(connectors).length === 0)
    return <NoWeb3Detected />

  if (isUnsupported) {
    return (
      <ErrorPage
        code={' '}
        title={error.code}
        message={error.message}
        tip={
          <>
            <p>Switching network to supported one</p>
            <Loading />
          </>
        }
      />
    )
  } else if (!networkId) {
    return <Loading />
  }

  return (
    <ApolloProvider client={client}>
      <Switch>
        <Route path="/tcr/:chainId/:tcrAddress/:itemID" component={ItemDetailsRouter} />
        <Route path="/tcr/:chainId/:tcrAddress" component={ItemsRouter} />
        <Route path="/factory" exact component={Factory} />
        <Route path="/factory-classic" exact component={ClassicFactory} />
        <Redirect from="/" exact to={`/tcr/${networkId}/${tcrAddress}`} />
        <Route path="*" exact component={ErrorPage} />
      </Switch>
    </ApolloProvider>
  )
}

export default AppRouter;