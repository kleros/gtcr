import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { formatAbsolute } from 'utils/time'
import { formatSince } from 'utils/format-since'
import { CurateIcon } from './icons'
import { CuratorAddress } from './chrome-address'
import { Label, VisuallyHidden, truncateMiddle } from './primitives'

/*
 * The entry page's facts strip, under the entry's name and status: when the
 * request was made, who made it and who challenged it, and the entry's own
 * ID. One component for the Standard and the Stake page, so the two strips
 * can no longer drift apart (the audit found copy controls on one and not
 * the other).
 *
 * Round 5 of the design review moved the item ID here, next to "By", from
 * the far end of the full-details heading, where it sat under the clock and
 * read as the clock's. With a challenger the strip reads date, By,
 * Challenged by, Item ID, so the two parties stay side by side and the ID
 * closes the row.
 *
 * While a case is live the strip also names the bounty: what the dispute is
 * over. Nothing else on the page says it while jurors decide (the action
 * card that leads with it out of court is not drawn then).
 */

const Strip = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 16px 40px;
  margin: 0;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);

  > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  dd {
    display: flex;
    align-items: center;
    min-width: 0;
    min-height: 24px;
    margin: 0;
    color: var(--color-text);
    font-size: 18px;
    line-height: 22px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  /* Two even columns on a phone, so a long value wraps inside its own cell
     instead of pushing the next fact onto a ragged line. */
  @media (max-width: 560px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 24px;
  }
`

/* A coin amount: the figure at the strip's size, its symbol a step down,
   as the action card sets it. */
const Coin = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  font-family: var(--font-figure);

  small {
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
  }
`

/*
 * The item ID, as one control: a click anywhere on it copies the full ID.
 * There is no page an ID could open (the entry page is its permalink), so
 * copying is what it is for. It takes the address controls' type (Geist
 * Mono at the data size) and their hover, and its icon reports the copy in
 * place, so nothing in the row moves.
 *
 * Its name starts with its own visible text, the shortened ID, and then
 * says what it does ("0x0100cc…2b6263, copy item ID"): a name of "Copy item
 * ID" alone hid the ID from a screen reader and gave a voice user no name
 * matching what they see (WCAG 2.5.3). The title, the full ID and the hint,
 * is its description, so the whole ID can be heard too. The copy report is
 * a live region beside the button, not inside it, so it is never read as
 * part of the name.
 */
const IdButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--fs-data);
  line-height: var(--lh-data);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: copy;
  transition: color var(--motion);

  svg {
    flex: 0 0 auto;
    color: var(--color-faint);
    transition: color var(--motion);
  }

  &:hover {
    color: var(--color-primary);
  }

  &:hover svg {
    color: var(--color-text);
  }

  &[data-state='copied'] svg {
    color: var(--status-registered);
  }

  &[data-state='failed'] svg {
    color: var(--status-off);
  }
`

type CopyState = 'idle' | 'copied' | 'failed'

const CopyId = ({ id }: { id: string }) => {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const settle = (next: CopyState) => {
    setState(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1500)
  }

  const shown = truncateMiddle(id, 8, 6)
  return (
    <>
      <IdButton
        type="button"
        data-state={state}
        title={`${id} · click to copy`}
        aria-label={`${shown}, copy item ID`}
        onClick={() => {
          if (!navigator.clipboard) {
            settle('failed')
            return
          }
          navigator.clipboard
            .writeText(id)
            .then(() => settle('copied'))
            .catch(() => settle('failed'))
        }}
      >
        {shown}
        <CurateIcon name={state === 'copied' ? 'check' : 'copy'} size={13} />
      </IdButton>
      <VisuallyHidden role="status">
        {state === 'copied'
          ? 'Item ID copied'
          : state === 'failed'
            ? 'Item ID could not be copied'
            : ''}
      </VisuallyHidden>
    </>
  )
}

export interface HeroFactsProps {
  /** The request's date: "Submitted", "Removal requested", "Reincluded". */
  when?: { label: string; at: number }
  /** What a live case is over, per coin. Only while one is live. */
  bounty?: { figure: string; symbol: string; title?: string }
  /** The requester or submitter: a person, so their Curate profile. */
  by?: string
  /** The challenger, while their challenge is part of this request. */
  challengedBy?: string
  itemID?: string
  now: number
}

export const HeroFacts = ({
  when,
  bounty,
  by,
  challengedBy,
  itemID,
  now,
}: HeroFactsProps) => (
  <Strip>
    {when && (
      <div>
        <Label as="dt" $tone="faint">
          {when.label}
        </Label>
        <dd title={when.at ? formatAbsolute(when.at) : undefined}>
          {when.at ? formatSince(when.at, now) : '—'}
        </dd>
      </div>
    )}
    {bounty && (
      <div>
        <Label as="dt" $tone="faint">
          Bounty
        </Label>
        <dd title={bounty.title}>
          <Coin>
            {bounty.figure}
            <small>{bounty.symbol}</small>
          </Coin>
        </dd>
      </div>
    )}
    {by && (
      <div>
        <Label as="dt" $tone="faint">
          By
        </Label>
        <dd>
          <CuratorAddress address={by} />
        </dd>
      </div>
    )}
    {challengedBy && (
      <div>
        <Label as="dt" $tone="faint">
          Challenged by
        </Label>
        <dd>
          <CuratorAddress address={challengedBy} />
        </dd>
      </div>
    )}
    {itemID && (
      <div>
        <Label as="dt" $tone="faint">
          Item ID
        </Label>
        <dd>
          <CopyId id={itemID} />
        </dd>
      </div>
    )}
  </Strip>
)

export default HeroFacts
