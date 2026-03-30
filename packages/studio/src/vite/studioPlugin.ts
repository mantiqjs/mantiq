import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import type { Plugin } from 'vite'

/**
 * Vite plugin for Mantiq Studio.
 *
 * Integrates Studio's React frontend into the user's Vite dev server
 * and production build. Zero separate build step — just add the plugin
 * to vite.config.ts and Studio's UI hot-reloads alongside the app.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { studioPlugin } from '@mantiq/studio/vite'
 *
 * export default defineConfig({
 *   plugins: [react(), studioPlugin({ path: '/admin' })],
 * })
 * ```
 *
 * What it does:
 * - Resolves `@mantiq/studio/frontend` imports to the package's source
 *   (or the user's published `studio/` directory)
 * - Adds Studio's `main.tsx` as an entry point for the build
 * - Configures path aliases (@/ → studio/src or package/frontend/src)
 * - In dev: Vite serves Studio's React app with HMR
 * - In prod: Studio assets are included in the main build output
 */
export function studioPlugin(options: StudioPluginOptions = {}): Plugin {
  const panelPath = options.path ?? '/admin'

  // Resolve the Studio frontend source directory
  // Priority: published studio/ > package frontend/
  const publishedDir = resolve(process.cwd(), 'studio', 'src')
  const packageDir = resolve(dirname(import.meta.dir), 'frontend', 'src')
  const studioSrcDir = existsSync(publishedDir) ? publishedDir : packageDir

  const studioEntryId = 'virtual:studio-entry'
  const resolvedStudioEntryId = '\0' + studioEntryId

  return {
    name: 'mantiq-studio',
    enforce: 'pre',

    config(config) {
      // Add Studio path aliases
      const existingAliases = (config.resolve?.alias as Record<string, string>) ?? {}

      return {
        resolve: {
          alias: {
            ...existingAliases,
            // Studio components use @/ imports — resolve to Studio's src dir
            // We namespace it to avoid conflicts with the user's own @/ alias
            '@studio': studioSrcDir,
          },
        },
        // Include Studio's entry in the build
        build: {
          rollupOptions: {
            input: {
              ...((config.build?.rollupOptions?.input as Record<string, string>) ?? {}),
              studio: resolve(studioSrcDir, 'main.tsx'),
            },
          },
        },
      }
    },

    resolveId(id) {
      if (id === studioEntryId) return resolvedStudioEntryId
      // Resolve @mantiq/studio/frontend imports to the actual source
      if (id.startsWith('@mantiq/studio/frontend/src/')) {
        const relativePath = id.replace('@mantiq/studio/frontend/src/', '')
        return resolve(studioSrcDir, relativePath)
      }
      return null
    },

    load(id) {
      if (id === resolvedStudioEntryId) {
        // Virtual entry that bootstraps Studio
        return `
          import '${resolve(studioSrcDir, 'main.tsx')}'
        `
      }
      return null
    },

    // Transform Studio's @/ imports to @studio/ to avoid conflicts
    // with the user's own @/ alias
    transform(code, id) {
      if (!id.startsWith(studioSrcDir)) return null
      // Rewrite @/ → @studio/ only in Studio's own files
      if (code.includes("from '@/")) {
        return code.replace(/from '@\//g, "from '@studio/")
      }
      return null
    },

    configureServer(server) {
      // In dev: serve Studio's HTML shell for panel routes
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''

        // Only intercept panel routes (not API, not assets)
        if (!url.startsWith(panelPath) || url.includes('/api/') || url.includes('.')) {
          return next()
        }

        // Serve HTML shell that loads Studio via Vite
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="studio-base-path" content="${panelPath}">
  <title>Studio</title>
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
  <script type="module" src="/@id/__x00__${studioEntryId}"></script>
</body>
</html>`

        // Let Vite transform the HTML (injects HMR client, React refresh, etc.)
        server.transformIndexHtml(url, html).then((transformed) => {
          res.setHeader('Content-Type', 'text/html')
          res.end(transformed)
        }).catch(next)
      })
    },
  }
}

export interface StudioPluginOptions {
  /** Panel URL path prefix (default: '/admin') */
  path?: string
}
