import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchMetaEvidenceFile,
  sanitizeColumns,
  sanitizeMetaEvidence,
} from './meta-evidence-guard'

const CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
const URI = `/ipfs/${CID}/meta-evidence.json`

const VALID = {
  title: 'Tokens',
  description: 'ERC-20 tokens',
  itemName: 'token',
  itemNamePlural: 'tokens',
  fileURI: `/ipfs/${CID}/policy.pdf`,
  evidenceDisplayInterfaceURI: `/ipfs/${CID}/index.html`,
  columns: [
    {
      label: 'Name',
      type: 'text',
      description: 'Its name',
      isIdentifier: true,
    },
    { label: 'Proof', type: 'file', allowedFileTypes: 'pdf' },
  ],
  metadata: {
    tcrTitle: 'Tokens',
    tcrDescription: 'ERC-20 tokens',
    itemName: 'token',
    itemNamePlural: 'tokens',
    logoURI: `/ipfs/${CID}/logo.png`,
    policyURI: `/ipfs/${CID}/policy.pdf`,
    isTCRofTCRs: false,
    requireRemovalEvidence: true,
    columns: [{ label: 'Name', type: 'text' }],
  },
}

const NOT_TEXT = [
  ['an object with its own toString', JSON.parse('{"toString":1}')],
  ['a number', 5],
  ['an array', ['Tokens']],
  ['null', null],
  ['a boolean', true],
] as const

describe('sanitizeColumns', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an object', { label: 'Name' }],
    ['text', 'Name,Address'],
  ])('is undefined for columns that are %s', (_, columns) => {
    expect(sanitizeColumns(columns)).toBeUndefined()
  })

  it('drops entries that are not column objects', () => {
    expect(
      sanitizeColumns([null, 'Name', 5, ['Name'], true, { label: 'Kept' }]),
    ).toEqual([{ label: 'Kept', type: 'text' }])
  })

  it('reads a label that is a number or a boolean as text, anything else as empty', () => {
    expect(
      sanitizeColumns([
        { label: 7 },
        { label: false },
        { label: JSON.parse('{"toString":1}') },
        { label: ['a'] },
        { label: null },
        {},
      ])?.map((column) => column.label),
    ).toEqual(['7', 'false', '', '', '', ''])
  })

  it('makes a type that is not text a text column', () => {
    expect(
      sanitizeColumns([
        { type: 3 },
        { type: { a: 1 } },
        { type: 'image' },
      ])?.map((column) => column.type),
    ).toEqual(['text', 'text', 'image'])
  })

  it('drops a description that is not text', () => {
    const [kept, dropped] = sanitizeColumns([
      { label: 'A', description: 'Shown under the field' },
      { label: 'B', description: { html: '<b>x</b>' } },
    ]) as Column[]
    expect(kept.description).toBe('Shown under the field')
    expect(dropped.description).toBeUndefined()
  })

  it('keeps the other keys a column carries', () => {
    expect(
      sanitizeColumns([{ label: 'Name', type: 'text', isIdentifier: true }]),
    ).toEqual([{ label: 'Name', type: 'text', isIdentifier: true }])
  })

  // Regression: sanitizeColumns copied a column's other keys as they are
  // (`...column`). The submit page reads a file column's allowedFileTypes
  // while it renders (pages/submit-item/fields.tsx, allowedExtensions, which
  // calls .toLowerCase() on it): a list file with "allowedFileTypes": 5 takes
  // the list's submit page down for every visitor.
  it('keeps allowedFileTypes only when it is text', () => {
    const [column] = sanitizeColumns([
      { label: 'Proof', type: 'file', allowedFileTypes: 5 },
    ]) as Column[]
    expect(['string', 'undefined']).toContain(typeof column.allowedFileTypes)
  })
})

describe('sanitizeMetaEvidence', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', [VALID]],
    ['text', JSON.stringify(VALID)],
    ['a number', 1],
  ])('is null for a file that is %s', (_, file) => {
    expect(sanitizeMetaEvidence(file)).toBeNull()
  })

  it('keeps a well-formed file as it is', () => {
    expect(sanitizeMetaEvidence(VALID)).toEqual(VALID)
  })

  it('does not change the file it was given', () => {
    const file = {
      ...VALID,
      title: 5,
      metadata: { ...VALID.metadata, logoURI: {} },
    }
    const before = structuredClone(file)
    sanitizeMetaEvidence(file)
    expect(file).toEqual(before)
  })

  it.each(NOT_TEXT)('drops each text field that is %s', (_, value) => {
    const file = sanitizeMetaEvidence({
      ...VALID,
      title: value,
      description: value,
      itemName: value,
      itemNamePlural: value,
      fileURI: value,
      evidenceDisplayInterfaceURI: value,
    })
    for (const key of [
      'title',
      'description',
      'itemName',
      'itemNamePlural',
      'fileURI',
      'evidenceDisplayInterfaceURI',
    ])
      expect(file).not.toHaveProperty(key)
    expect(file?.columns).toEqual(VALID.columns)
  })

  it.each(NOT_TEXT)('drops each metadata text field that is %s', (_, value) => {
    const file = sanitizeMetaEvidence({
      ...VALID,
      metadata: {
        ...VALID.metadata,
        tcrTitle: value,
        tcrDescription: value,
        title: value,
        description: value,
        itemName: value,
        itemNamePlural: value,
        logoURI: value,
        policyURI: value,
      },
    })
    expect(file?.metadata).toEqual({
      isTCRofTCRs: false,
      requireRemovalEvidence: true,
      columns: [{ label: 'Name', type: 'text' }],
    })
  })

  it('keeps fields it does not render as text', () => {
    const file = sanitizeMetaEvidence({
      ...VALID,
      address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      version: 2,
    })
    expect(file?.address).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
    expect(file?.version).toBe(2)
  })

  it.each([
    ['text', 'metadata'],
    ['null', null],
    ['an array', [VALID.metadata]],
    ['a number', 1],
  ])('removes metadata that is %s', (_, metadata) => {
    const file = sanitizeMetaEvidence({ ...VALID, metadata })
    expect(file).not.toHaveProperty('metadata')
  })

  it('sanitizes the columns at both levels', () => {
    const file = sanitizeMetaEvidence({
      columns: [{ label: 1, type: 2 }, 'junk'],
      metadata: { columns: [{ label: { toString: 1 } }, null] },
    })
    expect(file?.columns).toEqual([{ label: '1', type: 'text' }])
    expect(file?.metadata?.columns).toEqual([{ label: '', type: 'text' }])
  })

  it('leaves columns that are not a list undefined', () => {
    const file = sanitizeMetaEvidence({ columns: { 0: { label: 'A' } } })
    expect(file?.columns).toBeUndefined()
  })

  it('reads a "__proto__" key as data, not as a prototype', () => {
    const file = sanitizeMetaEvidence(
      JSON.parse('{"title":"T","__proto__":{"polluted":true,"title":1}}'),
    )
    expect(file?.title).toBe('T')
    expect(Object.getPrototypeOf(file)).toBe(Object.prototype)
    expect(file?.polluted).toBeUndefined()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('fetchMetaEvidenceFile', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  it('reads the file through the IPFS gateway and sanitizes it', async () => {
    const fetchMock = vi.fn(async () => json({ ...VALID, title: { a: 1 } }))
    vi.stubGlobal('fetch', fetchMock)
    const file = await fetchMetaEvidenceFile(URI)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://cdn.kleros.link/ipfs/${CID}/meta-evidence.json`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(file).not.toHaveProperty('title')
    expect(file.metadata?.tcrTitle).toBe('Tokens')
  })

  it('throws when the gateway answers with an error, so the read is retried', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'not found' }, 504)),
    )
    await expect(fetchMetaEvidenceFile(URI)).rejects.toThrow(
      'The list file answered 504',
    )
  })

  it.each([
    ['an array', [VALID]],
    ['null', null],
    ['text', 'hello'],
  ])('throws when the file is %s', async (_, body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(body)),
    )
    await expect(fetchMetaEvidenceFile(URI)).rejects.toThrow(
      'The list file is not a MetaEvidence file',
    )
  })

  it('gives up after 20 seconds when the gateway hangs', async () => {
    vi.useFakeTimers()
    // A gateway that would answer after a minute, and stops when aborted.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_: string, init?: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            const answer = setTimeout(() => resolve(json(VALID)), 60_000)
            init?.signal?.addEventListener('abort', () => {
              clearTimeout(answer)
              reject(new DOMException('Aborted', 'AbortError'))
            })
          }),
      ),
    )
    let settled = false
    const outcome = fetchMetaEvidenceFile(URI).then(
      () => {
        settled = true
        return 'resolved'
      },
      (err: Error) => {
        settled = true
        return err.name
      },
    )
    await vi.advanceTimersByTimeAsync(19_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toBe('AbortError')
  })

  it('leaves no timer behind once the file is read', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(VALID)),
    )
    await fetchMetaEvidenceFile(URI)
    expect(vi.getTimerCount()).toBe(0)
  })
})
