import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import { join } from 'node:path'

/**
 * Middleware that serves pre-built or published Studio frontend assets.
 *
 * For API requests (paths containing `/api/`), the request passes through.
 * For all other paths under the panel prefix, the SPA's index.html is served,
 * enabling client-side routing.
 */
export class StudioServeAssets implements Middleware {
  private panelPath: string
  private assetsDir: string

  constructor(panelPath: string, assetsDir: string | undefined = undefined) {
    this.panelPath = panelPath
    // Default to the bundled frontend dist directory
    this.assetsDir = assetsDir ?? join(import.meta.dir, '../../frontend/dist')
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const path = request.path()

    // Let API requests pass through to the controllers
    if (path.includes('/api/')) {
      return next()
    }

    // Only handle requests under this panel's path
    if (!path.startsWith(this.panelPath)) {
      return next()
    }

    // Try to serve static assets (JS, CSS, images, etc.)
    const relativePath = path.substring(this.panelPath.length) || '/index.html'
    const assetPath = join(this.assetsDir, relativePath)

    try {
      const file = Bun.file(assetPath)
      if (await file.exists()) {
        return new Response(file)
      }
    } catch {
      // File doesn't exist, fall through to SPA catch-all
    }

    // SPA catch-all: serve index.html for client-side routing
    try {
      const indexPath = join(this.assetsDir, 'index.html')
      const indexFile = Bun.file(indexPath)
      if (await indexFile.exists()) {
        return new Response(indexFile, {
          headers: { 'Content-Type': 'text/html' },
        })
      }
    } catch {
      // Frontend not built/published
    }

    return next()
  }
}
