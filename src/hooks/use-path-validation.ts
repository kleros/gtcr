import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { request } from 'graphql-request'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'
import { defaultTcrAddresses, subgraphUrl } from 'config/tcr-addresses'

const usePathValidation = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [pathResolved, setPathResolved] = useState<boolean>(false)
  const [invalidTcrAddr, setInvalidTcrAddr] = useState<boolean>(false)

  useEffect(() => {
    const checkPathValidation = async () => {
      const pathname = location.pathname
      const search = location.search
      const isOldPath = /\/tcr\/0x/.test(pathname)

      if (isOldPath) {
        let chainId = null
        const matches = pathname.match(/tcr\/(0x[0-9a-zA-Z]+)/)
        const tcrAddress = matches ? matches[1].toLowerCase() : null

        const ADDRs = Object.values(defaultTcrAddresses).map((addr) =>
          (addr as string).toLowerCase(),
        )
        const CHAIN_IDS = Object.keys(defaultTcrAddresses)
        const tcrIndex = ADDRs.findIndex((addr) => addr === tcrAddress)

        if (tcrIndex >= 0) chainId = Number(CHAIN_IDS[tcrIndex])
        else {
          const queryResults = await Promise.all(
            Object.values(subgraphUrl).map((subgraph) =>
              request(subgraph as string, TCR_EXISTENCE_TEST, { tcrAddress })
                .then((data) => ({ data }))
                .catch(() => ({ data: { lregistry: null, registry: null } })),
            ),
          )
          const validIndex = queryResults.findIndex(
            ({ data: { lregistry, registry } }) =>
              lregistry !== null || registry !== null,
          )

          if (validIndex >= 0) chainId = Object.keys(subgraphUrl)[validIndex]
        }

        if (chainId) {
          const newPathname = pathname.replace('/tcr/', `/tcr/${chainId}/`)
          navigate({ pathname: newPathname, search })
        } else setInvalidTcrAddr(true)
      }
      setPathResolved(true)
    }
    checkPathValidation()
  }, [navigate, location, setPathResolved])

  return [pathResolved, invalidTcrAddr]
}

export default usePathValidation
