import { useMemo } from 'react'
import { BigNumber } from 'ethers'

const useAppealTime = (item: any, old: boolean = true): { appealRemainingTime?: number; appealRemainingTimeLoser?: number } =>
  useMemo(() => {
    if (!item) return {}
    if (!old && item.challenges.length === 0) return {}
    const round = old
      ? item.requests[0].rounds[0]
      : item.challenges[0].rounds[0]
    const { appealPeriodStart, appealPeriodEnd } = round
    const appealStart = BigNumber.from(appealPeriodStart)
    const appealEnd = BigNumber.from(appealPeriodEnd)
    const appealDuration = appealEnd.sub(appealStart)
    const appealEndLoser = appealStart.add(appealDuration.div(BigNumber.from(2)))

    const appealRemainingTime =
      appealEnd.toNumber() * 1000 - Math.floor(Date.now())
    const appealRemainingTimeLoser =
      appealEndLoser.toNumber() * 1000 - Math.floor(Date.now())

    return {
      appealRemainingTime,
      appealRemainingTimeLoser
    }
  }, [item, old])

export default useAppealTime
