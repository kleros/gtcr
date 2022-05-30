import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@apollo/client'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'

const useCheckLightCurate = (): [boolean, boolean] => {
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const { loading, data } = useQuery(TCR_EXISTENCE_TEST, {
    variables: {
      tcrAddress: tcrAddress.toLowerCase()
    }
  })
  const isLightCurate = useMemo<boolean>(() => data?.lregistry ?? false, [data])

  return [isLightCurate, loading]
}

export default useCheckLightCurate
