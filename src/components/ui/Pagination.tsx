import React, {
  useState,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import styled, { css } from 'styled-components'
import { KitIcon } from './kit-icons'
import {
  figureData,
  joinClassNames,
  kitTransition,
  litThumb,
  motionOk,
  recessTrack,
  slidingThumbMotion,
} from './kit-styles'

/*
 * Pagination, round 2 ("Lit edge", DESIGN.md): the page numbers sit in a
 * recessed track and the current page on the raised, lit glass thumb that
 * SegmentedControl uses, sliding from page to page with the same stretchy
 * spring; previous and next are round quiet buttons either side. The pager
 * always stays on one line: under 480px it keeps only the first, current
 * and last pages, with an ellipsis wherever pages are skipped.
 *
 * Skipping pages is what makes the track alone a trap: with 237 pages the
 * only reachable ones are the first, the last and the current page's
 * neighbours, so page 137 is 136 taps away. Wherever the track skips, a
 * "Go to page" field takes a number and jumps there. It writes once, on
 * Enter, Go or blur, never on a keystroke: every caller carries the page in
 * the URL, and two of them push a history entry and refetch for each write.
 */
const COMPACT_QUERY = '(max-width: 479px)'

const Wrapper = styled.nav`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  user-select: none;
`

const Pager = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
`

/* The recessed track; the thumb is positioned against it. */
const PageTrack = styled.div`
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  min-width: 0;
  padding: 3px;
  border-radius: var(--radius-pill);
  ${recessTrack}
`

/* The lit thumb under the current page; it slides when the page changes. */
const Thumb = styled.span`
  position: absolute;
  top: 3px;
  bottom: 3px;
  z-index: -1;
  border-radius: var(--radius-pill);
  pointer-events: none;
  ${litThumb}
  ${slidingThumbMotion}
`

const pageButtonBase = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-muted);
  ${figureData}
  font-size: var(--fs-small);
  cursor: pointer;
  transition: ${kitTransition(
    'background',
    'color',
    'border-color',
    'transform',
  )};

  ${motionOk(css`
    &:active:not(:disabled) {
      transform: scale(0.95);
    }
  `)}

  &:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
`

/* Previous and next: round, quiet, the track's height. */
const NavButton = styled.button`
  ${pageButtonBase}
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-color: var(--glass-border);

  &:hover:not(:disabled) {
    color: var(--color-text);
    border-color: var(--color-border-strong);
    background: var(--color-raised);
  }
`

/* A page in the track. Its label brightens on hover; the thumb marks the current one. */
const PageButton = styled.button`
  ${pageButtonBase}
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  border: 0;

  &:hover:not(:disabled) {
    color: var(--color-text);
  }

  /* The track has no clip, but its pills sit 2px apart: the ring stays inside. */
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  &.active {
    color: var(--color-text);
  }

  /* Before the thumb is measured (or if a custom item hides it), the
     current page draws its own. */
  [data-sliding='false'] > &.active {
    ${litThumb}
  }
`

const Ellipsis = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 32px;
  color: var(--color-faint);
  ${figureData}
`

/*
 * The jump: a page pill you type in, in the track and next to the ellipsis
 * that stands for the pages it reaches, so the control that gets to page 137
 * is the same size and in the same place as the ones that get to 136 and 138.
 * The same pill as a page: 32px tall, fully round, at least 32px wide and
 * exactly as wide as the last page's chip, because a hidden copy of that
 * number with a page's padding sizes the slot the field fills (237 makes
 * both 44px), so typing never moves the track. Its surface fill and inner
 * hairline are what say it takes a number. The field carries no type
 * attribute: the global input[type="text"] rule (theme) would force the
 * field radius on it.
 * It writes once — on Enter, or on leaving it — never per keystroke, because
 * every caller puts the page in the URL and two of them push a history entry
 * and refetch for each write.
 */
const JumpSlot = styled.span`
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  ${figureData}
  font-size: var(--fs-small);

  > span {
    visibility: hidden;
  }
`

const JumpField = styled.input`
  ${pageButtonBase}
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--color-surface);
  /* The field's hairline, inside the pill: a chip you type in, not a page. */
  box-shadow: inset 0 0 0 1px var(--color-border);
  color: var(--color-text);
  text-align: center;

  &::placeholder {
    color: var(--color-faint);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
`
/*
 * First, last, the current page and `siblings` pages either side of it,
 * with an ellipsis wherever pages are skipped.
 */
/** True while the track has to skip pages, which is when a jump earns its place. */
const isWindowed = (total: number, siblings: number): boolean =>
  total > 5 + 2 * siblings

const getPageNumbers = (
  current: number,
  total: number,
  siblings = 1,
): (number | string)[] => {
  if (!isWindowed(total, siblings))
    return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | string)[] = []
  pages.push(1)

  if (current - siblings > 2) pages.push('left-ellipsis')

  const start = Math.max(2, current - siblings)
  const end = Math.min(total - 1, current + siblings)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current + siblings < total - 1) pages.push('right-ellipsis')

  if (total > 1) pages.push(total)

  return pages
}

/* True while the viewport is phone-narrow; follows resizes. */
const useCompact = (): boolean => {
  const [compact, setCompact] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia(COMPACT_QUERY).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(COMPACT_QUERY)
    const onChange = () => setCompact(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return compact
}

interface PaginationProps {
  total?: number
  current?: number
  pageSize?: number
  onChange?: (page: number, pageSize: number) => void
  itemRender?: (
    page: number,
    type: string,
    originalElement: React.ReactNode,
  ) => React.ReactNode
  style?: React.CSSProperties
  className?: string
  defaultCurrent?: number
}

const Pagination: React.FC<PaginationProps> = ({
  total = 0,
  current: controlledCurrent,
  pageSize: controlledPageSize,
  onChange,
  itemRender,
  style,
  className,
  defaultCurrent = 1,
}) => {
  const [internalCurrent, setInternalCurrent] = useState(defaultCurrent)
  const [internalPageSize] = useState(controlledPageSize || 10)

  const isControlled = controlledCurrent !== undefined
  const current = isControlled ? controlledCurrent : internalCurrent
  const pageSize =
    controlledPageSize === undefined ? internalPageSize : controlledPageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const goTo = useCallback(
    (page: number) => {
      const p = Math.max(1, Math.min(page, totalPages))
      if (!isControlled) setInternalCurrent(p)
      if (onChange) onChange(p, pageSize)
    },
    [totalPages, isControlled, onChange, pageSize],
  )

  const renderItem = useCallback(
    (page: number, type: string, originalElement: React.ReactNode) => {
      if (itemRender) return itemRender(page, type, originalElement)
      return originalElement
    },
    [itemRender],
  )

  const compact = useCompact()
  const siblings = compact ? 0 : 1
  const pages = useMemo(
    () => getPageNumbers(current, totalPages, siblings),
    [current, totalPages, siblings],
  )

  /*
   * The jump's draft, which is not the page: it is committed once, by Enter,
   * by Go or by leaving the field, and cleared afterwards so the placeholder
   * goes back to showing where the reader actually is. goTo clamps, so 0 and
   * 9999 land on the first and last page rather than being refused.
   */
  const jumpId = useId()
  /*
   * The field sits by the last ellipsis, between the skipped pages and the
   * last one. A window near the end has only a left ellipsis, so it goes
   * there instead; with no ellipsis at all every page is on screen and there
   * is nothing to jump to.
   */
  const lastGap = [...pages].reverse().find((page) => typeof page === 'string')
  const [draft, setDraft] = useState('')
  const commitJump = useCallback(() => {
    const page = Number.parseInt(draft, 10)
    setDraft('')
    if (!Number.isNaN(page) && page !== current) goTo(page)
  }, [draft, current, goTo])

  // Place the thumb under the current page. It slides only when the page
  // changes; a resize, late fonts or a switch between the full and compact
  // ranges re-place it in the same frame.
  const trackRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{
    left: number
    right: number
    dir?: 'left' | 'right'
    instant: boolean
  }>()
  const measureThumb = useCallback((instant: boolean) => {
    const track = trackRef.current
    const node = track?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!track || !node || node.offsetParent !== track) {
      setThumb(undefined)
      return
    }
    const left = node.offsetLeft
    const right = track.clientWidth - left - node.offsetWidth
    setThumb((previous) => {
      if (previous && previous.left === left && previous.right === right)
        return previous
      const dir =
        previous && left !== previous.left
          ? left > previous.left
            ? 'right'
            : 'left'
          : previous?.dir
      return { left, right, dir, instant: instant || !previous }
    })
  }, [])
  const placedPage = useRef(current)
  useLayoutEffect(() => {
    const moved = placedPage.current !== current
    placedPage.current = current
    measureThumb(!moved)
  }, [current, totalPages, compact, measureThumb])
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => measureThumb(true))
    observer.observe(track)
    return () => observer.disconnect()
  }, [measureThumb])

  return (
    <Wrapper
      style={style}
      className={joinClassNames('ui-pagination', className)}
      aria-label="Pagination"
    >
      <Pager className="ui-pagination-pager">
        <NavButton
          type="button"
          className="ui-pagination-prev"
          disabled={current <= 1}
          onClick={() => goTo(current - 1)}
          aria-label="Previous page"
        >
          {renderItem(
            current - 1,
            'prev',
            <KitIcon name="chevron-left" size={14} />,
          )}
        </NavButton>

        <PageTrack
          ref={trackRef}
          className="ui-pagination-track"
          data-sliding={thumb ? 'true' : 'false'}
        >
          {thumb && (
            <Thumb
              aria-hidden
              data-dir={thumb.dir}
              data-instant={thumb.instant ? '' : undefined}
              style={{ left: thumb.left, right: thumb.right }}
            />
          )}
          {pages.map((page, idx) => {
            if (typeof page === 'string')
              return (
                <React.Fragment key={page + idx}>
                  <Ellipsis className="ui-pagination-ellipsis" aria-hidden>
                    …
                  </Ellipsis>
                  {page === lastGap && (
                    <JumpSlot>
                      <span aria-hidden>{totalPages}</span>
                      <JumpField
                        id={jumpId}
                        inputMode="numeric"
                        enterKeyHint="go"
                        autoComplete="off"
                        value={draft}
                        placeholder="#"
                        title={`Go to page, 1 to ${totalPages}`}
                        aria-label={`Go to page, 1 to ${totalPages}`}
                        onChange={(e) =>
                          setDraft(
                            e.target.value
                              .replace(/\D+/g, '')
                              .slice(0, String(totalPages).length),
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitJump()
                          } else if (e.key === 'Escape') setDraft('')
                        }}
                        // Leaving a typed number behind still takes the reader
                        // there; focus stays on the field, which the list scroll
                        // moves out of view but does not steal.
                        onBlur={() => draft && commitJump()}
                      />
                    </JumpSlot>
                  )}
                </React.Fragment>
              )

            return (
              <React.Fragment key={page}>
                {renderItem(
                  page,
                  'page',
                  <PageButton
                    type="button"
                    className={joinClassNames(
                      'ui-pagination-item',
                      page === current && 'active',
                    )}
                    aria-current={page === current ? 'page' : undefined}
                    aria-label={`Page ${page}`}
                    onClick={() => goTo(page)}
                  >
                    {page}
                  </PageButton>,
                )}
              </React.Fragment>
            )
          })}
        </PageTrack>

        <NavButton
          type="button"
          className="ui-pagination-next"
          disabled={current >= totalPages}
          onClick={() => goTo(current + 1)}
          aria-label="Next page"
        >
          {renderItem(
            current + 1,
            'next',
            <KitIcon name="chevron-right" size={14} />,
          )}
        </NavButton>
      </Pager>
    </Wrapper>
  )
}

export default Pagination
