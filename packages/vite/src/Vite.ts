import type { ViteConfig, ViteManifest, ManifestChunk, PageOptions } from './contracts/Vite.ts'
import { ViteManifestNotFoundError, ViteEntrypointNotFoundError } from './errors/ViteError.ts'

/**
 * Core Vite integration class.
 *
 * Handles dev/prod detection, asset tag generation, manifest reading,
 * and HTML shell rendering. Framework-agnostic — works with React, Vue,
 * Svelte, or vanilla JS.
 */
export class Vite {
  private readonly config: ViteConfig
  private manifestCache: ViteManifest | null = null
  /** null = unchecked, false = not found, string = dev server URL */
  private hotFileCache: string | false | null = null

  constructor(config: Partial<ViteConfig> = {}) {
    this.config = {
      devServerUrl: config.devServerUrl ?? 'http://localhost:5173',
      buildDir: config.buildDir ?? 'build',
      publicDir: config.publicDir ?? 'public',
      manifest: config.manifest ?? '.vite/manifest.json',
      reactRefresh: config.reactRefresh ?? false,
      rootElement: config.rootElement ?? 'app',
      hotFile: config.hotFile ?? 'hot',
    }
  }

  // ── Initialization ───────────────────────────────────────────────────────

  /**
   * Check for the hot file to determine dev/prod mode.
   * Called during ViteServiceProvider.boot().
   */
  async initialize(): Promise<void> {
    const hotPath = this.hotFilePath()
    const file = Bun.file(hotPath)
    if (await file.exists()) {
      const url = (await file.text()).trim()
      this.hotFileCache = url || this.config.devServerUrl
    } else {
      this.hotFileCache = false
    }
  }

  /** Whether the Vite dev server is running (hot file exists). */
  isDev(): boolean {
    return typeof this.hotFileCache === 'string'
  }

  /** The dev server URL (from hot file or config fallback). */
  devServerUrl(): string {
    return typeof this.hotFileCache === 'string'
      ? this.hotFileCache
      : this.config.devServerUrl
  }

  // ── Asset Tag Generation ─────────────────────────────────────────────────

  /**
   * Generate `<script>` and `<link>` tags for the given entrypoint(s).
   *
   * @example
   * ```ts
   * const tags = await vite.assets('src/main.tsx')
   * const tags = await vite.assets(['src/main.tsx', 'src/extra.css'])
   * ```
   */
  async assets(entrypoints: string | string[]): Promise<string> {
    const entries = Array.isArray(entrypoints) ? entrypoints : [entrypoints]

    if (this.isDev()) {
      return this.devAssets(entries)
    }
    return this.prodAssets(entries)
  }

  private devAssets(entries: string[]): string {
    const url = this.devServerUrl()
    const tags: string[] = []

    // React Fast Refresh preamble (must come before any other script)
    if (this.config.reactRefresh) {
      tags.push(this.reactRefreshTag())
    }

    // Vite client for HMR
    tags.push(`<script type="module" src="${url}/@vite/client"></script>`)

    for (const entry of entries) {
      if (entry.endsWith('.css')) {
        tags.push(`<link rel="stylesheet" href="${url}/${entry}">`)
      } else {
        tags.push(`<script type="module" src="${url}/${entry}"></script>`)
      }
    }

    return tags.join('\n    ')
  }

  private async prodAssets(entries: string[]): Promise<string> {
    const manifest = await this.loadManifest()
    const tags: string[] = []
    const cssEmitted = new Set<string>()
    const preloadedPaths = new Set<string>()

    for (const entry of entries) {
      const chunk = manifest[entry]
      if (!chunk) {
        throw new ViteEntrypointNotFoundError(entry, this.manifestPath())
      }

      // Collect all CSS (from this chunk + transitively imported chunks)
      const allCss = this.collectCss(manifest, entry, new Set<string>())
      for (const cssPath of allCss) {
        if (!cssEmitted.has(cssPath)) {
          cssEmitted.add(cssPath)
          tags.push(`<link rel="stylesheet" href="/${this.config.buildDir}/${cssPath}">`)
        }
      }

      // Module preloads for statically imported chunks
      const preloads = this.collectPreloads(manifest, entry, new Set<string>())
      for (const preloadPath of preloads) {
        if (!preloadedPaths.has(preloadPath) && preloadPath !== chunk.file) {
          preloadedPaths.add(preloadPath)
          tags.push(`<link rel="modulepreload" href="/${this.config.buildDir}/${preloadPath}">`)
        }
      }

      // CSS-only entries: emit the file itself as a stylesheet
      if (entry.endsWith('.css')) {
        if (!cssEmitted.has(chunk.file)) {
          cssEmitted.add(chunk.file)
          tags.push(`<link rel="stylesheet" href="/${this.config.buildDir}/${chunk.file}">`)
        }
      } else {
        tags.push(`<script type="module" src="/${this.config.buildDir}/${chunk.file}"></script>`)
      }
    }

    return tags.join('\n    ')
  }

  /** Recursively collect CSS from a chunk and all its static imports. */
  private collectCss(
    manifest: ViteManifest,
    key: string,
    visited: Set<string>,
  ): string[] {
    if (visited.has(key)) return []
    visited.add(key)

    const chunk = manifest[key]
    if (!chunk) return []

    const css: string[] = [...(chunk.css ?? [])]

    for (const imp of chunk.imports ?? []) {
      css.push(...this.collectCss(manifest, imp, visited))
    }

    return css
  }

  /** Recursively collect JS file paths from statically imported chunks for modulepreload. */
  private collectPreloads(
    manifest: ViteManifest,
    key: string,
    visited: Set<string>,
  ): string[] {
    if (visited.has(key)) return []
    visited.add(key)

    const chunk = manifest[key]
    if (!chunk) return []

    const preloads: string[] = []

    for (const imp of chunk.imports ?? []) {
      const importedChunk = manifest[imp]
      if (importedChunk) {
        preloads.push(importedChunk.file)
        preloads.push(...this.collectPreloads(manifest, imp, visited))
      }
    }

    return preloads
  }

  // ── Manifest ─────────────────────────────────────────────────────────────

  /**
   * Load and cache the Vite manifest from disk.
   * @throws ViteManifestNotFoundError if the manifest file does not exist.
   */
  async loadManifest(): Promise<ViteManifest> {
    if (this.manifestCache) return this.manifestCache

    const path = this.manifestPath()
    const file = Bun.file(path)

    if (!(await file.exists())) {
      throw new ViteManifestNotFoundError(path)
    }

    this.manifestCache = (await file.json()) as ViteManifest
    return this.manifestCache
  }

  /** Clear the cached manifest (useful for testing or watch-mode rebuilds). */
  flushManifest(): void {
    this.manifestCache = null
  }

  private manifestPath(): string {
    return `${this.config.publicDir}/${this.config.buildDir}/${this.config.manifest}`
  }

  private hotFilePath(): string {
    return `${this.config.publicDir}/${this.config.hotFile}`
  }

  // ── HTML Shell ───────────────────────────────────────────────────────────

  /**
   * Render a full HTML page with Vite assets injected.
   *
   * @example
   * ```ts
   * const html = await vite.page({
   *   entry: 'src/main.tsx',
   *   title: 'My App',
   *   data: { users: [...] },
   * })
   * return MantiqResponse.html(html)
   * ```
   */
  async page(options: PageOptions): Promise<string> {
    const {
      entry,
      title = '',
      data,
      rootElement = this.config.rootElement,
      head = '',
    } = options

    const assetTags = await this.assets(entry)

    const dataScript = data
      ? `\n    <script>window.__MANTIQ_DATA__ = ${JSON.stringify(data)}</script>`
      : ''

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    ${head}
    ${assetTags}
</head>
<body>
    <div id="${escapeHtml(rootElement)}"></div>${dataScript}
</body>
</html>`
  }

  // ── React Refresh ────────────────────────────────────────────────────────

  /** Generate the React Fast Refresh preamble for dev mode. */
  reactRefreshTag(): string {
    const url = this.devServerUrl()
    return `<script type="module">
      import RefreshRuntime from '${url}/@react-refresh'
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>`
  }

  // ── Testing Helpers ──────────────────────────────────────────────────────

  /** @internal Set the manifest directly (for testing without file I/O). */
  setManifest(manifest: ViteManifest): void {
    this.manifestCache = manifest
  }

  /** @internal Set dev mode state directly (for testing without file I/O). */
  setDevMode(url: string | false): void {
    this.hotFileCache = url
  }

  /** Returns the resolved config (read-only). */
  getConfig(): Readonly<ViteConfig> {
    return this.config
  }
}

/** Escape HTML special characters to prevent XSS. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
