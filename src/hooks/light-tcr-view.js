import { useState, useEffect, useMemo } from 'react'
import { gql, useLazyQuery, useQuery } from '@apollo/client'
import { LIGHT_ITEMS_QUERY } from 'utils/graphql'

const lightCurateQuery = gql`
  query FetchAllInfoForLightCurate($tcrAddress: String!) {
    lregistry(id: $tcrAddress) {
      id
      connectedTCR
      submissionDeposit
      submissionBaseDeposit
      submissionChallengeDeposit
      removalDeposit
      removalBaseDeposit
      removalChallengeDeposit
      arbitrationCost
      challengePeriodDuration
      numberOfAbsent
      numberOfRegistered
      numberOfRegistrationRequested
      numberOfClearingRequested
      numberOfChallengedRegistrations
      numberOfChallengedClearing
      sharedStakeMultiplier
      winnerStakeMultiplier
      loserStakeMultiplier
      MULTIPLIER_DIVISOR
    }
    metaEvidences(where: { tcrAddress: $tcrAddress }) {
      id
      timestamp
      URI
      tcrAddress
    }
  }
`

const useLightTcrView = tcrAddress => {
  const [metaEvidences, setMetaEvidences] = useState([])
  const [metaEvidence, setMetaEvidence] = useState({})
  const [regData, setRegData] = useState({})
  const [error, setError] = useState()
  const [itemsWhere, setItemsWhere] = useState()
  const [pagination, setPagination] = useState()

  const { data: regQueryResult, loading: loadingRegistry } = useQuery(
    lightCurateQuery,
    {
      variables: {
        tcrAddress
      }
    }
  )

  const [
    execLightItemsQuery,
    { loading: loadingItems, data: itemsRawData }
  ] = useLazyQuery(LIGHT_ITEMS_QUERY)

  const loading = useMemo(() => loadingItems || loadingRegistry, [
    loadingItems,
    loadingRegistry
  ])

  useEffect(() => {
    if (loadingRegistry) return

    const handleRegistryQuery = async () => {
      const metaEvidences = await Promise.all(
        regQueryResult.metaEvidences
          .filter(({ URI }) => URI)
          .map(async metaEvidence => {
            if (metaEvidence.URI)
              try {
                const res = await fetch(
                  process.env.REACT_APP_IPFS_GATEWAY + metaEvidence.URI
                )
                const data = await res.json()
                return {
                  ...metaEvidence,
                  ...data
                }
              } catch (err) {
                setError(err)
                console.error(err)
              }
            else return metaEvidence
          })
      )
      setMetaEvidences(metaEvidences)
      setMetaEvidence(metaEvidences[metaEvidences.length - 2])
    }

    handleRegistryQuery()
    setRegData(regQueryResult.lregistry)
  }, [loadingRegistry, regQueryResult])

  useEffect(() => {
    if (!pagination || !itemsWhere) return

    execLightItemsQuery({
      variables: {
        skip: pagination.skip,
        first: pagination.first,
        where: itemsWhere
      }
    })
  }, [pagination, itemsWhere, execLightItemsQuery])

  useEffect(() => {}, [loadingItems, itemsRawData])

  return {
    loading,
    metaEvidence,
    metaEvidences,
    tcrAddress,
    regData,
    error,
    setPagination,
    setItemsWhere
  }
}

export default useLightTcrView
