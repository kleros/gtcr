import { useEffect, useState } from 'react'
import humanizeDuration from 'humanize-duration'

const useHumanizedCountdown = (duration, largest) => {
  const [remainingTime, setRemainingTime] = useState()

  useEffect(() => {
    if (!duration) return
    if (!remainingTime) {
      setRemainingTime(duration)
      return
    }
    const id = setInterval(() => {
      setRemainingTime(remainingTime =>
        remainingTime > 0 ? remainingTime - 1000 : 0
      )
    }, 1000)
    return () => clearInterval(id)
  }, [duration, remainingTime])

  const formattedTime = `${remainingTime >= 0 ? 'In ' : ''}${humanizeDuration(
    remainingTime,
    {
      largest: largest || 2,
      round: true
    }
  )}${remainingTime < 0 ? ' ago' : ''}`

  return formattedTime
}

export default useHumanizedCountdown
