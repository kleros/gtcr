import { useCallback, useEffect, useState } from 'react'

/**
 * For a panel kept in view with `position: sticky; top: var(--stick, …)`:
 * under the app bar while it fits the window, and, when it is taller than
 * the window, high enough that its bottom (where the actions are) stays in
 * view instead of below the fold for as long as the page scrolls. Sets
 * --stick on the element from its height and the window's, kept current as
 * either changes. A callback ref, so a panel that appears after the page's
 * loading state is followed too.
 */
const useStickyTop = (gap = 20) => {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const ref = useCallback((element: HTMLElement | null) => setNode(element), [])

  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const update = () => {
      // The token lives on body, not on the root element.
      const appBar =
        parseFloat(
          getComputedStyle(document.body).getPropertyValue('--app-bar-height'),
        ) || 64
      const top = Math.min(
        appBar + gap,
        window.innerHeight - node.offsetHeight - gap,
      )
      node.style.setProperty('--stick', `${Math.round(top)}px`)
    }
    const observer = new ResizeObserver(update)
    observer.observe(node)
    window.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [node, gap])

  return ref
}

export default useStickyTop
