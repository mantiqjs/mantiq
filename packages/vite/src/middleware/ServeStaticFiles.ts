import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import { Vite } from '../Vite.ts'

/**
 * Serves static files from the public directory.
 * Resolves the public dir from the Vite config automatically.
 * Useful during development — in production, use a reverse proxy (nginx/CDN).
 *
 * @example
 * ```ts
 * kernel.registerMiddleware('static', ServeStaticFiles)
 * kernel.setGlobalMiddleware(['static', 'log', 'cors'])
 * ```
 */
export class ServeStaticFiles implements Middleware {
  private publicDir: string | null = null

  constructor(private vite?: Vite) {}

  setParameters(params: string[]): void {
    if (params[0]) this.publicDir = params[0]
  }

  private getPublicDir(): string {
    if (this.publicDir) return this.publicDir
    if (this.vite) {
      const publicDir = this.vite.getConfig().publicDir
      const basePath = this.vite.getBasePath()
      if (basePath && !publicDir.startsWith('/')) {
        return `${basePath}/${publicDir}`
      }
      return publicDir
    }
    return 'public'
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    // Only serve static files for GET/HEAD requests
    const method = request.method()
    if (method !== 'GET' && method !== 'HEAD') {
      return next()
    }

    const urlPath = request.path()

    // Prevent directory traversal
    if (urlPath.includes('..') || urlPath.includes('\0')) {
      return next()
    }

    // Skip the hot file — it's internal
    if (urlPath === '/hot') {
      return next()
    }

    const filePath = `${this.getPublicDir()}${urlPath}`
    const file = Bun.file(filePath)

    if (await file.exists()) {
      // Skip directories (files without extensions that are size 0)
      if (file.size === 0 && !urlPath.includes('.')) {
        return next()
      }

      return new Response(file, {
        headers: {
          'Content-Type': file.type,
          'Content-Length': String(file.size),
          'Cache-Control': 'no-cache',
        },
      })
    }

    return next()
  }
}
