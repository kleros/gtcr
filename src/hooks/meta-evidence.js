import { useEffect, useState } from 'react'
import useGetLogs from './get-logs'

const useMetaEvidence = ({ arbitrable, library }) => {
  const [metaEvidence, setMetaEvidence] = useState()
  const [error, setError] = useState()
  const getLogs = useGetLogs(library)

  useEffect(() => {
    if (!arbitrable || !library) return
    ;(async () => {
      try {
        // Take the latest meta evidence.
        const logs = (
          await getLogs({
            ...arbitrable.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => arbitrable.interface.parseLog(log))
        if (logs.length === 0)
          throw new Error(
            `No meta evidence available for TCR at. ${arbitrable.address}`
          )

        // Take the penultimate item. This is the most recent meta evidence
        // for registration requests.
        const { _evidence: metaEvidencePath } = logs[logs.length - 2].values
        const file = await (
          await fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath)
        ).json()

        setMetaEvidence({ ...file, address: arbitrable.address })
      } catch (err) {
        console.error('Error fetching meta evidence', err)
        setError(err)
      }
    })()
  }, [arbitrable, library])

  return { metaEvidence, error }
}

export default useMetaEvidence
