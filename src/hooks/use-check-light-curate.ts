import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@apollo/client'
import { TCR_EXISTENCE_TEST } from 'utils/graphql'
import useCheckPermanentList from './use-check-permanent-list'

const useCheckLightCurate = (): {
  isLightCurate: boolean
  isClassicCurate: boolean
  isPermanentCurate: boolean
  checking: boolean
} => {
  const { tcrAddress, chainId } = useParams<{
    tcrAddress: string
    chainId: string
  }>()
  const { loading, data } = useQuery(TCR_EXISTENCE_TEST, {
    variables: {
      tcrAddress: tcrAddress.toLowerCase()
    }
  })

  const {
    isPermanentList,
    checking: permanentChecking
  } = useCheckPermanentList(tcrAddress, chainId)

  const isLightCurate = useMemo<boolean>(() => data?.lregistry ?? false, [data])
  const isClassicCurate = useMemo<boolean>(() => data?.registry ?? false, [
    data
  ])

  return {
    isLightCurate,
    isClassicCurate,
    isPermanentCurate: isPermanentList,
    checking: loading || permanentChecking
  }
}

export default useCheckLightCurate
