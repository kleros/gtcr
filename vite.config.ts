import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import tsconfigPaths from 'vite-tsconfig-paths'

const root = dirname(fileURLToPath(import.meta.url))

// The standalone landing page is landing/index.html (assets in public/landing/).
// Static hosts serve /landing/ as its index; the dev server needs the hint.
const landingRewrite = (
  req: { url?: string },
  _res: unknown,
  next: () => void,
) => {
  const [path, query] = (req.url ?? '').split('?')
  if (path === '/landing' || path === '/landing/')
    req.url = `/landing/index.html${query ? `?${query}` : ''}`
  next()
}

const landingIndex = (): Plugin => ({
  name: 'landing-index',
  configureServer(server) {
    server.middlewares.use(landingRewrite)
  },
  configurePreviewServer(server) {
    server.middlewares.use(landingRewrite)
  },
})

/*
 * Vite's hashed build files are cached for a year, by one exact rule per
 * file written into the build's _headers. A pattern (/assets/*) would also
 * cover the 404 a missing file gets, since Netlify picks headers by path:
 * browsers and Cloudflare would keep that 404 for a year, and after a
 * rollback it would stand in for a file the restored release does have.
 */
const immutableAssetHeaders = (): Plugin => {
  let outDir = resolve(root, 'build')
  return {
    name: 'immutable-asset-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const assets = join(outDir, 'assets')
      if (!existsSync(assets)) return
      const rules = readdirSync(assets)
        .filter((file) => !file.endsWith('.map'))
        .sort()
        .map(
          (file) =>
            `/assets/${file}\n  Cache-Control: public, max-age=31536000, immutable\n`,
        )
        .join('\n')
      // Written from the source each build, so it never doubles up.
      const base = readFileSync(resolve(root, 'public/_headers'), 'utf8')
      writeFileSync(
        join(outDir, '_headers'),
        `${base.trimEnd()}\n\n# Every build file, by name (vite.config.ts).\n${rules}`,
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load .env files and map REACT_APP_* vars to process.env.* for legacy compat
  const loadedEnv = loadEnv(mode, process.cwd(), ['REACT_APP_', 'VITE_'])
  const define: Record<string, string> = {}
  for (const [key, value] of Object.entries(loadedEnv))
    define[`process.env.${key}`] = JSON.stringify(value)

  return {
    plugins: [
      landingIndex(),
      immutableAssetHeaders(),
      react(),
      svgr({ include: '**/*.svg' }),
      tsconfigPaths(),
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'events', 'crypto'],
        globals: { Buffer: true, global: true, process: true },
      }),
    ],
    envPrefix: ['VITE_', 'REACT_APP_'],
    define: {
      ...define,
      'process.env.NODE_ENV': JSON.stringify(mode),
      // Names the build, so data a page saved in the browser is only read
      // back by the build that wrote it (pages/dashboard/saved-load.ts).
      // COMMIT_REF is Netlify's; elsewhere each build or dev start is new.
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(
        process.env.COMMIT_REF || String(Date.now()),
      ),
    },
    build: {
      outDir: 'build',
      sourcemap: true,
      rollupOptions: {
        // The app, and the standalone landing page served at /landing/.
        input: {
          main: resolve(root, 'index.html'),
          landing: resolve(root, 'landing/index.html'),
        },
      },
    },
    server: {
      port: 3000,
    },
  }
})
