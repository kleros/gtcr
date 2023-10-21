import { useMemo } from 'react'
import { BigNumber, bigNumberify } from 'ethers/utils'

const useAppealTime = item =>
  useMemo(() => {
    if (!item) return {}
    const round = item.requests[0].rounds[0]
    const { appealPeriodStart, appealPeriodEnd } = round
    const appealStart = new BigNumber(appealPeriodStart)
    const appealEnd = new BigNumber(appealPeriodEnd)
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
