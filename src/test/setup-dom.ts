/*
 * jsdom setup for the component tests (*.test.tsx): Testing Library's
 * matchers, a clean DOM after each test, and the browser APIs the app uses
 * that jsdom does not implement. Each stand-in is the quiet default a real
 * browser would give a test: no motion preference, nothing resized, every
 * observed element in view.
 */
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// react-blockies (the account identicon) paints on a canvas, which jsdom
// only has where the native `canvas` package is built: on some machines,
// not in CI, which installs without build scripts. It renders as an empty
// canvas here, so a test sees the same thing everywhere.
vi.mock('react-blockies', () => ({
  default: ({ className }: { className?: string }) =>
    React.createElement('canvas', { className }),
}))

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

if (!window.matchMedia)
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })

class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in window))
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: StubResizeObserver,
  })

class StubIntersectionObserver {
  readonly root = null
  readonly rootMargin = '0px'
  readonly thresholds = [0]
  constructor(
    private readonly callback: (
      entries: Partial<IntersectionObserverEntry>[],
    ) => void,
  ) {}
  observe(target: Element) {
    // Everything is in view: reveals and lazy reads run at once.
    this.callback([{ isIntersecting: true, intersectionRatio: 1, target }])
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
if (!('IntersectionObserver' in window))
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: StubIntersectionObserver,
  })

if (!Element.prototype.scrollIntoView)
  Element.prototype.scrollIntoView = function scrollIntoView() {}
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
