import { useMemo } from 'react'
import { DISPUTE_STATUS } from '../utils/item-status'
import { bigNumberify } from 'ethers/utils'

const useAppealTime = item =>
  useMemo(() => {
    if (!item || item.disputeStatus !== DISPUTE_STATUS.APPEALABLE) return {}
    const { appealStart, appealEnd } = item
    const appealDuration = appealEnd.sub(appealStart)
    const appealEndLoser = appealStart.add(appealDuration.div(bigNumberify(2)))

    const appealRemainingTime =
      appealEnd.toNumber() * 1000 - Math.floor(Date.now())
    const appealRemainingTimeLoser =
      appealEndLoser.toNumber() * 1000 - Math.floor(Date.now())

    return {
      appealRemainingTime,
      appealRemainingTimeLoser
    }
  }, [item])

export default useAppealTime
