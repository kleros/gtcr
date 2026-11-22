import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'

/*
 * Unit and component tests (`yarn test`). The browser tests are separate:
 * e2e/ (`yarn test:e2e`, Playwright).
 *
 * - `*.test.ts` run in Node: the app's logic, which imports no React.
 * - `*.test.tsx` run in jsdom with Testing Library (src/test/setup-dom.ts).
 *
 * The tests never read a developer's .env: `envDir` points at a folder with
 * none, and the few variables the app reads at import time are set below, so
 * a run is the same on every machine and in CI.
 */
export default defineConfig({
  plugins: [react(), svgr({ include: '**/*.svg' }), tsconfigPaths()],
  resolve: {
    alias: {
      // Declares only a `module` entry, which Vitest's Node resolution
      // does not read (Vite's browser build does).
      '@kleros/kleros-app': fileURLToPath(
        new URL(
          './node_modules/@kleros/kleros-app/dist/kleros-app.js',
          import.meta.url,
        ),
      ),
    },
  },
  envDir: 'src/test',
  envPrefix: ['VITE_', 'REACT_APP_'],
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify('test'),
  },
  test: {
    env: {
      REACT_APP_IPFS_GATEWAY: 'https://cdn.kleros.link',
      REACT_APP_DEFAULT_NETWORK: '100',
      REACT_APP_COURT_FUNCTIONS_URL: 'https://kleros-api.netlify.app',
      REACT_APP_ATLAS_URI: 'https://atlas.test',
      REACT_APP_SUBGRAPH_MAINNET: 'https://standard.indexer.test/1',
      REACT_APP_SUBGRAPH_GNOSIS: 'https://standard.indexer.test/100',
      REACT_APP_SUBGRAPH_SEPOLIA: 'https://standard.indexer.test/11155111',
      REACT_APP_SUBGRAPH_MAINNET_PERMANENT: 'https://stake.indexer.test/1',
      REACT_APP_SUBGRAPH_GNOSIS_PERMANENT: 'https://stake.indexer.test/100',
      REACT_APP_SUBGRAPH_SEPOLIA_PERMANENT:
        'https://stake.indexer.test/11155111',
    },
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['src/test/setup-dom.ts'],
          // A first render in jsdom can pass Vitest's 5s on a loaded runner.
          testTimeout: 15_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html', 'lcov'],
    },
  },
})
