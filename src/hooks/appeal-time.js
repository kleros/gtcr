import { useMemo } from 'react'
import { DISPUTE_STATUS } from '../utils/item-status'

const useAppealTime = item =>
  useMemo(() => {
    if (!item || item.disputeStatus !== DISPUTE_STATUS.APPEALABLE) return {}
    const { appealEnd } = item
    const appealRemainingTime = appealEnd.toNumber() * 1000 - Date.now()
    return {
      appealRemainingTime,
      appealRemainingTimeLoser: appealRemainingTime / 2
    }
  }, [item])

export default useAppealTime
