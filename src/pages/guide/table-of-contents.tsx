import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { Label } from 'components/curate/primitives'
import { appBarHeight, useReducedMotion, useViewportMeasure } from './hooks'
import type { GuideSectionLink } from './content'

/*
 * The guide's table of contents. On desktop it is a sticky rail beside the
 * text: a hairline track, a glowing marker that springs to the section being
 * read, and the track filled up to it. On phones it becomes a sticky strip of
 * section pills under the app bar, with the same sliding marker.
 */

const SPRING = '420ms cubic-bezier(0.34, 1.32, 0.64, 1)'

/** The id of the last section whose top has scrolled under the reading line. */
const useActiveSection = (ids: string[], offset: number): string => {
  const [active, setActive] = useState<string>(ids[0])
  const measure = useMemo(
    () => () => {
      const threshold = appBarHeight() + offset
      let current = ids[0]
      for (const id of ids) {
        const element = document.querySelector(`#${id}`)
        if (element && element.getBoundingClientRect().top <= threshold)
          current = id
      }
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      setActive(atBottom ? ids[ids.length - 1] : current)
    },
    [ids, offset],
  )
  useViewportMeasure(measure)
  return active
}

/** Smooth-scrolls to a section and keeps the hash in the address bar. */
export const useJump = () => {
  const reduced = useReducedMotion()
  return (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.querySelector(`#${id}`)
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    })
    window.history.replaceState(window.history.state, '', `#${id}`)
  }
}

/* ---------- Desktop rail ---------- */

const Rail = styled.nav`
  position: sticky;
  top: calc(var(--app-bar-height) + 32px);
  display: flex;
  flex-direction: column;
  gap: 14px;
`

const Track = styled.ol`
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 1px;
    background: var(--glass-border);
  }
`

const Fill = styled.span`
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  background: color-mix(in srgb, var(--color-primary) 45%, transparent);
  transform-origin: top;
  transition: transform ${SPRING};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Marker = styled.span`
  position: absolute;
  top: 0;
  left: -1px;
  width: 3px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  box-shadow:
    0 0 10px var(--color-primary),
    0 0 22px color-mix(in srgb, var(--color-primary) 50%, transparent);
  transition:
    transform ${SPRING},
    height ${SPRING};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Entry = styled.a<{ $active?: boolean }>`
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  padding: 7px 0 7px 18px;
  color: ${({ $active }) =>
    $active ? 'var(--color-text)' : 'var(--color-muted)'};
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  text-decoration: none;
  transition:
    color var(--motion),
    transform var(--motion);

  span:first-child {
    color: ${({ $active }) =>
      $active ? 'var(--color-primary)' : 'var(--color-faint)'};
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    transition: color var(--motion);
  }

  &:hover {
    color: var(--color-text);
    transform: translateX(2px);
  }
`

/* ---------- Phone strip ---------- */

const Strip = styled.nav`
  position: sticky;
  top: var(--app-bar-height);
  z-index: 40;
  margin: 28px calc(var(--horizontal-padding) * -1) 0;
  padding: 8px var(--horizontal-padding);
  border-bottom: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--color-bg) 78%, transparent);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
`

const Pills = styled.ol`
  position: relative;
  isolation: isolate;
  display: flex;
  gap: 2px;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  list-style: none;
  scrollbar-width: none;
  scroll-padding: 0 24px;

  &::-webkit-scrollbar {
    display: none;
  }
`

const Pill = styled.a<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  color: ${({ $active }) =>
    $active ? 'var(--color-text)' : 'var(--color-muted)'};
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  white-space: nowrap;
  text-decoration: none;
  transition: color var(--motion);

  span {
    color: ${({ $active }) =>
      $active ? 'var(--color-primary)' : 'var(--color-faint)'};
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
`

const PillMarker = styled.span`
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  height: 34px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, var(--color-primary) 30%, transparent);
  transition:
    transform ${SPRING},
    width ${SPRING};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

type Box = { offset: number; size: number }

/** Offset and size of the active entry inside its list, for the marker. */
const useActiveBox = (
  list: React.RefObject<HTMLOListElement>,
  active: string,
  axis: 'x' | 'y',
): Box | undefined => {
  const [box, setBox] = useState<Box>()
  useLayoutEffect(() => {
    const measure = () => {
      const node = list.current?.querySelector<HTMLAnchorElement>(
        `[data-section="${active}"]`,
      )
      if (!node) return
      setBox(
        axis === 'y'
          ? { offset: node.offsetTop, size: node.offsetHeight }
          : { offset: node.offsetLeft, size: node.offsetWidth },
      )
    }
    measure()
    // Web fonts can land after the first measure and shift the entries.
    let live = true
    document.fonts?.ready.then(() => live && measure())
    window.addEventListener('resize', measure)
    return () => {
      live = false
      window.removeEventListener('resize', measure)
    }
  }, [list, active, axis])
  return box
}

export const TableOfContents = ({
  sections,
  numberOf,
  variant,
}: {
  sections: GuideSectionLink[]
  numberOf: (id: string) => string
  /** A rail beside the text (desktop) or a strip above it (phones). */
  variant: 'rail' | 'strip'
}) => {
  const desktop = variant === 'rail'
  const ids = useMemo(() => sections.map((section) => section.id), [sections])
  const active = useActiveSection(ids, desktop ? 96 : 120)
  const jump = useJump()
  const listRef = useRef<HTMLOListElement>(null)
  const box = useActiveBox(listRef, active, desktop ? 'y' : 'x')
  const reduced = useReducedMotion()

  // Keep the active pill in view as the reader scrolls on a phone.
  useLayoutEffect(() => {
    if (desktop || !box || !listRef.current) return
    const strip = listRef.current
    const target = box.offset - (strip.clientWidth - box.size) / 2
    strip.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' })
  }, [desktop, box, reduced])

  if (desktop)
    return (
      <Rail aria-label="On this page">
        <Label $tone="faint">On this page</Label>
        <Track ref={listRef}>
          {box && (
            <>
              <Fill
                aria-hidden
                style={{ transform: `scaleY(${box.offset + box.size / 2})` }}
              />
              <Marker
                aria-hidden
                style={{
                  transform: `translateY(${box.offset + 6}px)`,
                  height: box.size - 12,
                }}
              />
            </>
          )}
          {sections.map((section) => (
            <li key={section.id}>
              <Entry
                href={`#${section.id}`}
                data-section={section.id}
                $active={section.id === active}
                aria-current={section.id === active ? 'location' : undefined}
                onClick={(event) => jump(event, section.id)}
              >
                <span aria-hidden>{numberOf(section.id)}</span>
                <span>{section.label}</span>
              </Entry>
            </li>
          ))}
        </Track>
      </Rail>
    )

  return (
    <Strip aria-label="On this page">
      <Pills ref={listRef}>
        {box && (
          <PillMarker
            aria-hidden
            style={{
              transform: `translateX(${box.offset}px)`,
              width: box.size,
            }}
          />
        )}
        {sections.map((section) => (
          <li key={section.id}>
            <Pill
              href={`#${section.id}`}
              data-section={section.id}
              $active={section.id === active}
              aria-current={section.id === active ? 'location' : undefined}
              onClick={(event) => jump(event, section.id)}
            >
              <span aria-hidden>{numberOf(section.id)}</span>
              {section.label}
            </Pill>
          </li>
        ))}
      </Pills>
    </Strip>
  )
}

export default TableOfContents
