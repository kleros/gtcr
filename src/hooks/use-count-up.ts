import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))

/**
 * Animates a number from its previous value to `target` (first run: from 0).
 * Respects reduced motion by jumping straight to the target.
 */
const useCountUp = (target: number | undefined, duration = 1400): number => {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  const frame = useRef<number>()

  useEffect(() => {
    if (target === undefined || !Number.isFinite(target)) return
    if (prefersReducedMotion()) {
      from.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    const origin = from.current
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const next = origin + (target - origin) * easeOutExpo(t)
      setValue(next)
      if (t < 1) frame.current = requestAnimationFrame(step)
      else from.current = target
    }
    frame.current = requestAnimationFrame(step)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      from.current = target
    }
  }, [target, duration])

  return value
}

export default useCountUp
