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
      const me = metaEvidences[metaEvidences.length - 2]
      try {
        if (me.URI) {
          const ipfsURI = process.env.REACT_APP_IPFS_GATEWAY + me.URI
          const res = await fetch(ipfsURI)
          const ipfsContent = await res.json()

          setMetaEvidence({
            ...me,
            ...ipfsContent
          })
        } else setMetaEvidence(me)
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
