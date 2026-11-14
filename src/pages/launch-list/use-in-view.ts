import { useEffect, useRef, useState } from 'react'

/**
 * True once the element has been at least `threshold` visible, then it stays
 * true: drawings and count-ups start when someone can see them, run once and
 * hold still. Without IntersectionObserver it is true at once.
 */
export const useInView = <T extends Element>(threshold = 0.35) => {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || inView) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [inView, threshold])

  return [ref, inView] as const
}

export default useInView
