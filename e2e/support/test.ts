/*
 * The `test` every spec imports: Playwright's, with each page wired to the
 * recordings (support/network.ts), the browser clock pinned to the time
 * they were made, and three checks after every test: nothing the page
 * asked for was missing from the recordings, nothing went to an unknown
 * host, and the page threw or logged no error.
 */
import { expect, test as base, type Page } from '@playwright/test'
import {
  RECORDING,
  Recordings,
  routeNetwork,
  settle,
  type Traffic,
} from './network'

/**
 * Console errors that are not the app failing. Keep each one narrow: a
 * broad pattern once hid the app's error page behind "AppKit".
 */
const expectedConsole = (text: string, url: string) =>
  // A request the router refused on purpose (the wallet kit's telemetry
  // and remote config), or a 404 the services really answered.
  /^Failed to load resource: (net::ERR_INTERNET_DISCONNECTED|the server responded with a status of 404)/.test(
    text,
  ) ||
  // A public RPC refusing a wide log scan (drpc's free plan answers 400);
  // the app scans in chunks instead. A 400 from an indexer still fails.
  (text.startsWith(
    'Failed to load resource: the server responded with a status of 400',
  ) &&
    !url.includes('.e2e.test/'))

interface PageFixtures {
  traffic: Traffic
  /** Errors the page threw or logged, checked after the test. */
  pageErrors: string[]
}

export const test = base.extend<PageFixtures, { recordings: Recordings }>({
  recordings: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const recordings = new Recordings()
      await use(recordings)
      recordings.save()
    },
    { scope: 'worker' },
  ],

  traffic: async ({ context, recordings, baseURL }, use) => {
    const origin = new URL(baseURL ?? 'http://localhost:4173').origin
    await use(await routeNetwork(context, recordings, origin))
  },

  pageErrors: async ({}, use) => {
    await use([])
  },

  page: async ({ page, traffic, recordings, pageErrors }, use) => {
    // The recording's time, then running: request keys only hold day- or
    // bucket-rounded times, and a frozen Date would stall every debounce
    // that measures time with it (use-debounce: the wizard's draft).
    await page.clock.install({ time: recordings.recordedAt })
    page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}`))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (expectedConsole(text, message.location().url)) return
      pageErrors.push(`console.error: ${text.slice(0, 400)}`)
    })

    await use(page)

    // What a page still asks once the test is done is answered (and, while
    // recording, kept) before the checks, in both modes alike.
    await settle(traffic)

    // The app's error boundary (bootstrap/app.tsx) catches a crash and
    // shows this; React logs nothing in a production build.
    await expect
      .soft(page.getByText('Something went wrong'), 'the app crashed')
      .toHaveCount(0)
    if (!RECORDING)
      expect
        .soft(
          traffic.misses,
          'requests with no recording: run `yarn test:e2e:record`',
        )
        .toEqual([])
    expect
      .soft(
        traffic.unknown,
        'requests to a host e2e/support/network.ts does not know',
      )
      .toEqual([])
    expect.soft(pageErrors, 'errors on the page').toEqual([])
  },
})

export { expect }

/** True when the page scrolls sideways: something is wider than the screen. */
export const overflowsSideways = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  )
