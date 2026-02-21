import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import useGetLogs from './get-logs'
import { parseIpfs } from 'utils/ipfs-parse'

const useMetaEvidence = ({
  arbitrable,
  library,
}: {
  arbitrable: ethers.Contract | null
  library: EthersLibrary | null
}): { metaEvidence: MetaEvidence | undefined; error: unknown } => {
  const [metaEvidence, setMetaEvidence] = useState<MetaEvidence>()
  const [error, setError] = useState<unknown>()
  const getLogs = useGetLogs(library)

  useEffect(() => {
    if (!arbitrable || !library) return
    if (!getLogs) return
    ;(async () => {
      try {
        // Take the latest meta evidence.
        const logs = (
          await getLogs({
            ...arbitrable.filters.MetaEvidence(),
            fromBlock: 0,
          })
        ).map((log) => arbitrable.interface.parseLog(log))
        if (logs.length === 0)
          throw new Error(
            `No meta evidence available for TCR at. ${arbitrable.address}`,
          )

        // Take the penultimate item. This is the most recent meta evidence
        // for registration requests.
        const { _evidence: metaEvidencePath } = logs[logs.length - 2].values
        const file = await (await fetch(parseIpfs(metaEvidencePath))).json()

        setMetaEvidence({ ...file, address: arbitrable.address })
      } catch (err) {
        console.error('Error fetching meta evidence', err)
        setError(err)
      }
    })()
  }, [arbitrable, library, getLogs])

  return { metaEvidence, error }
}

export default useMetaEvidence
