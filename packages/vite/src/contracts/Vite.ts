/** Configuration for the Vite integration. */
export interface ViteConfig {
  /** Vite dev server URL. Default: 'http://localhost:5173' */
  devServerUrl: string
  /** Build output directory, relative to publicDir. Default: 'build' */
  buildDir: string
  /** Public directory (absolute path). Default: 'public' */
  publicDir: string
  /** Path to manifest.json inside buildDir. Default: '.vite/manifest.json' */
  manifest: string
  /** Enable React Fast Refresh preamble in dev mode. Default: false */
  reactRefresh: boolean
  /** Root element ID for the app mount point. Default: 'app' */
  rootElement: string
  /** Name of the hot file (relative to publicDir). Default: 'hot' */
  hotFile: string
}

/** A single chunk entry in the Vite 5+ manifest. */
export interface ManifestChunk {
  /** The hashed output file path, e.g. 'assets/main-abc123.js' */
  file: string
  /** The original source path (present on entry chunks) */
  src?: string
  /** Whether this chunk is an entry point */
  isEntry?: boolean
  /** Whether this chunk is a dynamic import */
  isDynamicEntry?: boolean
  /** CSS files extracted from this chunk */
  css?: string[]
  /** Asset files referenced by this chunk (images, fonts, etc.) */
  assets?: string[]
  /** Chunk keys for static imports this chunk depends on */
  imports?: string[]
  /** Chunk keys for dynamic imports */
  dynamicImports?: string[]
}

/** The full Vite manifest — a map from source path to chunk info. */
export type ViteManifest = Record<string, ManifestChunk>

/** Options passed to `vite.page()` for rendering a full HTML document. */
export interface PageOptions {
  /** Entrypoint path(s), e.g. 'src/main.tsx' or ['src/main.tsx', 'src/extra.css'] */
  entry: string | string[]
  /** HTML document title */
  title?: string
  /** Data to inject as window.__MANTIQ_DATA__ for the client */
  data?: Record<string, unknown>
  /** Root element ID override (defaults to config value) */
  rootElement?: string
  /** Extra HTML to inject inside <head> (meta tags, fonts, etc.) */
  head?: string
}
