import React, { useEffect, useId, useRef } from 'react'
import styled from 'styled-components'
import {
  Button,
  Data,
  Row,
  Small,
  Stack,
  VisuallyHidden,
} from 'components/curate/primitives'
import type { ReviewValue } from './governance-params'

/*
 * The review a governance change shows before anything leaves the dialog
 * (#376: "a transaction preview is shown before submission"). It comes after
 * the simulation, so a change that would revert never reaches it, and it is
 * the only place the change is sent from: each value before and after, in
 * people's units and as stored, what the change does to what is already
 * under way, and the mode's own actions. The wallet shows only hex, and a
 * Safe's owners see the Builder's fields: this is where the governor reads
 * the change in words.
 */

/** One value the call sends, before and after. */
export interface ReviewRow {
  label: string
  /** What the list holds now; undefined when unknown. */
  before?: ReviewValue
  after: ReviewValue
  /** Sent back exactly as the list holds it. */
  same?: boolean
}

export interface ChangeReview {
  /** What changes, a short noun phrase: "Submission deposit". */
  title: string
  /** The function and the list, for the record. */
  call: string
  rows: ReviewRow[]
  /** What the change does to requests, entries and disputes under way. */
  effect: string
  /** A line to read before signing: a new governor's nature. */
  caution?: string
  /** Cannot be undone by this wallet: the confirm button is the danger one. */
  danger?: boolean
}

/** How the reviewed change leaves: signed, proposed, or exported. */
export type ReviewChoice = 'send' | 'download' | 'copy'

export type ReviewMode = 'send' | 'propose' | 'export'

const Box = styled.section<{ $danger?: boolean }>`
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid
    ${({ $danger }) =>
      $danger ? 'var(--color-danger)' : 'var(--glass-border)'};
  border-radius: 14px;
  background: var(--color-raised);

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`

const Rows = styled.dl`
  display: grid;
  gap: 10px;
  margin: 0;
`

const RowLabel = styled.dt`
  font-size: 13px;
  color: var(--color-muted);
`

const RowValue = styled.dd`
  display: grid;
  gap: 2px;
  margin: 0;
  /* Hashes and addresses wrap anywhere rather than widen the dialog. */
  overflow-wrap: anywhere;
`

const Arrow = styled.span`
  color: var(--color-faint);
  padding: 0 6px;
`

const Caution = styled(Small)<{ $danger?: boolean }>`
  display: block;
  color: ${({ $danger }) =>
    $danger ? 'var(--color-danger)' : 'var(--color-text)'};
`

/** One value: the shown form, then the stored one in mono, muted. */
const Value = ({ value }: { value?: ReviewValue }) =>
  value ? (
    <Data $weight={500}>{value.shown}</Data>
  ) : (
    <Small $faint>unknown</Small>
  )

const Stored = ({ before, after }: { before?: string; after?: string }) =>
  after ? (
    <Small $faint>
      <Data $mono>
        {before !== undefined && before !== after ? (
          <>
            {before}
            <Arrow aria-hidden>→</Arrow>
            <VisuallyHidden> to </VisuallyHidden>
          </>
        ) : null}
        {after}
      </Data>
    </Small>
  ) : null

const NEXT: Record<ReviewMode, string> = {
  send: 'Your wallet asks you to sign it next.',
  propose:
    'Your Safe gets a proposal: its owners confirm it there, and the list changes once it executes.',
  export:
    "The Safe's owners check and sign it in the Transaction Builder. The file carries today's values: execute it before any other change to this list.",
}

/** Clicks this soon after the review opens are the end of the one before. */
const SETTLE_MS = 400

export const ReviewPanel = ({
  review,
  mode,
  onChoose,
  onBack,
}: {
  review: ChangeReview
  mode: ReviewMode
  onChoose: (choice: ReviewChoice) => void
  onBack: () => void
}) => {
  const titleId = useId()
  const box = useRef<HTMLElement>(null)
  const opened = useRef(Date.now())
  // The review takes the focus, so a screen reader reads it and a key held
  // down on the button that opened it does not land on its actions.
  useEffect(() => {
    opened.current = Date.now()
    box.current?.focus()
  }, [review])
  // A double-click on the button that opened the review must not confirm
  // it: its second click, or one right after, is dropped. A keyboard press
  // (detail 0) always counts.
  const deliberate = (event: React.MouseEvent) =>
    event.detail <= 1 && Date.now() - opened.current >= SETTLE_MS
  const choose = (choice: ReviewChoice) => (event: React.MouseEvent) => {
    if (deliberate(event)) onChoose(choice)
  }

  return (
    <Box
      ref={box}
      tabIndex={-1}
      aria-labelledby={titleId}
      $danger={review.danger}
      data-review
    >
      <Stack $gap={2}>
        <Small id={titleId} as="h3" style={{ margin: 0 }}>
          <strong>
            Check before {mode === 'export' ? 'exporting' : 'signing'}:{' '}
          </strong>
          {review.title}
        </Small>
        <Small $faint>
          <Data $mono>{review.call}</Data>
        </Small>
      </Stack>
      <Rows>
        {review.rows.map((row) => (
          <React.Fragment key={row.label}>
            <RowLabel>{row.label}</RowLabel>
            <RowValue>
              {row.same ? (
                <span>
                  <Value value={row.after} />{' '}
                  <Small $faint>
                    unchanged, sent back as the list holds it
                  </Small>
                </span>
              ) : (
                <span>
                  <Value value={row.before} />
                  <Arrow aria-hidden>→</Arrow>
                  <VisuallyHidden> to </VisuallyHidden>
                  <Value value={row.after} />
                </span>
              )}
              <Stored
                before={row.same ? undefined : row.before?.stored}
                after={row.after.stored}
              />
            </RowValue>
          </React.Fragment>
        ))}
      </Rows>
      <Small $muted>{review.effect}</Small>
      {review.caution && (
        <Caution $danger={review.danger} role="note">
          {review.caution}
        </Caution>
      )}
      <Small $muted>{NEXT[mode]}</Small>
      <Row $gap={8} $wrap $justify="flex-end">
        <Button type="button" $variant="secondary" onClick={onBack}>
          Back
        </Button>
        {mode === 'export' && (
          <Button type="button" $variant="secondary" onClick={choose('copy')}>
            Copy calldata
          </Button>
        )}
        <Button
          type="button"
          $variant={review.danger ? 'danger' : 'primary'}
          onClick={choose(mode === 'export' ? 'download' : 'send')}
        >
          {mode === 'export'
            ? 'Download Safe file'
            : mode === 'propose'
              ? 'Propose to the Safe'
              : review.danger
                ? 'Sign the transfer'
                : 'Sign in wallet'}
        </Button>
      </Row>
    </Box>
  )
}
