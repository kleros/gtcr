import React, {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import styled, { css } from 'styled-components'
import { KitIcon } from './kit-icons'
import {
  fieldFocus,
  fieldSurface,
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
 * and last pages (with ellipses), and the size changer takes its own row.
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

const SizeRow = styled.div`
  display: flex;

  @media ${COMPACT_QUERY} {
    flex-basis: 100%;
  }
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

const SizeChanger = styled.select`
  ${fieldSurface}
  height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  cursor: pointer;

  &:hover {
    border-color: var(--color-border-strong);
  }

  &:focus-visible {
    ${fieldFocus}
  }
`

const SimplePagination = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-muted);
  ${figureData}
`

const SimpleInput = styled.input`
  ${fieldSurface}
  width: 52px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-pill);
  ${figureData}
  text-align: center;

  &:focus-visible {
    ${fieldFocus}
  }
`

/*
 * First, last, the current page and `siblings` pages either side of it,
 * with an ellipsis wherever pages are skipped.
 */
const getPageNumbers = (
  current: number,
  total: number,
  siblings = 1,
): (number | string)[] => {
  if (total <= 5 + 2 * siblings)
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
  showSizeChanger?: boolean
  pageSizeOptions?: string[]
  onShowSizeChange?: (current: number, size: number) => void
  itemRender?: (
    page: number,
    type: string,
    originalElement: React.ReactNode,
  ) => React.ReactNode
  style?: React.CSSProperties
  className?: string
  defaultCurrent?: number
  simple?: boolean
}

const Pagination: React.FC<PaginationProps> = ({
  total = 0,
  current: controlledCurrent,
  pageSize: controlledPageSize,
  onChange,
  showSizeChanger = false,
  pageSizeOptions = ['10', '20', '50', '100'],
  onShowSizeChange,
  itemRender,
  style,
  className,
  defaultCurrent = 1,
  simple = false,
}) => {
  const [internalCurrent, setInternalCurrent] = useState(defaultCurrent)
  const [internalPageSize, setInternalPageSize] = useState(
    controlledPageSize || 10,
  )

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

  const handleSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newSize = Number(e.target.value)
      setInternalPageSize(newSize)
      const newTotal = Math.max(1, Math.ceil(total / newSize))
      const newCurrent = Math.min(current, newTotal)
      if (!isControlled) setInternalCurrent(newCurrent)
      if (onShowSizeChange) onShowSizeChange(newCurrent, newSize)
      if (onChange) onChange(newCurrent, newSize)
    },
    [total, current, isControlled, onShowSizeChange, onChange],
  )

  const renderItem = useCallback(
    (page: number, type: string, originalElement: React.ReactNode) => {
      if (itemRender) return itemRender(page, type, originalElement)
      return originalElement
    },
    [itemRender],
  )

  const compact = useCompact()
  const pages = useMemo(
    () => getPageNumbers(current, totalPages, compact ? 0 : 1),
    [current, totalPages, compact],
  )

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
    if (simple) return
    const moved = placedPage.current !== current
    placedPage.current = current
    measureThumb(!moved)
  }, [current, totalPages, compact, simple, measureThumb])
  useEffect(() => {
    const track = trackRef.current
    if (simple || !track || typeof ResizeObserver === 'undefined')
      return undefined
    const observer = new ResizeObserver(() => measureThumb(true))
    observer.observe(track)
    return () => observer.disconnect()
  }, [simple, measureThumb])

  if (simple)
    return (
      <SimplePagination
        style={style}
        className={joinClassNames(
          'ui-pagination',
          'ui-pagination-simple',
          className,
        )}
      >
        <NavButton
          type="button"
          className="ui-pagination-prev"
          disabled={current <= 1}
          onClick={() => goTo(current - 1)}
          aria-label="Previous page"
        >
          <KitIcon name="chevron-left" size={14} />
        </NavButton>
        <SimpleInput
          value={current}
          aria-label="Page"
          onChange={(e) => {
            const val = Number.parseInt(e.target.value, 10)
            if (!Number.isNaN(val)) goTo(val)
          }}
        />
        <span>/</span>
        <span>{totalPages}</span>
        <NavButton
          type="button"
          className="ui-pagination-next"
          disabled={current >= totalPages}
          onClick={() => goTo(current + 1)}
          aria-label="Next page"
        >
          <KitIcon name="chevron-right" size={14} />
        </NavButton>
      </SimplePagination>
    )

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
                <Ellipsis
                  key={page + idx}
                  className="ui-pagination-ellipsis"
                  aria-hidden
                >
                  …
                </Ellipsis>
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

      {showSizeChanger && (
        <SizeRow>
          <SizeChanger
            className="ui-pagination-size"
            value={pageSize}
            onChange={handleSizeChange}
            aria-label="Items per page"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / page
              </option>
            ))}
          </SizeChanger>
        </SizeRow>
      )}
    </Wrapper>
  )
}

export default Pagination
