import { useState, useEffect } from 'react'
import { gql, useQuery } from '@apollo/client'

const lightCurateQuery = gql`
  query FetchAllInfoForLightCurate($tcrAddress: String!) {
    lregistry(id: $tcrAddress) {
      connectedTCR
      submissionDeposit
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
      timestamp
      id
      URI
      tcrAddress
    }
  }
`

const useLightTcrView = tcrAddress => {
  const [metaEvidences, setMetaEvidences] = useState([])
  const [metaEvidence, setMetaEvidence] = useState({})
  const [regData, setRegData] = useState({})

  const { data, loading } = useQuery(lightCurateQuery, {
    variables: {
      tcrAddress
    }
  })

  useEffect(() => {
    if (loading) return

    const handleData = async () => {
      const metaEvidences = await Promise.all(
        data.metaEvidences
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
                console.error(err)
              }
            else return metaEvidence
          })
      )
      setMetaEvidences(metaEvidences)
      setMetaEvidence(metaEvidences[metaEvidences.length - 2])
    }

    handleData()
    setRegData(data.lregistry)
  }, [loading, data])

  return {
    loading,
    metaEvidence,
    metaEvidences,
    tcrAddress,
    regData
  }
}

export default useLightTcrView
