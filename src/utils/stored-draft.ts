/*
 * The list wizards keep their draft in localStorage. Storage can be blocked
 * (site data refused) or full, and a stored draft can fail to read (written
 * by hand, or cut short): none of that may take the wizard down. A draft
 * that cannot be read is no draft, so the wizard starts afresh; one that
 * cannot be written lasts until the page reloads.
 */

/** The parsed draft kept under `key`, or undefined when there is none. */
export const readStoredDraft = (key: string): unknown => {
  try {
    const text = window.localStorage.getItem(key)
    return text ? (JSON.parse(text) as unknown) : undefined
  } catch {
    return undefined
  }
}

/** Keeps `value` under `key`, unless storage refuses it. */
export const writeStoredDraft = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Blocked or full: the draft lasts until the page reloads.
  }
}
