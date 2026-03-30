import { ServiceProvider } from '@mantiq/core'
import type { Container, Router } from '@mantiq/core'
import { PanelManager } from './panel/PanelManager.ts'
import { PanelDiscovery } from './panel/PanelDiscovery.ts'
import { StudioController } from './http/StudioController.ts'
import { StudioServeAssets } from './middleware/StudioServeAssets.ts'
import { CheckPanelAccess } from './middleware/CheckPanelAccess.ts'
import type { StudioPanel } from './StudioPanel.ts'
import { join } from 'node:path'

/**
 * Service provider that registers the Studio admin panel system.
 *
 * - Registers PanelManager as a singleton
 * - Auto-discovers panels from app/Studio/
 * - Registers API routes for each panel
 * - Registers SPA catch-all for serving the frontend
 */
export class StudioServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(PanelManager, () => new PanelManager())
  }

  override async boot(): Promise<void> {
    const panelManager = this.app.make(PanelManager)

    // Auto-discover panels from app/Studio/
    const studioDir = join(process.cwd(), 'app', 'Studio')
    let panels: StudioPanel[] = []

    try {
      panels = await PanelDiscovery.scan(studioDir)
    } catch {
      // No Studio directory — skip. Studio isn't configured.
      return
    }

    if (panels.length === 0) return

    for (const panel of panels) {
      panel.boot(this.app)
      panelManager.register(panel)
      this.registerPanelRoutes(this.app, panel)
    }
  }

  private registerPanelRoutes(container: Container, panel: StudioPanel): void {
    let router: Router
    try {
      router = container.make<Router>('Router' as any)
    } catch {
      return // Router not available
    }

    const panelManager = container.make(PanelManager)
    const controller = new StudioController(panelManager)
    const prefix = panel.path

    // API routes — protected by auth + panel access check
    const apiMiddleware = [
      ...panel.middleware(),
    ]

    router.group({ prefix: `${prefix}/api`, middleware: apiMiddleware }, (r: Router) => {
      // Panel config
      r.get('/panel', (req) => controller.panel(req))

      // Global search
      r.get('/search', (req) => controller.globalSearch(req))

      // Resource CRUD
      r.get('/resources/:resource/schema', (req) => controller.schema(req))
      r.get('/resources/:resource/relation/:name', (req) => controller.relation(req))
      r.get('/resources/:resource/:id', (req) => controller.show(req))
      r.put('/resources/:resource/:id', (req) => controller.update(req))
      r.delete('/resources/:resource/:id', (req) => controller.destroy(req))
      r.get('/resources/:resource', (req) => controller.index(req))
      r.post('/resources/:resource', (req) => controller.store(req))

      // Actions
      r.post('/resources/:resource/actions/:action', (req) => controller.action(req))
      r.post('/resources/:resource/bulk-actions/:action', (req) => controller.bulkAction(req))
    })

    // SPA catch-all — serves the React frontend for all non-API panel routes
    // In dev: Vite plugin handles this via configureServer middleware
    // In prod: serves from frontend/dist/ or published studio/dist/
    const assetsMiddleware = new StudioServeAssets(prefix)
    router.get(`${prefix}/{path:.*}`, (req) => assetsMiddleware.handle(req, () => {
      return new Response('Studio frontend not found. Run: bun mantiq studio:install', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    }))

    // Panel root redirect
    if (prefix) {
      router.get(prefix, (req) => assetsMiddleware.handle(req, () => {
        return new Response(null, {
          status: 302,
          headers: { Location: `${prefix}/` },
        })
      }))
    }
  }
}
