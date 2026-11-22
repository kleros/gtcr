/*
 * Builds the app the browser tests run against, into build-e2e/, with the
 * placeholder services of e2e/e2e.env. A production build (not the dev
 * server): the tests see what Netlify ships, and pages load in a second.
 *
 * Run by Playwright's webServer (e2e/playwright.config.ts) before each run.
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readEnvFile } from './support/env-file.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const env = {
  ...process.env,
  ...readEnvFile(resolve(root, 'e2e/e2e.env')),
  // One build id, so nothing a page saves depends on when it was built.
  COMMIT_REF: 'e2e',
}

const run = spawnSync(
  'yarn',
  // Errors only: the wallet kit's dependencies print hundreds of harmless
  // Rollup notes about /*#__PURE__*/ comments.
  [
    'vite',
    'build',
    '--outDir',
    'build-e2e',
    '--emptyOutDir',
    '--logLevel',
    'error',
  ],
  { cwd: root, env, stdio: 'inherit' },
)
process.exit(run.status ?? 1)
