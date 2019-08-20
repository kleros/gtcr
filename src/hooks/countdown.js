import { useEffect, useState } from 'react'
import humanizeDuration from 'humanize-duration'

const useHumanizedCountdown = (duration, callback) => {
  const [remainingTime, setRemainingTime] = useState()
  const [callbackCalled, setCallbackCalled] = useState()

  useEffect(() => {
    if (!duration) return
    if (!remainingTime) {
      setRemainingTime(duration)
      return
    }
    const id = setInterval(() => {
      setRemainingTime(remainingTime => remainingTime + 1000)
      if (callback && !callbackCalled && remainingTime > 0) {
        callback()
        setCallbackCalled(true)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [callback, callbackCalled, duration, remainingTime])

  const formattedTime = `${remainingTime >= 0 ? 'In ' : ''}${humanizeDuration(
    remainingTime,
    {
      largest: 2,
      round: true
    }
  )}${remainingTime < 0 ? ' ago' : ''}`

  return formattedTime
}

export default useHumanizedCountdown
