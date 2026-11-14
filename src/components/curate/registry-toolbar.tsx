import React, { useId, useLayoutEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { LAYOUT_OPTIONS, type ListLayout } from 'hooks/use-stored-layout'
import Switch from 'components/ui/Switch'
import {
  SearchField,
  SegmentedControl,
  StatusDot,
  ToggleGroup,
  type StatusTone,
} from './primitives'
import { CurateIcon } from './icons'

/*
 * Registry toolbar: search (with the shown/total count at its end), the
 * sensitive-content switch (the app's lit Switch), sort and layout as
 * sliding segmented controls, and the status filters under them as one
 * ToggleGroup (multi-select; each pressed status sits on its own lit thumb,
 * led by its status dot). Where the track is wider than the column it
 * scrolls sideways under a fade.
 */

const integer = new Intl.NumberFormat('en-US')

const Bar = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 360px) minmax(0, 1fr) auto auto auto;
  grid-template-areas:
    'search . nsfw sort layout'
    'chips chips chips chips chips';
  align-items: center;
  gap: 12px 10px;
  margin: 20px 0 16px;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas:
      'search search search'
      'nsfw sort layout'
      'chips chips chips';
  }

  /* Phones: the search keeps the full width, sort and layout share a line
     (the layout switch keeps its icons only; names stay readable to
     assistive tech), and the switch follows the filters it belongs with. */
  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'search search'
      'sort layout'
      'chips chips'
      'nsfw nsfw';
    gap: 10px 8px;

    [aria-label='Layout'] button {
      gap: 0;
      padding: 0 11px;
      font-size: 0;
    }
  }
`

const Search = styled(SearchField)`
  grid-area: search;
  min-width: 0;
  height: 40px;
`

const Count = styled.span`
  flex: 0 0 auto;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const RailScroller = styled.div`
  grid-area: chips;
  min-width: 0;
  /* Room above and below so the thumbs' glow is not clipped. */
  margin: -6px 0;
  padding: 6px 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  /* The track keeps its natural width; this box scrolls it instead. */
  > [role='group'] {
    max-width: none;
    overflow: visible;
  }

  /* Only when the track is wider than the column (measured): one
     swipeable line, the far edge faded so it reads as more. */
  &[data-overflow] {
    mask-image: linear-gradient(
      90deg,
      var(--color-text) calc(100% - 40px),
      transparent
    );
    -webkit-mask-image: linear-gradient(
      90deg,
      var(--color-text) calc(100% - 40px),
      transparent
    );

    > [role='group'] {
      margin-right: 40px;
    }
  }
`

/** Whether the status track is wider than its column (it then scrolls under a fade). */
const useOverflow = () => {
  const box = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useLayoutEffect(() => {
    const node = box.current
    const track = node?.firstElementChild as HTMLElement | null
    if (!node || !track) return undefined
    const measure = () => setOverflow(track.offsetWidth > node.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    observer.observe(track)
    return () => observer.disconnect()
  }, [])
  return [box, overflow] as const
}

/* The sensitive-content switch: the app's lit Switch, named by its label. */
const SwitchField = styled.label`
  grid-area: nsfw;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 32px;
  padding: 0 4px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: color var(--motion);

  &:hover {
    color: var(--color-text);
  }

  @media (max-width: 520px) {
    margin-top: -2px;
  }
`

const Slot = styled.div<{ $area: 'sort' | 'layout' }>`
  grid-area: ${({ $area }) => $area};
  justify-self: end;
  min-width: 0;

  @media (max-width: 520px) {
    justify-self: ${({ $area }) => ($area === 'sort' ? 'start' : 'end')};
  }
`

/* A status dot inside a toggle, with room for its halo. */
const ChipDot = styled(StatusDot)`
  margin: 0 2px 0 1px;
`

export interface FilterChip {
  key: string
  label: string
  tone?: StatusTone
  checked: boolean
}

export const RegistryToolbar = ({
  search,
  onSearch,
  placeholder,
  chips,
  onChipChange,
  sort,
  onSortChange,
  layout,
  onLayoutChange,
  nsfwFilter,
  onNsfwChange,
  shown,
  total,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder: string
  chips: FilterChip[]
  onChipChange: (key: string, checked: boolean) => void
  sort: 'newest' | 'oldest'
  onSortChange: (sort: 'newest' | 'oldest') => void
  layout: ListLayout
  onLayoutChange: (layout: ListLayout) => void
  nsfwFilter: boolean
  onNsfwChange: (checked: boolean) => void
  shown: number
  total: number
}) => {
  const nsfwLabelId = useId()
  const [rail, railOverflows] = useOverflow()
  return (
    <Bar role="region" aria-label="Filters">
      <Search>
        <CurateIcon name="search" size={16} />
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearch(event.currentTarget.value)}
        />
        <Count aria-live="polite" title="Shown of total">
          {integer.format(shown)} of {integer.format(total)}
        </Count>
      </Search>
      <SwitchField>
        <Switch
          size="small"
          checked={nsfwFilter}
          onChange={(checked) => onNsfwChange(checked)}
          aria-labelledby={nsfwLabelId}
        />
        <span id={nsfwLabelId}>Hide sensitive content</span>
      </SwitchField>
      <Slot $area="sort">
        <SegmentedControl<'newest' | 'oldest'>
          ariaLabel="Sort"
          value={sort}
          onChange={onSortChange}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
          ]}
        />
      </Slot>
      <Slot $area="layout">
        <SegmentedControl
          ariaLabel="Layout"
          value={layout}
          onChange={onLayoutChange}
          options={LAYOUT_OPTIONS}
        />
      </Slot>
      <RailScroller ref={rail} data-overflow={railOverflows ? '' : undefined}>
        <ToggleGroup<string>
          ariaLabel="Status filters"
          value={chips.filter((chip) => chip.checked).map((chip) => chip.key)}
          onChange={(pressed) => {
            // One press flips one status: find it and report just that one.
            const flipped = chips.find(
              (chip) => pressed.includes(chip.key) !== chip.checked,
            )
            if (flipped) onChipChange(flipped.key, !flipped.checked)
          }}
          options={chips.map((chip) => ({
            value: chip.key,
            label: chip.label,
            icon: chip.tone ? (
              <ChipDot $tone={chip.tone} aria-hidden />
            ) : undefined,
          }))}
        />
      </RailScroller>
    </Bar>
  )
}

export default RegistryToolbar
