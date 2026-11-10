import React, { useEffect, useId, useRef, useState } from 'react'
import styled from 'styled-components'
import EvidenceForm, { type EvidenceFormValues } from 'components/evidence-form'
import {
  Button,
  Small,
  Surface,
  VisuallyHidden,
} from 'components/curate/primitives'
import { useActionGate } from 'components/curate/item-light-gate'

/*
 * "Add evidence" on an entry page, always open under the history: one
 * message box (title, description, attachment) and one button. At rest the
 * button is quiet; once something is written it lights up. While the wallet
 * blocks (connect, switch network, sign in for the upload) the same button
 * runs that step and says so. Where the contract takes no evidence for the
 * entry right now, `EvidenceClosed` keeps the section in place with one line
 * saying when it opens. The action card and the phone bar call
 * `openEvidenceComposer()`, which scrolls to the box and focuses it.
 */

/**
 * Kept for the request timelines, which still provide it: the composer no
 * longer folds, so the value is ignored.
 */
export const EvidenceComposerCollapse = React.createContext(false)

const OPEN_EVENT = 'cv:open-evidence'

/** Scroll to the composer on this page and focus its first field. */
export const openEvidenceComposer = () => {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

const Shell = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 16px;
  scroll-margin-top: calc(var(--app-bar-height, 64px) + 24px);
  scroll-margin-bottom: 140px;
`

const Title = styled.h2`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.02em;
`

const ClosedRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px 16px;
`

const ClosedNote = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  svg {
    flex: 0 0 auto;
    color: var(--color-faint);
  }
`

const LockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
  >
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
  </svg>
)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface InlineEvidenceComposerProps {
  id?: string
  formID: string
  formKey?: number
  isSubmitting?: boolean
  onSubmit: (values: EvidenceFormValues) => void
}

const InlineEvidenceComposer = ({
  id = 'evidence-composer',
  formID,
  formKey,
  isSubmitting,
  onSubmit,
}: InlineEvidenceComposerProps) => {
  const gate = useActionGate({ verb: 'submit evidence', needsAuth: true })
  const shellRef = useRef<HTMLDivElement>(null)
  const statusId = useId()
  const [drafted, setDrafted] = useState(false)

  // A sent piece remounts the form (formKey), which starts empty again.
  useEffect(() => setDrafted(false), [formKey])

  useEffect(() => {
    const onOpen = () => {
      const shell = shellRef.current
      if (!shell) return
      shell.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      })
      shell
        .querySelector<HTMLElement>('input:not([type="file"]), textarea')
        ?.focus({ preventScroll: true })
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const fix = gate.ready ? undefined : gate.fix
  const disabled = !!isSubmitting || !gate.ready
  const action = fix ? (
    <Button
      type="button"
      $size="sm"
      $variant={drafted ? 'primary' : 'secondary'}
      disabled={!!fix.loading}
      onClick={fix.onClick}
    >
      {fix.label}
    </Button>
  ) : (
    <>
      {!gate.ready && gate.controls}
      <Button
        type="submit"
        form={formID}
        $size="sm"
        $variant={drafted && gate.ready ? 'primary' : 'secondary'}
        disabled={disabled}
        aria-disabled={disabled}
        aria-describedby={gate.blocker ? statusId : undefined}
        title={gate.blocker}
      >
        {isSubmitting ? 'Waiting for your wallet…' : 'Submit evidence'}
      </Button>
    </>
  )

  return (
    <Shell
      ref={shellRef}
      id={id}
      tabIndex={-1}
      $padding="standard"
      role="region"
      aria-labelledby={`${id}-title`}
    >
      <Title id={`${id}-title`}>Add evidence</Title>
      <EvidenceForm
        key={formKey}
        onSubmit={(values) => {
          // The parent checks the account, not the network or the sign-in.
          if (gate.ready && !isSubmitting) onSubmit(values)
        }}
        formID={formID}
        detailed
        variant="composer"
        actions={action}
        onDraftChange={setDrafted}
        blocked={disabled}
      />
      {/* The button names the wallet step; this says it for screen readers,
          and in words when no single button clears it. */}
      {gate.blocker && !fix ? (
        <Small $muted id={statusId} role="status">
          {gate.blocker}
        </Small>
      ) : (
        <VisuallyHidden id={statusId} role="status">
          {gate.blocker ?? ''}
        </VisuallyHidden>
      )}
    </Shell>
  )
}

/**
 * The section where the contract takes no evidence right now: the same
 * title, and one line saying when it opens.
 */
export const EvidenceClosed = ({
  reason,
  id = 'evidence-closed',
}: {
  reason: string
  id?: string
}) => (
  <Shell
    id={id}
    $padding="standard"
    role="region"
    aria-labelledby={`${id}-title`}
  >
    <ClosedRow>
      <Title id={`${id}-title`}>Add evidence</Title>
      <ClosedNote>
        <LockIcon />
        {reason}
      </ClosedNote>
    </ClosedRow>
  </Shell>
)

export default InlineEvidenceComposer
