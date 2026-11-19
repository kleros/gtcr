import React, { useId } from 'react'
import styled from 'styled-components'
import type { ListLayout } from 'hooks/use-stored-layout'
import Switch from 'components/ui/Switch'
import {
  SearchField,
  SegmentedControl,
  SelectMenu,
  StatusDot,
  type SegmentOption,
  type SelectMenuOption,
  type StatusTone,
} from './primitives'
import { CurateIcon } from './icons'

/*
 * Registry toolbar, on one line on desktop: search (with the shown/total
 * count at its end), the status menu, the sensitive-content switch (the
 * app's lit Switch), and sort and layout as sliding segmented controls.
 * Which layouts the track offers is the page's to say (`layoutOptions`): the
 * registry pages dropped Rows.
 *
 * Round 6 ("display it more elegantly in a dropdown menu, starting from
 * 'All'"): the status filters were a row of multi-select chips on a line of
 * their own. They are one SelectMenu, "Status · All", one choice at a time,
 * each status led by its dot and followed by its count; under a hairline,
 * "Previously disputed", every entry that has been to court whatever its
 * status now, a way into the list's history rather than a status of its
 * own, led by a multicolour LED and carrying no count (round 7). Seven choices with their counts read better in a menu than in a rail
 * that scrolled on phones, and combining statuses was rarely what anyone
 * wanted.
 */

const integer = new Intl.NumberFormat('en-US')

const Bar = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 360px) auto minmax(0, 1fr) auto auto auto;
  grid-template-areas: 'search status . nsfw sort layout';
  align-items: center;
  gap: 12px 10px;
  margin: 20px 0 16px;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas:
      'search status status'
      'nsfw sort layout';
  }

  /* Phones and narrow tablets: the search keeps the full width, the status
     menu and sort share a line, then the switch and the layout. */
  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'search search'
      'status sort'
      'nsfw layout';
    gap: 10px 8px;
  }

  /* Phones: the layout switch keeps its icons only (names stay readable to
     assistive tech). */
  @media (max-width: 520px) {
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

const StatusSlot = styled.div`
  grid-area: status;
  justify-self: start;
  min-width: 0;
`

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

  @media (max-width: 720px) {
    margin-top: -2px;
  }
`

const Slot = styled.div<{ $area: 'sort' | 'layout' }>`
  grid-area: ${({ $area }) => $area};
  justify-self: end;
  min-width: 0;

  @media (max-width: 720px) {
    justify-self: ${({ $area }) => ($area === 'sort' ? 'start' : 'end')};
  }
`

/* A status dot in the menu, with room for its halo. */
const ChipDot = styled(StatusDot)`
  margin: 0 2px 0 1px;
`

/*
 * "Previously disputed" has no single status, so its dot is every status
 * at once (round 7: "a multicolor led"): a conic of the four status hues
 * with a white core, haloed like a status dot. It carries no count.
 */
const MultiLed = styled.span`
  display: inline-block;
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin: 0 2px 0 1px;
  border-radius: var(--radius-pill);
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.85) 0 18%, transparent 46%),
    conic-gradient(
      var(--status-registered),
      var(--status-window),
      var(--status-contested),
      var(--status-off),
      var(--status-registered)
    );
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-text) 14%, transparent);
`

/** One choice in the status menu. */
export interface FilterChip {
  key: string
  label: string
  tone?: StatusTone
  checked: boolean
  /** Its count, shown at the option's right end once known. */
  count?: number
  /** "1,000+" style: the count is a lower bound. */
  countCapped?: boolean
  /** A muted line under the label. */
  hint?: string
  /** Starts a new group under a hairline. */
  divider?: boolean
  /** Led by the multicolour LED (a choice across every status). */
  led?: boolean
}

/**
 * After a page change, the list's top (its toolbar) back in view: the pager
 * at the foot of a long list would otherwise leave the reader at the bottom
 * of the new rows. Only when the toolbar is out of view under the app bar
 * (html's scroll-padding-top, which scrollIntoView keeps clear too); instant
 * under reduced motion.
 */
export const scrollToToolbar = (toolbar: HTMLElement | null) => {
  if (!toolbar) return
  const clearance =
    Number.parseFloat(
      getComputedStyle(document.documentElement).scrollPaddingTop,
    ) || 0
  if (toolbar.getBoundingClientRect().top >= clearance) return
  const reduced = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches
  toolbar.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'start',
  })
}

export function RegistryToolbar<L extends ListLayout>({
  search,
  onSearch,
  placeholder,
  chips,
  onStatusChange,
  sort,
  onSortChange,
  layout,
  onLayoutChange,
  layoutOptions,
  nsfwFilter,
  onNsfwChange,
  shown,
  total,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder: string
  /** The status menu's choices after "All", in order. */
  chips: FilterChip[]
  /** A choice from the status menu: a chip's key, or "all". */
  onStatusChange: (key: string) => void
  sort: 'newest' | 'oldest'
  onSortChange: (sort: 'newest' | 'oldest') => void
  layout: L
  onLayoutChange: (layout: L) => void
  /** The layouts this page offers, in the order the track shows them. */
  layoutOptions: SegmentOption<L>[]
  nsfwFilter: boolean
  onNsfwChange: (checked: boolean) => void
  /** Entries shown; undefined while the list or its counts load. */
  shown?: number
  /** Entries the filters cover; undefined while unknown. */
  total?: number
}) {
  const nsfwLabelId = useId()
  // One choice at a time: the first checked key (an old link may carry
  // several), or All.
  const status = chips.find((chip) => chip.checked)?.key ?? 'all'
  const statusOptions: SelectMenuOption<string>[] = [
    { value: 'all', label: 'All' },
    ...chips.map((chip) => ({
      value: chip.key,
      label: chip.label,
      hint: chip.hint,
      divider: chip.divider,
      icon: chip.led ? (
        <MultiLed aria-hidden />
      ) : chip.tone ? (
        <ChipDot $tone={chip.tone} aria-hidden />
      ) : undefined,
      count:
        chip.count !== undefined && Number.isFinite(chip.count)
          ? `${integer.format(chip.count)}${chip.countCapped ? '+' : ''}`
          : undefined,
    })),
  ]
  // Nothing is counted until both figures are known: a loading list never
  // reads (or announces) "0 of 0".
  const counted = shown !== undefined && total !== undefined
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
        <Count
          aria-live="polite"
          title={counted ? 'Shown of total' : undefined}
        >
          {counted && `${integer.format(shown)} of ${integer.format(total)}`}
        </Count>
      </Search>
      <StatusSlot>
        <SelectMenu<string>
          label="Status"
          value={status}
          options={statusOptions}
          onChange={onStatusChange}
          menuWidth={300}
        />
      </StatusSlot>
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
        <SegmentedControl<L>
          ariaLabel="Layout"
          value={layout}
          onChange={onLayoutChange}
          options={layoutOptions}
        />
      </Slot>
    </Bar>
  )
}

export default RegistryToolbar
