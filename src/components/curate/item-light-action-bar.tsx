import React, { useEffect, useState } from 'react'
import styled from 'styled-components'

/*
 * On phones the item page's action card becomes a sticky bottom bar: the
 * status on top, the one action (with its amount) full width under it.
 * A frosted surface so the page reads through as it scrolls. Hidden above
 * 720px, where the right rail holds the action card.
 *
 * It steps aside (slides down, leaves the tab order and the accessibility
 * tree) while the action card, the evidence composer or the app footer is
 * on screen, so it never repeats the card's button or covers the footer.
 * Shared by the Light, Classic and Stake item pages.
 */

const WATCHED_IDS = ['item-status-card', 'evidence-composer']

const hasObserver = () =>
  typeof window !== 'undefined' && 'IntersectionObserver' in window

const Bar = styled.div<{ $hidden: boolean }>`
  display: none;

  @media (max-width: 720px) {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--glass-border);
    border-radius: 18px 18px 0 0;
    background: color-mix(in srgb, var(--color-surface) 84%, transparent);
    box-shadow:
      inset 0 1px 0 var(--glass-highlight),
      var(--shadow-overlay);
    backdrop-filter: blur(var(--blur)) saturate(140%);
    -webkit-backdrop-filter: blur(var(--blur)) saturate(140%);
    transform: ${({ $hidden }) =>
      $hidden ? 'translateY(calc(100% + 8px))' : 'none'};
    visibility: ${({ $hidden }) => ($hidden ? 'hidden' : 'visible')};
    /* Visibility flips after the slide when hiding, at once when showing. */
    transition:
      transform 180ms ease,
      visibility 0s linear ${({ $hidden }) => ($hidden ? '180ms' : '0s')};
  }

  @media (max-width: 720px) and (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const StatusSlot = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`

/** True while any of the watched blocks intersects the viewport. */
const useStepAside = () => {
  const [aside, setAside] = useState(false)

  useEffect(() => {
    if (!hasObserver()) return
    const visible = new Map<Element, boolean>()
    const update = () => {
      for (const element of [...visible.keys()])
        if (!element.isConnected) visible.delete(element)
      setAside([...visible.values()].some(Boolean))
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          visible.set(entry.target, entry.isIntersecting)
        update()
      },
      // Threshold 0: the bar starts to leave as soon as an edge enters.
      { threshold: 0 },
    )
    // The composer and the card can mount, unmount or be replaced after
    // the bar (data loading, a request resolving): watch for them.
    const sync = () => {
      const targets = [
        ...WATCHED_IDS.map((id) => document.querySelector(`#${id}`)),
        document.querySelector('footer'),
      ].filter((element): element is HTMLElement => !!element)
      let changed = false
      for (const element of targets)
        if (!visible.has(element)) {
          visible.set(element, false)
          observer.observe(element)
        }
      for (const element of [...visible.keys()])
        if (!targets.includes(element as HTMLElement)) {
          observer.unobserve(element)
          visible.delete(element)
          changed = true
        }
      if (changed) update()
    }
    sync()
    let frame = 0
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(sync)
    })
    mutations.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      mutations.disconnect()
      observer.disconnect()
    }
  }, [])

  return aside
}

export const StickyActionBar = ({
  status,
  action,
}: {
  status: React.ReactNode
  action: React.ReactNode
}) => {
  const aside = useStepAside()
  return (
    <Bar
      role="region"
      aria-label="Entry actions"
      $hidden={aside}
      aria-hidden={aside || undefined}
      // React 18 passes unknown attributes through as strings.
      {...(aside ? { inert: '' } : {})}
    >
      <StatusSlot>{status}</StatusSlot>
      {action}
    </Bar>
  )
}

const Spacer = styled.div`
  display: none;

  @media (max-width: 720px) {
    display: block;
    height: calc(120px + env(safe-area-inset-bottom));
  }
`

/**
 * Keeps the page bottom clear of the fixed bar on phones, only where the
 * bar cannot step aside for the footer (no IntersectionObserver).
 */
export const StickyActionBarSpacer = (
  props: React.HTMLAttributes<HTMLDivElement>,
) => (hasObserver() ? null : <Spacer aria-hidden {...props} />)

export default StickyActionBar
