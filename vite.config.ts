import { dirname, resolve } from 'node:path'
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

export default defineConfig(({ mode }) => {
  // Load .env files and map REACT_APP_* vars to process.env.* for legacy compat
  const loadedEnv = loadEnv(mode, process.cwd(), ['REACT_APP_', 'VITE_'])
  const define: Record<string, string> = {}
  for (const [key, value] of Object.entries(loadedEnv))
    define[`process.env.${key}`] = JSON.stringify(value)

  return {
    plugins: [
      landingIndex(),
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
