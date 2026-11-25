import { useEffect, useState } from 'react'

/**
 * Current unix time in seconds, re-rendering every `intervalMs` (default 1s).
 * Countdowns derive from this so every timer on a page ticks together.
 */
const useNow = (intervalMs = 1000): number => {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      intervalMs,
    )
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export default useNow
