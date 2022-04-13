import React, { useMemo } from 'react'
import {
  Route,
  Switch,
  Redirect
} from 'react-router-dom'
import { useWeb3Context } from 'web3-react'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { HttpLink } from '@apollo/client/link/http'
import getNetworkEnvVariable from 'utils/network-env'

import loadable from '@loadable/component'
import ErrorPage from 'pages/error-page'
import useMainTCR2 from 'hooks/tcr2'
import NoWeb3Detected from 'pages/no-web3'
import Loading from 'components/loading'
import connectors from 'utils/connectors'

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
  const tcr2Address = useMainTCR2()
  const web3Context = useWeb3Context()

  const client = useMemo(() => {
    if (!web3Context.networkId) {
      return null
    }

    const GTCR_SUBGRAPH_URL = getNetworkEnvVariable(
      'REACT_APP_SUBGRAPH_URL',
      web3Context.networkId
    )
    const httpLink = new HttpLink({
      uri: GTCR_SUBGRAPH_URL
    })
    return new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache()
    })
  }, [web3Context])

  if (Object.entries(connectors).length === 0)
    return <NoWeb3Detected />

  if (!web3Context.networkId)
    return <Loading />

  return (
    <ApolloProvider client={client}>
      <Switch>
        <Route path="/tcr/:tcrAddress/:itemID" component={ItemDetailsRouter} />
        <Route path="/tcr/:tcrAddress" component={ItemsRouter} />
        <Route path="/factory" exact component={Factory} />
        <Route path="/factory-classic" exact component={ClassicFactory} />
        <Redirect from="/" exact to={`/tcr/${tcr2Address}`} />
        <Route path="*" exact component={ErrorPage} />
      </Switch>
    </ApolloProvider>
  )
}

export default AppRouter;