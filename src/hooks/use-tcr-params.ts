import { useMemo } from 'react'
import { useParams } from 'react-router'

type TcrParams = {
  tcrAddress: string
  itemID?: string
  chainId: string
}

const useTcrParams = (): TcrParams => {
  const params = useParams<TcrParams>()
  return useMemo(() => {
    const newParams: TcrParams = { ...params }
    if (!params) return newParams
    if (params.tcrAddress)
      newParams.tcrAddress = params.tcrAddress.toLowerCase()
    if (params.itemID) newParams.itemID = params.itemID.toLowerCase()
    return newParams
  }, [params])
}

export default useTcrParams
