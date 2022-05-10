import { useEffect, useState } from 'react'
import { useHistory } from 'react-router'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'
import { ApolloClient, InMemoryCache } from '@apollo/client'
import { HttpLink } from '@apollo/client/link/http'

const usePathValidation = () => {
  const history = useHistory()
  const [pathResolved, setPathResolved] = useState(false)
  const [invalidTcrAddr, setInvalidTcrAddr] = useState(false)

  useEffect(() => {
    const checkPathValidation = async () => {
      const pathname = history.location.pathname
      const search = history.location.search
      const isOldPath = /\/tcr\/0x/.test(pathname)

      if (isOldPath) {
        const searchParams = new URLSearchParams(search)
        let chainId = null
        const tcrAddress = pathname
          .match(/tcr\/(0x[0-9a-zA-Z]+)/)[1]
          .toLowerCase()

        if (searchParams.has('chainId')) chainId = searchParams.get('chainId')
        else {
          const DEFAULT_TCR_ADDRESSES = JSON.parse(
            process.env.REACT_APP_DEFAULT_TCR_ADDRESSES
          )
          const ADDRs = Object.values(DEFAULT_TCR_ADDRESSES).map(addr =>
            addr.toLowerCase()
          )
          const CHAIN_IDS = Object.keys(DEFAULT_TCR_ADDRESSES)
          const tcrIndex = ADDRs.findIndex(addr => addr === tcrAddress)

          if (tcrIndex >= 0) chainId = Number(CHAIN_IDS[tcrIndex])
          else {
            const SUBGRAPH_URLS = JSON.parse(process.env.REACT_APP_SUBGRAPH_URL)
            const queryResults = await Promise.all(
              Object.values(SUBGRAPH_URLS).map(subgraph => {
                const client = new ApolloClient({
                  link: new HttpLink({ uri: subgraph }),
                  cache: new InMemoryCache()
                })
                return client.query({
                  query: TCR_EXISTENCE_TEST,
                  variables: {
                    tcrAddress
                  }
                })
              })
            )
            const validIndex = queryResults.findIndex(
              ({ data: { lregistry, registry } }) =>
                lregistry !== null || registry !== null
            )

            if (validIndex >= 0)
              chainId = Object.keys(SUBGRAPH_URLS)[validIndex]
          }
        }

        if (chainId) {
          const newPathname = pathname.replace('/tcr/', `/tcr/${chainId}/`)
          history.push({ pathname: newPathname, search })
        } else setInvalidTcrAddr(true)
      }
      setPathResolved(true)
    }
    checkPathValidation()
  }, [history, setPathResolved])

  return [pathResolved, invalidTcrAddr]
}

export default usePathValidation
