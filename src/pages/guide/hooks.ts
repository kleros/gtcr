import { useEffect, useState, type RefObject } from 'react'

/** Media-query match that follows changes (resizes, OS settings). */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

export const DESKTOP_QUERY = '(min-width: 1024px)'

export const useReducedMotion = (): boolean =>
  useMediaQuery('(prefers-reduced-motion: reduce)')

/**
 * True once the element has been at least `threshold` visible. It stays true:
 * drawings animate in once and then hold still while people read.
 */
export const useInView = (
  ref: RefObject<Element>,
  threshold = 0.35,
): boolean => {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, seen, threshold])
  return seen
}

/** The app bar height from the design tokens (64px when unreadable). */
export const appBarHeight = (): number => {
  const raw = getComputedStyle(document.body).getPropertyValue(
    '--app-bar-height',
  )
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : 64
}

/** Runs `measure` now and on every scroll or resize, at most once a frame. */
export const useViewportMeasure = (measure: () => void) => {
  useEffect(() => {
    let frame = 0
    const run = () => {
      frame = 0
      measure()
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(run)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [measure])
}
