import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Serves Studio's React frontend.
 *
 * **Dev mode** (Vite dev server running):
 *   Renders an HTML shell that loads Studio's React app from the Vite
 *   dev server. The user's existing `bun run dev` (which starts Vite)
 *   handles hot reload — no separate build step needed.
 *
 * **Production mode**:
 *   Serves pre-built assets from the package's frontend/dist/ directory,
 *   or from a published studio/ directory in the user's project.
 *
 * For API requests (paths containing `/api/`), the request passes through
 * to the controllers.
 */
export class StudioServeAssets implements Middleware {
  private panelPath: string
  private devServerUrl: string | null = null
  private prodAssetsDir: string

  constructor(panelPath: string, options?: { devServerUrl?: string; assetsDir?: string }) {
    this.panelPath = panelPath

    // Check for Vite dev server (hot file)
    this.detectDevServer(options?.devServerUrl)

    // Production assets: check published studio/dist first, then package's frontend/dist
    const publishedDir = resolve(process.cwd(), 'studio', 'dist')
    const packageDir = resolve(import.meta.dir, '../../frontend/dist')
    this.prodAssetsDir = options?.assetsDir
      ?? (existsSync(publishedDir) ? publishedDir : packageDir)
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const path = request.path()

    // Let API requests pass through to controllers
    if (path.includes('/api/')) return next()

    // Only handle requests under this panel's path
    if (this.panelPath && !path.startsWith(this.panelPath)) return next()

    // Dev mode → serve HTML shell pointing to Vite dev server
    if (this.devServerUrl) {
      return this.devResponse(request)
    }

    // Production mode → serve static files + SPA fallback
    return this.prodResponse(request, next)
  }

  // ── Dev Mode ───────────────────────────────────────────────────────────

  private detectDevServer(configUrl?: string): void {
    // Check for hot file (written by Vite when dev server starts)
    const hotFilePath = resolve(process.cwd(), 'hot')
    try {
      if (existsSync(hotFilePath)) {
        const content = Bun.file(hotFilePath)
        // Read synchronously for constructor
        const url = require('fs').readFileSync(hotFilePath, 'utf-8').trim()
        this.devServerUrl = url || configUrl || 'http://localhost:5173'
        return
      }
    } catch { /* no hot file */ }

    if (configUrl) {
      this.devServerUrl = configUrl
    }
  }

  /**
   * Dev mode: return an HTML shell that loads Studio's frontend from
   * the Vite dev server. This gives us:
   * - Hot module replacement (HMR)
   * - No separate build step
   * - Same DX as the user's own frontend
   */
  private devResponse(_request: MantiqRequest): Response {
    const viteUrl = this.devServerUrl!
    const studioEntry = this.resolveStudioEntry()

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="studio-base-path" content="${this.panelPath}">
  <title>Studio</title>
  <script type="module" src="${viteUrl}/@vite/client"></script>
  <script type="module">
    import RefreshRuntime from '${viteUrl}/@react-refresh'
    RefreshRuntime.injectIntoGlobalHook(window)
    window.$RefreshReg$ = () => {}
    window.$RefreshSig$ = () => (type) => type
    window.__vite_plugin_react_preamble_installed__ = true
  </script>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      var t = localStorage.getItem('mantiq-studio-theme');
      var dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (dark) document.documentElement.classList.add('dark');
    })();
  </script>
  <script type="module" src="${viteUrl}/${studioEntry}"></script>
</body>
</html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  /**
   * Resolve the Studio frontend entry point.
   * Checks (in order):
   * 1. Published: studio/src/main.tsx (user customized)
   * 2. Package: @mantiq/studio/frontend/src/main.tsx
   */
  private resolveStudioEntry(): string {
    const publishedEntry = resolve(process.cwd(), 'studio', 'src', 'main.tsx')
    if (existsSync(publishedEntry)) return 'studio/src/main.tsx'
    // Package entry — Vite needs to resolve this via an alias
    return '@mantiq/studio/frontend/src/main.tsx'
  }

  // ── Production Mode ────────────────────────────────────────────────────

  private async prodResponse(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const path = request.path()
    const relativePath = this.panelPath
      ? path.substring(this.panelPath.length) || '/index.html'
      : path === '/' ? '/index.html' : path

    // Try to serve static assets (JS, CSS, images, etc.)
    const assetPath = join(this.prodAssetsDir, relativePath)
    try {
      const file = Bun.file(assetPath)
      if (await file.exists()) {
        return new Response(file)
      }
    } catch { /* not found */ }

    // SPA catch-all: serve index.html with asset paths rewritten to panel prefix
    try {
      const indexFile = Bun.file(join(this.prodAssetsDir, 'index.html'))
      if (await indexFile.exists()) {
        let html = await indexFile.text()
        // Rewrite absolute asset paths to be relative to the panel path
        // e.g. /assets/index.js → /admin/assets/index.js
        if (this.panelPath) {
          html = html.replace(/(?:src|href)="\/assets\//g, (match) =>
            match.replace('/assets/', `${this.panelPath}/assets/`),
          )
        }
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
    } catch { /* frontend not built */ }

    return next()
  }
}
