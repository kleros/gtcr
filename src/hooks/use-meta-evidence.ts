import { useQuery } from '@apollo/client'
import { useEffect, useState } from 'react'
import { GQL_META_EVIDENCES } from 'utils/graphql'

const useMetaEvidence = (tcrAddress: string) => {
  const [metaEvidence, setMetaEvidence] = useState()
  const [error, setError] = useState<any>()

  const { data, loading } = useQuery(GQL_META_EVIDENCES, {
    variables: {
      tcrAddress
    }
  })

  useEffect(() => {
    if (loading || !data) return

    const handleQueryResult = async () => {
      const metaEvidences = data.metaEvidences
      const metaEvidence = metaEvidences[metaEvidences.length - 2]
      try {
        if (metaEvidence.URI) {
          const ipfsURI = process.env.REACT_APP_IPFS_GATEWAY + metaEvidence.URI
          const res = await fetch(ipfsURI)
          const data = await res.json()

          setMetaEvidence({
            ...metaEvidence,
            ...data
          })
        } else setMetaEvidence(metaEvidence)
      } catch (err) {
        setError(err)
        console.error(err)
      }
    }

    handleQueryResult()
  }, [loading, data])

  return {
    metaEvidence,
    loading,
    error
  }
}

export default useMetaEvidence
