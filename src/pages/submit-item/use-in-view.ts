import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * True once 35% of the element (or half the viewport, for a block taller
 * than that) has been in view, then stays true. The panel's count-up, bar
 * and window draw-in start on it, so on phones, where the panel sits under
 * the form, they play when someone reaches it. Reduced motion and browsers
 * without IntersectionObserver start in view.
 */
export const useInView = <T extends Element>(ratio = 0.35) => {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setInView(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.some(
          (entry) =>
            entry.isIntersecting &&
            (entry.intersectionRatio >= ratio ||
              entry.intersectionRect.height >= window.innerHeight * 0.5),
        )
        if (seen) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: [0, 0.1, 0.2, 0.35, 0.5] },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ratio])

  return [ref, inView] as const
}

export default useInView
