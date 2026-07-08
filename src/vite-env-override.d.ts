// Overrides vite/client's `*.svg` (string URL) declaration. svgr is configured
// with `include: '**/*.svg'` (see vite.config.ts), so every .svg import
// resolves to a React component. Referenced before vite/client in
// vite-env.d.ts because TypeScript picks the first matching wildcard module.
declare module '*.svg' {
  import type * as React from 'react'

  const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >
  export default ReactComponent
}
