import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@apollo/client'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'

const useCheckLightCurate = (): {
  isLightCurate: boolean
  checking: boolean
} => {
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const { loading, data } = useQuery(TCR_EXISTENCE_TEST, {
    variables: {
      tcrAddress: tcrAddress.toLowerCase()
    }
  })
  const isLightCurate = useMemo<boolean>(() => data?.lregistry ?? false, [data])

  return { isLightCurate, checking: loading }
}

export default useCheckLightCurate
