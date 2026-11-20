import React from 'react'
import styled from 'styled-components'
import { slidingThumbMotion } from 'components/ui/kit-styles'

/*
 * Section tabs: the switch between a page's top-level sections (the
 * profile's Activity and Governed lists), set as the section titles they
 * replace, so they outrank any SegmentedControl filter inside a section.
 * Urbanist at the section-title size (30px, 26px on phones, 22px below
 * 360px where two tabs would not fit), a small faint count beside each
 * label, the open tab in `text` and the others `muted`, no track: a
 * hairline under the row and a 2px `primary` underline under the open tab,
 * which slides between tabs on the SegmentedControl thumb's spring (leading
 * edge first) and jumps under reduced motion.
 *
 * The row is 38px tall, the height a section head reserves, so a page that
 * swaps a title for these tabs once a later read settles does not move.
 *
 * ARIA tabs with automatic activation: one tab stop (the open tab), Left
 * and Right move the choice and the focus (wrapping), Home and End go to
 * the ends. The panels are the page's own: it gives each the id from
 * `sectionPanelId` and labels it with `sectionTabId`.
 */

export type SectionTab<T extends string> = {
  value: T
  label: string
  /** A count beside the label; none while it is unknown or not a total. */
  count?: number
}

export const sectionTabId = (base: string, value: string) =>
  `${base}-tab-${value}`

export const sectionPanelId = (base: string, value: string) =>
  `${base}-panel-${value}`

const TabRow = styled.div`
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: flex-end;
  gap: 32px;
  flex: 1 1 100%;
  min-width: 0;
  height: 38px;
  box-shadow: inset 0 -1px 0 var(--glass-border);

  @media (max-width: 359px) {
    gap: 20px;
  }
`

const Tab = styled.button`
  position: relative;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  flex: 0 0 auto;
  height: 38px;
  margin: 0;
  padding: 0 0 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-muted);
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 30px;
  font-weight: 500;
  letter-spacing: -0.03em;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--motion);

  &:hover,
  &[aria-selected='true'] {
    color: var(--color-text);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
    border-radius: 6px;
  }

  /* Until the indicator is measured, the open tab draws its own line. */
  [data-measured='false'] > &[aria-selected='true']::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 2px;
    border-radius: 2px;
    background: var(--color-primary);
  }

  small {
    color: var(--color-faint);
    font-family: var(--font-figure);
    font-size: 16px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 720px) {
    font-size: 26px;
  }

  @media (max-width: 359px) {
    gap: 8px;
    font-size: 22px;

    small {
      font-size: 14px;
    }
  }
`

const Indicator = styled.span`
  position: absolute;
  bottom: 0;
  z-index: 1;
  height: 2px;
  border-radius: 2px;
  background: var(--color-primary);
  pointer-events: none;
  ${slidingThumbMotion}
`

const countFormat = new Intl.NumberFormat('en-US')

export function SectionTabs<T extends string>({
  value,
  tabs,
  onChange,
  ariaLabel,
  idBase,
  className,
}: {
  value: T
  tabs: SectionTab<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  /** Prefix of the tab and panel ids (sectionTabId, sectionPanelId). */
  idBase: string
  className?: string
}) {
  const row = React.useRef<HTMLDivElement>(null)
  const [line, setLine] = React.useState<{
    left: number
    right: number
    dir?: 'left' | 'right'
    instant?: boolean
  }>()
  // Under the open tab's whole label and count. Only a change of tab
  // slides; counts arriving, fonts loading or a resize re-place it in the
  // same frame.
  const measure = React.useCallback((instant: boolean) => {
    const node = row.current
    const open = node?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!node || !open) {
      setLine(undefined)
      return
    }
    const left = open.offsetLeft
    const right = node.clientWidth - left - open.offsetWidth
    setLine((previous) => {
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
  const layoutKey = tabs
    .map((tab) => `${tab.value}:${tab.label}:${tab.count ?? ''}`)
    .join('|')
  const placed = React.useRef(value)
  React.useLayoutEffect(() => {
    const moved = placed.current !== value
    placed.current = value
    measure(!moved)
  }, [measure, value, layoutKey])
  React.useEffect(() => {
    const node = row.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure(true))
    observer.observe(node)
    node
      .querySelectorAll<HTMLElement>('[role="tab"]')
      .forEach((tab) => observer.observe(tab))
    return () => observer.disconnect()
  }, [measure, layoutKey])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.value === value)
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight'
        ? index >= last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index <= 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1
    if (next < 0 || !tabs[next]) return
    event.preventDefault()
    onChange(tabs[next].value)
    row.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <TabRow
      ref={row}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      data-measured={line ? 'true' : 'false'}
      className={className}
    >
      {tabs.map((tab) => {
        const open = tab.value === value
        return (
          <Tab
            key={tab.value}
            type="button"
            role="tab"
            id={sectionTabId(idBase, tab.value)}
            aria-selected={open}
            aria-controls={sectionPanelId(idBase, tab.value)}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              if (!open) onChange(tab.value)
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <small>{countFormat.format(tab.count)}</small>
            )}
          </Tab>
        )
      })}
      {line && (
        <Indicator
          aria-hidden
          data-dir={line.dir}
          data-instant={line.instant ? '' : undefined}
          style={{ left: line.left, right: line.right }}
        />
      )}
    </TabRow>
  )
}

export default SectionTabs
