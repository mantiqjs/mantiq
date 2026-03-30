import type { Plugin } from 'vite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Mantiq Vite plugin — auto-discovers and registers plugins from
 * installed @mantiq/* packages.
 *
 * Packages declare their Vite plugin via `"mantiq.vitePlugin"` in
 * package.json. The plugin is dynamically imported and registered.
 *
 * Currently supports:
 * - @mantiq/studio → studioPlugin({ path }) for admin panel hot reload
 *
 * @example
 * ```ts
 * // vite.config.ts — user only adds mantiq()
 * import { mantiq } from '@mantiq/vite'
 *
 * export default defineConfig({
 *   plugins: [react(), tailwindcss(), mantiq()],
 * })
 * ```
 */
export async function mantiq(): Promise<Plugin[]> {
  const plugins: Plugin[] = []
  const cwd = process.cwd()

  // ── Auto-discover Studio ────────────────────────────────────────────────

  try {
    // Check if @mantiq/studio is installed
    const studioPkg = resolve(cwd, 'node_modules', '@mantiq', 'studio', 'package.json')
    if (existsSync(studioPkg)) {
      // Check if Studio is configured (app/Studio/ directory exists)
      const studioDir = resolve(cwd, 'app', 'Studio')
      if (existsSync(studioDir)) {
        // Discover panel path from the first panel file
        const panelPath = await discoverPanelPath(studioDir)

        // @ts-ignore — @mantiq/studio may not be installed
        const { studioPlugin } = await import('@mantiq/studio/vite') as any
        const plugin = studioPlugin({ path: panelPath })
        plugins.push(plugin)
      }
    }
  } catch {
    // Studio not installed or not configured — skip silently
  }

  // ── Future: auto-discover other @mantiq/* Vite plugins ──────────────────
  // When more packages need Vite integration, scan node_modules/@mantiq/*/package.json
  // for "mantiq.vitePlugin" field and dynamically import each.

  return plugins
}

/**
 * Read the first StudioPanel class found in app/Studio/ to extract
 * the panel path (e.g., '/admin'). Falls back to '/admin'.
 */
async function discoverPanelPath(studioDir: string): Promise<string> {
  try {
    const { Glob } = await import('bun')
    const glob = new Glob('**/*Panel.ts')

    for await (const file of glob.scan(studioDir)) {
      const content = await Bun.file(resolve(studioDir, file)).text()
      // Look for: path = '/admin' or path = "/admin"
      const match = content.match(/path\s*=\s*['"]([^'"]+)['"]/)
      if (match) return match[1]!
    }
  } catch {
    // Glob not available or no panel files
  }

  return '/admin'
}
