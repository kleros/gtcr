import { useEffect, useState } from 'react'

const useMetadata = ({ arbitrable, library }) => {
  const [metaEvidence, setMetaEvidence] = useState()
  const [error, setError] = useState()

  useEffect(() => {
    if (!arbitrable || !library) return
    ;(async () => {
      try {
        // Take the latest meta evidence.
        const logs = (
          await library.getLogs({
            ...arbitrable.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => arbitrable.interface.parseLog(log))
        if (logs.length === 0) return

        // Take the penultimate item. This is the most recent meta evidence
        // for registration requests.
        const { _evidence: metaEvidencePath } = logs[logs.length - 2].values
        const file = await (
          await fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath)
        ).json()

        setMetaEvidence({ ...file, address: arbitrable.address })
      } catch (err) {
        console.error('Error fetching meta evidence', err)
        setError('Error fetching meta evidence')
      }
    })()

    return () => {
      arbitrable.removeAllListeners(arbitrable.filters.MetaEvidence())
    }
  }, [arbitrable, library])

  return { metadata: metaEvidence && metaEvidence.metadata, error }
}

export default useMetadata
