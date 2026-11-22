import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RotatingWord from './rotating-word'

const WORDS = ['tokens', 'contracts', 'anything'] as const

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

const word = () => screen.getByText(/,$/)

describe('RotatingWord', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts on the first word, with its suffix, hidden from screen readers', () => {
    render(<RotatingWord words={WORDS} suffix="," />)
    expect(word()).toHaveTextContent('tokens,')
    expect(word()).toHaveAttribute('aria-hidden', 'true')
  })

  it('runs through the words once and rests on the last', () => {
    render(<RotatingWord words={WORDS} suffix="," interval={1600} />)
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(word()).toHaveTextContent('contracts,')
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(word()).toHaveTextContent('anything,')
    // It never loops back.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(word()).toHaveTextContent('anything,')
  })

  it('waits while the tab is hidden', () => {
    render(<RotatingWord words={WORDS} suffix="," interval={1600} />)
    act(() => setVisibility('hidden'))
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(word()).toHaveTextContent('tokens,')
    act(() => setVisibility('visible'))
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(word()).toHaveTextContent('contracts,')
  })

  it('stays on the first word under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    render(<RotatingWord words={WORDS} suffix="," interval={1600} />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(word()).toHaveTextContent('tokens,')
  })
})
