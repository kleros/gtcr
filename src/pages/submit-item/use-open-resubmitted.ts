import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

/**
 * Where a resubmission from an entry's page lands. An entry's ID comes from
 * its data, so a resubmission with any value changed is a new entry: its
 * page opens (it says it is being indexed until the indexer has it), instead
 * of leaving the reader on the old entry, which still offers "Resubmit".
 * Unchanged data keeps the same entry, which refreshes where it is.
 */
const useOpenResubmitted = () => {
  const navigate = useNavigate()
  // The entry page's own route: /tcr/:chainId/:tcrAddress/:itemID.
  const {
    chainId,
    tcrAddress,
    itemID: currentItemID,
  } = useParams<{
    chainId: string
    tcrAddress: string
    itemID: string
  }>()
  return useCallback(
    (itemID?: string) => {
      if (!itemID || !currentItemID || !chainId || !tcrAddress) return
      if (itemID.toLowerCase() === currentItemID.toLowerCase()) return
      navigate(`/tcr/${chainId}/${tcrAddress}/${itemID}`, {
        state: { submittedAt: Date.now() },
      })
    },
    [chainId, currentItemID, navigate, tcrAddress],
  )
}

export default useOpenResubmitted
