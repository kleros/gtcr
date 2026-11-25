import { defineConfig, devices } from '@playwright/test'

/*
 * Browser tests (`yarn test:e2e`): the production build with placeholder
 * services (e2e/build.mjs), every request answered from e2e/recordings
 * (support/network.ts). `yarn test:e2e:record` re-records them against the
 * real services in your .env, one worker, the whole suite.
 *
 * Paths here are relative to this folder.
 */
const PORT = 4173
const recording = !!process.env.E2E_RECORD

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: 'results',
  globalSetup: './support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI && !recording ? 1 : 0,
  workers: recording ? 1 : undefined,
  timeout: recording ? 120_000 : 45_000,
  expect: { timeout: recording ? 45_000 : 15_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'block',
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node e2e/build.mjs && yarn vite preview --outDir build-e2e --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
