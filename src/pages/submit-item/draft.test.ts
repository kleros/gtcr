import { describe, expect, it } from 'vitest'
import {
  MAX_DRAFT_CHARS,
  clearDraft,
  draftKey,
  hasEntry,
  readDraft,
  saveDraft,
  type DraftStore,
} from './draft'

/** A session storage of its own for each test. */
const memoryStore = (): DraftStore & { items: Map<string, string> } => {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
  }
}

/** Storage the browser refuses: blocked, or full. */
const refusingStore: DraftStore = {
  getItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError')
  },
  removeItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  },
}

const columns = [
  { label: 'Name', type: 'text' },
  { label: 'Website', type: 'link' },
  { label: 'Logo', type: 'image' },
] as Column[]

const LIST = '/tcr/100/0x66260c69d03837016d88c9877e61e08ef74c59f2'
const BLANK = { Name: '', Website: '', Logo: '' }

describe('draftKey', () => {
  it('is one per list: another chain or address never shares it', () => {
    const key = draftKey(LIST, BLANK)
    expect(draftKey(LIST.replace('/100/', '/1/'), BLANK)).not.toBe(key)
    expect(draftKey(LIST.replace('0x6626', '0x6627'), BLANK)).not.toBe(key)
  })

  it('reads the address in any case', () => {
    expect(draftKey(LIST.toUpperCase().replace('/TCR/', '/tcr/'), BLANK)).toBe(
      draftKey(LIST, BLANK),
    )
  })

  it('is one per starting values: a resubmission has its own', () => {
    expect(draftKey(LIST, { ...BLANK, Name: 'Old entry' })).not.toBe(
      draftKey(LIST, BLANK),
    )
  })
})

describe('saveDraft and readDraft', () => {
  it('give back what was typed', () => {
    const store = memoryStore()
    const key = draftKey(LIST, BLANK)
    const values = { Name: 'Kleros', Website: 'https://kleros.io', Logo: '' }
    saveDraft(key, columns, BLANK, values, store)

    expect(readDraft(key, columns, BLANK, store)).toEqual({
      values,
      files: [],
    })
  })

  it('keep nothing when nothing was typed, and remove an older draft', () => {
    const store = memoryStore()
    const key = draftKey(LIST, BLANK)
    saveDraft(key, columns, BLANK, { ...BLANK, Name: 'Kleros' }, store)
    saveDraft(key, columns, BLANK, BLANK, store)

    expect(store.items.size).toBe(0)
    expect(readDraft(key, columns, BLANK, store)).toBeUndefined()
  })

  it('keep a picked file out, and say which field had one', () => {
    const store = memoryStore()
    const key = draftKey(LIST, BLANK)
    const logo = new File(['x'.repeat(2048)], 'logo.png', { type: 'image/png' })
    saveDraft(
      key,
      columns,
      BLANK,
      { ...BLANK, Name: 'Kleros', Logo: logo },
      store,
    )

    expect(store.items.get(key)).not.toContain('logo.png')
    expect(readDraft(key, columns, BLANK, store)).toEqual({
      values: { ...BLANK, Name: 'Kleros' },
      files: ['Logo'],
    })
  })

  it('keep an uploaded file, which is its IPFS path', () => {
    const store = memoryStore()
    const key = draftKey(LIST, BLANK)
    const values = { ...BLANK, Logo: '/ipfs/QmLogo/logo.png' }
    saveDraft(key, columns, BLANK, values, store)

    expect(readDraft(key, columns, BLANK, store)?.values).toEqual(values)
  })

  it('never put a draft begun from other values in place of a prefill', () => {
    const store = memoryStore()
    const entry = { ...BLANK, Name: 'Rejected entry' }
    // Two keys collide only by chance; the stored start is checked as well.
    const key = draftKey(LIST, BLANK)
    saveDraft(key, columns, BLANK, { ...BLANK, Name: 'New one' }, store)

    expect(readDraft(key, columns, entry, store)).toBeUndefined()
  })

  it('read only the list’s current columns', () => {
    const store = memoryStore()
    const key = draftKey(LIST, BLANK)
    saveDraft(key, columns, BLANK, { ...BLANK, Name: 'Kleros' }, store)
    const renamed = [{ label: 'Title', type: 'text' }] as Column[]

    // The list's file changed: another start, so another draft.
    expect(readDraft(key, renamed, { Title: '' }, store)).toBeUndefined()
  })

  it('ignore a stored draft that is not one', () => {
    const store = memoryStore()
    const key = draftKey(LIST, BLANK)
    for (const text of [
      'not json',
      '[]',
      JSON.stringify({ start: BLANK }),
      JSON.stringify({ start: BLANK, values: { Name: { x: 1 } } }),
    ]) {
      store.items.set(key, text)
      expect(readDraft(key, columns, BLANK, store)).toBeUndefined()
    }
  })

  it('keep nothing past the size limit', () => {
    const store = memoryStore()
    const key = draftKey(LIST, BLANK)
    saveDraft(key, columns, BLANK, { ...BLANK, Name: 'Kleros' }, store)
    const huge = 'x'.repeat(MAX_DRAFT_CHARS)
    saveDraft(key, columns, BLANK, { ...BLANK, Name: huge }, store)

    // The smaller draft before it is gone too: it is older than the form.
    expect(store.items.size).toBe(0)
  })

  it('never throw when storage is blocked or full', () => {
    const key = draftKey(LIST, BLANK)
    const values = { ...BLANK, Name: 'Kleros' }
    expect(() =>
      saveDraft(key, columns, BLANK, values, refusingStore),
    ).not.toThrow()
    expect(readDraft(key, columns, BLANK, refusingStore)).toBeUndefined()
    expect(() => clearDraft(key, refusingStore)).not.toThrow()
  })

  it('never throw without a window (no session storage at all)', () => {
    const key = draftKey(LIST, BLANK)
    expect(() =>
      saveDraft(key, columns, BLANK, { ...BLANK, Name: 'Kleros' }),
    ).not.toThrow()
    expect(readDraft(key, columns, BLANK)).toBeUndefined()
  })
})

describe('hasEntry', () => {
  it('is true once text differs from the start, or a file is picked', () => {
    const start = { ...BLANK, Name: 'Prefilled' }
    expect(hasEntry(columns, start, start)).toBe(false)
    expect(hasEntry(columns, { ...start, Name: 'Changed' }, start)).toBe(true)
    expect(
      hasEntry(
        columns,
        { ...start, Logo: new File(['x'], 'logo.png', { type: 'image/png' }) },
        start,
      ),
    ).toBe(true)
  })
})
