import { useEffect, useState } from 'react'
import { useHistory } from 'react-router'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'
import { ApolloClient, InMemoryCache } from '@apollo/client'
import { HttpLink } from '@apollo/client/link/http'
import { useWeb3Context } from 'web3-react'
import { SAVED_NETWORK_KEY } from 'utils/string'
import { DEFAULT_NETWORK } from 'config/networks'

const usePathValidation = () => {
  const {
    push,
    location: { pathname, search }
  } = useHistory()
  const { networkId, account } = useWeb3Context()

  const [pathResolved, setPathResolved] = useState<boolean>(false)
  const [invalidTcrAddr, setInvalidTcrAddr] = useState<boolean>(false)

  useEffect(() => {
    if (networkId === undefined) return
    if (account) return // their provider will prompt to change it
    const newPathRegex = /\/tcr\/(\d+)\/0x/
    if (!newPathRegex.test(pathname)) return // let it redirect to new path first
    const matches = pathname.match(newPathRegex)
    const chainId = matches ? matches[1] : DEFAULT_NETWORK
    const pathChainId = Number(chainId)
    if (networkId !== pathChainId) {
      localStorage.setItem(SAVED_NETWORK_KEY, pathChainId.toString())
      window.location.reload()
    }
  }, [pathname, networkId, account])

  useEffect(() => {
    const checkPathValidation = async () => {
      const isOldPath = /\/tcr\/0x/.test(pathname)

      if (isOldPath) {
        let chainId = null
        const matches = pathname.match(/tcr\/(0x[0-9a-zA-Z]+)/)
        const tcrAddress = matches ? matches[1].toLowerCase() : null

        const DEFAULT_TCR_ADDRESSES = JSON.parse(
          process.env.REACT_APP_DEFAULT_TCR_ADDRESSES as string
        )
        const ADDRs = Object.values(DEFAULT_TCR_ADDRESSES).map(addr =>
          (addr as string).toLowerCase()
        )
        const CHAIN_IDS = Object.keys(DEFAULT_TCR_ADDRESSES)
        const tcrIndex = ADDRs.findIndex(addr => addr === tcrAddress)

        if (tcrIndex >= 0) chainId = Number(CHAIN_IDS[tcrIndex])
        else {
          const SUBGRAPH_URLS = JSON.parse(
            process.env.REACT_APP_SUBGRAPH_URL as string
          )
          const queryResults = await Promise.all(
            Object.values(SUBGRAPH_URLS).map(subgraph => {
              const client = new ApolloClient({
                link: new HttpLink({ uri: subgraph as string }),
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

          if (validIndex >= 0) chainId = Object.keys(SUBGRAPH_URLS)[validIndex]
        }

        if (chainId) {
          const newPathname = pathname
            .replace('/tcr/', `/tcr/${chainId}/`)
            .toLowerCase()
          push({ pathname: newPathname, search })
        } else setInvalidTcrAddr(true)
      }
      setPathResolved(true)
    }
    checkPathValidation()
  }, [pathname, search, push, setPathResolved])

  return [pathResolved, invalidTcrAddr]
}

export default usePathValidation
