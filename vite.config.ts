import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
  // Load .env files and map REACT_APP_* vars to process.env.* for legacy compat
  const loadedEnv = loadEnv(mode, process.cwd(), ['REACT_APP_', 'VITE_'])
  const define: Record<string, string> = {}
  for (const [key, value] of Object.entries(loadedEnv)) {
    define[`process.env.${key}`] = JSON.stringify(value)
  }

  return {
    plugins: [
      react(),
      svgr(),
      tsconfigPaths(),
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'events', 'crypto'],
        globals: { Buffer: true, global: true, process: true }
      })
    ],
    envPrefix: ['VITE_', 'REACT_APP_'],
    define: {
      ...define,
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    build: {
      outDir: 'build',
      sourcemap: true
    },
    server: {
      port: 3000
    }
  }
})
