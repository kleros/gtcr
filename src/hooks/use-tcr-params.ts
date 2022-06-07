import { useMemo } from 'react'
import { useParams } from 'react-router'

type TcrParmas = {
  tcrAddress: string
  itemID?: string
  chainId: string
}

const useTcrParams = (): TcrParmas => {
  const params = useParams<TcrParmas>()
  const validatedParams = useMemo(() => {
    const newParams: TcrParmas = { ...params }
    if (!params) return newParams
    if (params.tcrAddress)
      newParams.tcrAddress = params.tcrAddress.toLowerCase()
    if (params.itemID) newParams.itemID = params.itemID.toLowerCase()
    return newParams
  }, [params])

  return validatedParams
}

export default useTcrParams
