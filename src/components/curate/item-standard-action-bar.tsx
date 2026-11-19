import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

/*
 * The entry's one action, kept within reach once the action itself has left
 * the screen. The card lives in the entry hero (round 5), not in a sticky
 * rail, so without this bar the action would scroll away with the hero
 * while the reader goes down the fields, the history and the evidence.
 *
 * On a phone, and wherever the hero stacks (1000px and narrower), it is a
 * bottom bar: the status on top, the one action (with its amount) full
 * width under it. Wider, it floats as a slim bar centred above the bottom
 * edge: the status on the left, the action at its natural width on the
 * right. A frosted surface either way, so the page reads through as it
 * scrolls; with no action to offer there is nothing to keep in reach, so
 * the wide bar is not drawn at all.
 *
 * It shows only while the card's own action (its action button, or the
 * case panel's action group, which takes the card's id in court) is not at
 * least half on screen, counting what sits under the sticky app bar as off
 * screen, so a sliver of the card's edge or a button tucked under the app
 * bar never hides the one way to act. It
 * also stays away while the evidence composer is on screen, when its action
 * is "Add evidence", and, on wide screens, until the reader has reached the
 * hero's end, so it never floats over the hero's own fields. At the end of
 * the page it rides just above the footer at every width (a short reserve
 * at the page's end gives the taller bottom bar its room), so the action
 * is in reach even at the very end of a short page. Until the card has
 * mounted it stays away, so it never flashes over a card about to appear.
 * Shared by the Standard and Stake item pages.
 */

const CARD_ID = 'item-status-card'
const COMPOSER_ID = 'evidence-composer'
/** The gap the bar keeps above the footer when it rides on it. */
const ABOVE_FOOTER = 12
/** Where the bar floats rather than spanning the bottom edge. */
const WIDE = '(min-width: 1001px)'

const Bar = styled.div<{ $hidden: boolean; $empty: boolean }>`
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
  /* A solid fill first: a browser without color-mix() (iOS before 16.2,
     Chrome before 111) drops the next line and keeps this one. */
  background: var(--color-surface);
  background: color-mix(in srgb, var(--color-surface) 84%, transparent);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-overlay);
  backdrop-filter: blur(var(--blur)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--blur)) saturate(140%);
  /* Riding on the footer (--lift > 0): a slab of its own, rounded all round. */
  &[data-lifted] {
    bottom: calc(var(--lift, 0px) + ${ABOVE_FOOTER}px);
    padding-bottom: 12px;
    border: 1px solid var(--glass-border);
    border-radius: 18px;
  }
  /* Far enough to clear the wide bar's 16px lift too. */
  transform: ${({ $hidden }) =>
    $hidden ? 'translateY(calc(100% + 24px))' : 'none'};
  visibility: ${({ $hidden }) => ($hidden ? 'hidden' : 'visible')};
  /* Visibility flips after the slide when hiding, at once when showing. */
  transition:
    transform 180ms ease,
    visibility 0s linear ${({ $hidden }) => ($hidden ? '180ms' : '0s')};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  /* Wide: a slim floating bar, centred, transform kept for the slide. It
     rises by --lift, the part of the footer on screen (useBarPlacement). */
  @media (min-width: 1001px) {
    display: ${({ $empty }) => ($empty ? 'none' : 'flex')};
    &,
    &[data-lifted] {
      bottom: calc(16px + var(--lift, 0px));
    }
    width: min(680px, calc(100% - 48px));
    margin: 0 auto;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 10px 10px 10px 20px;
    border: 1px solid var(--glass-border);
    border-radius: 18px;

    > :last-child {
      flex: 0 0 auto;
      width: auto;
      max-width: 60%;
    }
  }
`

const StatusSlot = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`

/** True while the window is wide enough for the floating bar. */
const useWide = () => {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE).matches,
  )
  useEffect(() => {
    const query = window.matchMedia?.(WIDE)
    if (!query) return
    const change = () => setWide(query.matches)
    change()
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return wide
}

/**
 * True while any of these elements shows between the app bar and the fold,
 * at least `share` of its height: a button with only its edge in view is
 * not one a reader can comfortably press.
 */
const anyOnScreen = (elements: Iterable<Element>, top: number, share = 0) => {
  for (const element of elements) {
    const rect = element.getBoundingClientRect()
    if (rect.height <= 0) continue
    const shown =
      Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, top)
    if (shown > 0 && shown >= rect.height * share) return true
  }
  return false
}

/**
 * Whether the bar steps aside, and its lift above the footer, measured on
 * every scroll, resize and DOM change (one frame at a time). The lift is
 * written straight to the bar as --lift, with data-lifted while it rides on
 * the footer, so scrolling never re-renders the page; only a change of
 * side re-renders.
 */
const useBarPlacement = (
  bar: React.RefObject<HTMLDivElement>,
  evidence: boolean,
  wide: boolean,
) => {
  // Aside until the first measure finds the card.
  const [aside, setAside] = useState(true)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const header = document.querySelector('header')
      const top = header
        ? Math.max(0, header.getBoundingClientRect().bottom)
        : 0
      const card = document.querySelector(`#${CARD_ID}`)
      const composer = evidence
        ? document.querySelector(`#${COMPOSER_ID}`)
        : null
      const hero = wide ? document.querySelector('[data-entry-hero]') : null
      const element = bar.current
      const height = element ? element.getBoundingClientRect().height : 0
      // On wide screens the hero must have ended above the bar's own band.
      const inHero =
        !!hero &&
        hero.getBoundingClientRect().bottom > window.innerHeight - height - 32
      // The card's own action (the action button, or the case panel's
      // action group in court); the whole card where it marks neither.
      const actions = card
        ? card.querySelectorAll('#item-action-button, [data-entry-action]')
        : []
      const away =
        !card ||
        anyOnScreen(actions.length > 0 ? actions : [card], top, 0.5) ||
        (!!composer && anyOnScreen([composer], top)) ||
        inHero
      setAside(away)
      if (!element) return
      const footer = document.querySelector('footer')
      const lift = footer
        ? Math.max(
            0,
            Math.round(window.innerHeight - footer.getBoundingClientRect().top),
          )
        : 0
      element.style.setProperty('--lift', `${lift}px`)
      element.toggleAttribute('data-lifted', lift > 0)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // The card, the composer and the hero can mount, change size or be
    // replaced after the bar (data loading, a request resolving).
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      mutations.disconnect()
    }
  }, [bar, evidence, wide])

  return aside
}

export const StickyActionBar = ({
  status,
  action,
  evidence = false,
}: {
  status: React.ReactNode
  action: React.ReactNode
  /**
   * The action is "Add evidence", which the evidence composer repeats: the
   * bar steps aside while the composer is on screen too.
   */
  evidence?: boolean
}) => {
  const wide = useWide()
  const bar = useRef<HTMLDivElement>(null)
  const aside = useBarPlacement(bar, evidence, wide)
  return (
    <Bar
      ref={bar}
      role="region"
      aria-label="Entry actions"
      $hidden={aside}
      $empty={!action}
      aria-hidden={aside || undefined}
      // React 18 passes unknown attributes through as strings.
      {...(aside ? { inert: '' } : {})}
    >
      <StatusSlot>{status}</StatusSlot>
      {action}
    </Bar>
  )
}

/*
 * The page's end, kept clear for the bottom bar where it rides on the
 * footer: the page's own 64px bottom padding is shorter than the bar (about
 * 99px) plus its gaps. The wide bar fits the padding as it is.
 */
const Spacer = styled.div`
  height: 64px;

  @media (min-width: 1001px) {
    display: none;
  }
`

/** Keeps the page's end clear for the bottom bar when it rides on the footer. */
export const StickyActionBarSpacer = (
  props: React.HTMLAttributes<HTMLDivElement>,
) => <Spacer aria-hidden {...props} />

export default StickyActionBar
