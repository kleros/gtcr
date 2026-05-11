/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly REACT_APP_ATLAS_URI: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
