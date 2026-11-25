import type { SubmissionValues } from './form'

/*
 * A half-filled entry outlives the submit page in its own tab: leave the
 * form (a link, another chain picked in the app bar, Back) or reload it,
 * come back, and it opens as it was left. The draft is kept in
 * sessionStorage, so it stays in this tab, goes when the tab closes and is
 * never sent anywhere.
 *
 * One draft per list (its chain and address) and per set of values the form
 * starts from: a resubmission or a shared link opens with its own values,
 * and a draft begun from others (a blank form, another entry) never takes
 * their place. Only text is kept. A picked file is uploaded only when the
 * entry is sent, and is far too big to store, so the draft notes which
 * fields had one and the form asks for them again.
 */

const PREFIX = 'curate:submit-draft:'

/**
 * The most a draft may take, in characters of JSON. An entry is a few
 * hundred; a draft past this (megabytes pasted into a field) is not kept.
 */
export const MAX_DRAFT_CHARS = 50_000

export type DraftStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The tab's session storage, or none where the browser blocks it. */
const sessionStore = (): DraftStore | undefined => {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

/** A short, stable digest of the starting values (FNV-1a, 32 bits). */
const digest = (text: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Where the draft of one list's form is kept. `listPath` is the list's page
 * (/tcr/<chain>/<address>), read in lower case so a checksummed link and a
 * lower-case one share it; `start` is what the form opens with before any
 * draft.
 */
export const draftKey = (listPath: string, start: SubmissionValues): string =>
  `${PREFIX}${listPath.toLowerCase()}:${digest(JSON.stringify(start))}`

/** A kept draft, as the form reopens it. */
export interface SubmitDraft {
  /** Every column's text: what was typed, else the starting value. */
  values: Record<string, string>
  /** The fields that held a picked file, which was not kept. */
  files: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const startOf = (start: SubmissionValues, label: string): string => {
  const value = start[label]
  return typeof value === 'string' ? value : ''
}

/**
 * Whether the form holds anything the user entered: text that differs from
 * where it started, or a picked file.
 */
export const hasEntry = (
  columns: Column[],
  values: SubmissionValues,
  start: SubmissionValues,
): boolean =>
  columns.some(({ label }) => {
    const value = values[label]
    return (
      value instanceof File ||
      (typeof value === 'string' && value !== startOf(start, label))
    )
  })

/** Removes the draft; storage that refuses changes nothing on the page. */
export const clearDraft = (key: string, store = sessionStore()): void => {
  try {
    store?.removeItem(key)
  } catch {
    // Blocked storage: there is no draft to remove.
  }
}

/**
 * Keeps the form's text as its draft, or removes the draft when nothing was
 * typed. A draft that would be too big, or that storage refuses (blocked or
 * full), is dropped rather than left behind older than the form.
 */
export const saveDraft = (
  key: string,
  columns: Column[],
  start: SubmissionValues,
  values: SubmissionValues,
  store = sessionStore(),
): void => {
  if (!store) return
  const text: Record<string, string> = {}
  const files: string[] = []
  let typed = false
  for (const { label } of columns) {
    const value = values[label]
    if (typeof value === 'string') {
      text[label] = value
      if (value !== startOf(start, label)) typed = true
    } else {
      text[label] = startOf(start, label)
      if (value instanceof File) files.push(label)
    }
  }
  try {
    const draft = JSON.stringify({ start, values: text, files })
    if (!typed || draft.length > MAX_DRAFT_CHARS) store.removeItem(key)
    else store.setItem(key, draft)
  } catch {
    clearDraft(key, store)
  }
}

/** Same columns, same text. */
const sameStart = (
  stored: Record<string, unknown>,
  start: SubmissionValues,
): boolean => {
  const labels = Object.keys(start)
  return (
    Object.keys(stored).length === labels.length &&
    labels.every((label) => stored[label] === startOf(start, label))
  )
}

/**
 * The draft this form left in this tab, if any: only one begun from the
 * same starting values, read field by field for the list's current columns,
 * and only if it holds something typed.
 */
export const readDraft = (
  key: string,
  columns: Column[],
  start: SubmissionValues,
  store = sessionStore(),
): SubmitDraft | undefined => {
  let stored: unknown
  try {
    const text = store?.getItem(key)
    if (!text) return undefined
    stored = JSON.parse(text)
  } catch {
    return undefined
  }
  if (
    !isRecord(stored) ||
    !isRecord(stored.start) ||
    !isRecord(stored.values) ||
    !sameStart(stored.start, start)
  )
    return undefined

  const kept = stored.values
  const values: Record<string, string> = {}
  let typed = false
  for (const { label } of columns) {
    // Text only: nothing else, not even a label such as "constructor" read
    // off the object's prototype, reaches the form.
    const value = kept[label]
    values[label] = typeof value === 'string' ? value : startOf(start, label)
    if (values[label] !== startOf(start, label)) typed = true
  }
  if (!typed) return undefined
  const labels = new Set(columns.map(({ label }) => label))
  const files = Array.isArray(stored.files)
    ? stored.files.filter(
        (label): label is string =>
          typeof label === 'string' && labels.has(label),
      )
    : []
  return { values, files }
}
