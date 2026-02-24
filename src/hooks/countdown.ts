import { useEffect, useState, useRef } from 'react'
import humanizeDuration from 'humanize-duration'

const useHumanizedCountdown = (
  duration: number | null | undefined,
  largest?: number,
): string | null => {
  const [remainingTime, setRemainingTime] = useState<number | null | undefined>(
    duration,
  )
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync remainingTime when duration prop changes
  useEffect(() => {
    if (duration !== undefined && duration !== null) setRemainingTime(duration)
  }, [duration])

  // Set up interval once on mount, clean up on unmount
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemainingTime((prev) =>
        prev === undefined || prev === null ? prev : prev - 1000,
      )
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  if (remainingTime === undefined || remainingTime === null) return null

  const formattedTime = `${remainingTime >= 0 ? 'In ' : ''}${humanizeDuration(
    remainingTime,
    {
      largest: largest || 2,
      round: true,
    },
  )}${remainingTime < 0 ? ' ago' : ''}`

  return formattedTime
}

export default useHumanizedCountdown
