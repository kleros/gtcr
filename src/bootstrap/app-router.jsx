import React, { useEffect, useMemo, useState } from 'react'
import {
  Route,
  Switch,
  Redirect
} from 'react-router-dom'
import { useHistory } from 'react-router'
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
import { TCR_EXISTENCE_TEST } from 'utils/graphql'

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
  const history = useHistory()
  const { networkId, error } = useWeb3Context();
  const isUnsupported = useMemo(() => error?.code === 'UNSUPPORTED_NETWORK', [error])
  const [pathResolved, setPathResolved] = useState(false);
  const [invalidTcrAddr, setInvalidTcrAddr] = useState(false);

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
    const checkPathValidation = async () => {
      const pathname = history.location.pathname;
      const search = history.location.search;
      const isOldPath = /\/tcr\/0x/.test(pathname);

      if (isOldPath) {
        const searchParams = new URLSearchParams(search);
        let chainId = null;
        const tcrAddress = pathname.match(/tcr\/(0x[0-9a-zA-Z]+)/)[1].toLowerCase();

        if (searchParams.has('chainId')) {
          chainId = searchParams.get('chainId');
        } else {
          const DEFAULT_TCR_ADDRESSES = JSON.parse(process.env.REACT_APP_DEFAULT_TCR_ADDRESSES);
          const ADDRs = Object.values(DEFAULT_TCR_ADDRESSES).map(addr => addr.toLowerCase());
          const CHAIN_IDs = Object.keys(DEFAULT_TCR_ADDRESSES);
          const tcrIndex = ADDRs.findIndex(addr => addr === tcrAddress);

          if (tcrIndex >= 0) {
            chainId = Number(CHAIN_IDs[tcrIndex]);
          } else {
            const SUBGRAPH_URLS = JSON.parse(process.env.REACT_APP_SUBGRAPH_URL);
            const queryResults = await Promise.all(Object.values(SUBGRAPH_URLS).map(subgraph => {
              const client = new ApolloClient({
                link: new HttpLink({ uri: subgraph }),
                cache: new InMemoryCache()
              });
              return client.query({
                query: TCR_EXISTENCE_TEST,
                variables: {
                  tcrAddress,
                },
              });
            }));
            const validIndex = queryResults.findIndex(
              ({ data: { lregistry, registry } }) => lregistry !== null || registry !== null
            );

            if (validIndex >= 0) {
              chainId = Object.keys(SUBGRAPH_URLS)[validIndex];
            }
          }
        }

        if (chainId) {
          const newPathname = pathname.replace('/tcr/', `/tcr/${chainId}/`);
          history.push({ pathname: newPathname, search });
        } else {
          setInvalidTcrAddr(true);
        }
      }
      setPathResolved(true);
    };
    checkPathValidation();
  }, [history, setPathResolved]);

  useEffect(() => {
    if (isUnsupported && window.ethereum) {
      const chainIdTokens = window.location.pathname.match(/\/tcr\/(\d+)\//);
      const chainId = hexlify(chainIdTokens?.length > 1 ? chainIdTokens[1] : DEFAULT_NETWORK);

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
  } else if (!networkId || !pathResolved) {
    return <Loading />
  } else if (invalidTcrAddr) {
    return <ErrorPage />
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