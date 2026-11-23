import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStoredDraft, writeStoredDraft } from './stored-draft'

/** A localStorage stand-in holding `entries`. */
const storage = (entries: Record<string, string> = {}) => ({
  getItem: (key: string) => entries[key] ?? null,
  setItem: (key: string, value: string) => {
    entries[key] = value
  },
  entries,
})

const withStorage = (localStorage: unknown) =>
  vi.stubGlobal('window', { localStorage })

/** A window whose localStorage getter throws, as when site data is blocked. */
const blocked = () =>
  vi.stubGlobal(
    'window',
    Object.defineProperty({}, 'localStorage', {
      get: () => {
        throw new DOMException('Access is denied for this document.')
      },
    }),
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readStoredDraft', () => {
  it('reads a kept draft', () => {
    withStorage(storage({ draft: '{"chainId":100}' }))
    expect(readStoredDraft('draft')).toEqual({ chainId: 100 })
  })

  it('finds no draft where none was kept', () => {
    withStorage(storage())
    expect(readStoredDraft('draft')).toBeUndefined()
  })

  it('takes a draft that no longer reads for none', () => {
    withStorage(storage({ draft: '{"chainId":10' }))
    expect(readStoredDraft('draft')).toBeUndefined()
  })

  it('takes blocked storage for no draft', () => {
    blocked()
    expect(readStoredDraft('draft')).toBeUndefined()
  })
})

describe('writeStoredDraft', () => {
  it('keeps the draft as JSON', () => {
    const kept = storage()
    withStorage(kept)
    writeStoredDraft('draft', { chainId: 100 })
    expect(kept.entries.draft).toBe('{"chainId":100}')
  })

  it('lets storage that refuses go without an error', () => {
    blocked()
    expect(() => writeStoredDraft('draft', { chainId: 100 })).not.toThrow()
    withStorage({
      setItem: () => {
        throw new DOMException('The quota has been exceeded.')
      },
    })
    expect(() => writeStoredDraft('draft', { chainId: 100 })).not.toThrow()
  })
})
