import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * True once the element has been in view (`ratio` of it, 35% by default, or
 * half the viewport for a block taller than that), then stays true. Draw-ins
 * and count-ups start on it, so motion below the fold is not spent before
 * anyone sees it. Reduced motion and browsers without IntersectionObserver
 * start in view.
 */
const useInView = <T extends Element>(ratio = 0.35) => {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setInView(true)
      return
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
      { threshold: [0, 0.05, 0.15, 0.25, 0.35, 0.5] },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ratio])

  return [ref, inView] as const
}

export default useInView
