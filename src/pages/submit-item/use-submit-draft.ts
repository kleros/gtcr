import { useCallback, useMemo, useRef, useState } from 'react'
import {
  clearDraft,
  draftKey,
  readDraft,
  saveDraft,
  type SubmitDraft,
} from './draft'
import type { SubmissionValues } from './form'
import type { SubmitPhase } from './use-submit-actions'

export interface SubmitDraftHandle {
  /** What this tab kept of the form, read once as it opens. */
  restored?: SubmitDraft
  /** Keeps the form's text as it changes. */
  keep: (values: SubmissionValues, phase: SubmitPhase) => void
  /** The entry is on chain: the draft goes, and is not written again. */
  sent: () => void
  /** The user let what they entered go (Cancel, Clear form). */
  discard: () => void
}

/**
 * The submit form's draft (draft.ts), for one list and the values its form
 * starts from. While the transaction mines the draft is let go, so a reload
 * then does not offer to send the same entry again; if the transaction
 * fails, the next save brings it back.
 */
export const useSubmitDraft = (
  listPath: string,
  columns: Column[],
  start: SubmissionValues,
): SubmitDraftHandle => {
  const key = useMemo(() => draftKey(listPath, start), [listPath, start])
  const [restored] = useState(() => readDraft(key, columns, start))
  const done = useRef(false)

  const keep = useCallback(
    (values: SubmissionValues, phase: SubmitPhase) => {
      if (done.current) return
      if (phase === 'mining') clearDraft(key)
      else saveDraft(key, columns, start, values)
    },
    [columns, key, start],
  )
  const sent = useCallback(() => {
    done.current = true
    clearDraft(key)
  }, [key])
  const discard = useCallback(() => clearDraft(key), [key])

  return useMemo(
    () => ({ restored, keep, sent, discard }),
    [discard, keep, restored, sent],
  )
}
