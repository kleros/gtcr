import React from 'react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { request } from 'utils/indexer-request'
import useFactory from './factory'

vi.mock('utils/indexer-request', () => ({ request: vi.fn() }))

const GNOSIS = 100
const ETHEREUM = 1
// Kleros' list of lists on Gnosis: a Standard list that exists on Gnosis only.
const GNOSIS_LIST = '0x5f688a4bac5e2787ef1d9de325831e537ee4cffa'

/** The list checks as the submit page on a chain's list runs them. */
const checksOn = (chainId: number) =>
  renderHook(() => useFactory(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter
        initialEntries={[`/tcr/${chainId}/${GNOSIS_LIST}/submit`]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: false }}
      >
        {children}
      </MemoryRouter>
    ),
  }).result.current

describe('deployedWithStandardFactory', () => {
  it('takes a Standard list on its own chain only, as the indexer names it', async () => {
    // One indexer serves every chain: it finds the list from any of them.
    vi.mocked(request).mockResolvedValue({
      lregistry: { id: GNOSIS_LIST, chainId: GNOSIS },
    })

    expect(
      await checksOn(GNOSIS).deployedWithStandardFactory(GNOSIS_LIST),
    ).toBe(true)
    expect(
      await checksOn(ETHEREUM).deployedWithStandardFactory(GNOSIS_LIST),
    ).toBe(false)
    expect(vi.mocked(request).mock.calls[0][1]).toContain('chainId')
  })

  it('is false where the indexer has no list', async () => {
    vi.mocked(request).mockResolvedValue({ lregistry: null })
    expect(
      await checksOn(GNOSIS).deployedWithStandardFactory(GNOSIS_LIST),
    ).toBe(false)
  })

  it('throws when the indexer does not answer, so it is never "not deployed"', async () => {
    vi.mocked(request).mockRejectedValue(new Error('503'))
    await expect(
      checksOn(GNOSIS).deployedWithStandardFactory(GNOSIS_LIST),
    ).rejects.toThrow('503')
  })
})
