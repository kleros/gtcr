import { useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'
import useTcrParams from './use-tcr-params'

const useCheckLightCurate = (): {
  isLightCurate: boolean
  checking: boolean
} => {
  const { tcrAddress } = useTcrParams()
  const { loading, data } = useQuery(TCR_EXISTENCE_TEST, {
    variables: {
      tcrAddress
    }
  })
  const isLightCurate = useMemo<boolean>(() => data?.lregistry ?? false, [data])

  return { isLightCurate, checking: loading }
}

export default useCheckLightCurate
