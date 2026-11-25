import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import tsconfigPaths from 'vite-tsconfig-paths'

const root = dirname(fileURLToPath(import.meta.url))

/** Code-unit order, as a plain sort() without a comparator would give. */
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

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

/*
 * The page a link opens is loaded as soon as the HTML is read, alongside the
 * app's main file, instead of once that file has run and the router has
 * asked for it: an inline script matches the address against the routes
 * below (the same paths as src/bootstrap/app-router.tsx, which lazy-loads
 * them) and adds a modulepreload link for each of the page's files.
 * A list or entry page picks its kind (Standard or Stake) only once the
 * indexer has answered: the Standard page is loaded early, as most lists
 * are Standard, and a Stake page loads the few files of its own as before
 * (the two kinds share most of theirs). A route missing here, or a path
 * that matches nothing, only loads as it did without this. The data hosts
 * every page reads first are connected to early too (preconnect).
 */
const ROUTE_PRELOADS: { pattern: string; pages: string[] }[] = [
  { pattern: '^/$', pages: ['src/pages/dashboard/index.tsx'] },
  { pattern: '^/browse/?$', pages: ['src/pages/browse/index.tsx'] },
  { pattern: '^/address/[^/]+/?$', pages: ['src/pages/address/index.tsx'] },
  { pattern: '^/guide/?$', pages: ['src/pages/guide/index.tsx'] },
  { pattern: '^/launch/[^/]+/?$', pages: ['src/pages/launch-list/index.tsx'] },
  { pattern: '^/factory/[^/]+/?$', pages: ['src/pages/factory/index.tsx'] },
  {
    pattern: '^/factory-permanent/[^/]+/?$',
    pages: ['src/pages/factory-permanent/index.tsx'],
  },
  {
    pattern: '^/tcr/\\d+/[^/]+/submit/?$',
    pages: ['src/pages/submit-item/index.tsx'],
  },
  {
    pattern: '^/tcr/\\d+/[^/]+/[^/]+/?$',
    pages: [
      'src/pages/item-details-router.tsx',
      'src/pages/standard-item-details/index.tsx',
    ],
  },
  {
    pattern: '^/tcr/\\d+/[^/]+/?$',
    pages: ['src/pages/items-router.tsx', 'src/pages/standard-items/index.tsx'],
  },
]

const routePreload = (origins: string[]): Plugin => {
  let base = '/'
  return {
    name: 'route-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle, chunk, path }) {
        // The app's page only (the landing page has no router).
        if (!bundle || !chunk || path !== '/index.html') return
        const chunks = Object.values(bundle).filter(
          (output) => output.type === 'chunk',
        )
        const bySource = (source: string) =>
          chunks.find(
            (output) => output.facadeModuleId === resolve(root, source),
          )
        // A chunk and every chunk it imports, as the browser would load it.
        const closure = (fileName: string, into = new Set<string>()) => {
          if (into.has(fileName)) return into
          into.add(fileName)
          const output = bundle[fileName]
          if (output?.type === 'chunk')
            for (const file of output.imports) closure(file, into)
          return into
        }
        const entry = closure(chunk.fileName)
        const filesOf = (source: string) => {
          const output = bySource(source)
          if (!output) throw new Error(`route-preload: no chunk for ${source}`)
          return closure(output.fileName)
        }
        const table = ROUTE_PRELOADS.map(({ pattern, pages }) => {
          const files = new Set<string>()
          for (const page of pages)
            for (const file of filesOf(page))
              if (!entry.has(file)) files.add(file)
          return [pattern, [...files].sort(byCodeUnit)]
        })
        const script = `(function(){var r=${JSON.stringify(table)},p=location.pathname;for(var i=0;i<r.length;i++)if(new RegExp(r[i][0],'i').test(p)){for(var j=0;j<r[i][1].length;j++){var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=${JSON.stringify(base)}+r[i][1][j];document.head.appendChild(l)}break}})()`
        return [
          ...origins.map((href) => ({
            tag: 'link',
            attrs: { rel: 'preconnect', href, crossorigin: '' },
            injectTo: 'head' as const,
          })),
          { tag: 'script', children: script, injectTo: 'head' as const },
        ]
      },
    },
  }
}

/** The origins of the indexers and the IPFS gateway: every page's first reads. */
const dataOrigins = (env: Record<string, string>): string[] => {
  const origins = new Set<string>()
  for (const [key, value] of Object.entries(env))
    if (
      /^REACT_APP_(SUBGRAPH_(MAINNET|GNOSIS)(_PERMANENT)?|IPFS_GATEWAY)$/.test(
        key,
      )
    )
      try {
        origins.add(new URL(value).origin)
      } catch {
        // Not a URL: nothing to connect to.
      }
  return [...origins].sort(byCodeUnit)
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
      routePreload(dataOrigins(loadedEnv)),
      react(),
      svgr({ include: '**/*.svg' }),
      tsconfigPaths(),
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'events'],
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
