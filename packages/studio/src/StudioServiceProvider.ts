import { ServiceProvider } from '@mantiq/core'
import type { Container, Router } from '@mantiq/core'
import { PanelManager } from './panel/PanelManager.ts'
import { PanelDiscovery } from './panel/PanelDiscovery.ts'
import { StudioController } from './http/StudioController.ts'
import { join } from 'node:path'

/**
 * Service provider that registers the Studio admin panel system.
 *
 * - Registers PanelManager as a singleton
 * - Auto-discovers panels from app/Studio/
 * - Registers routes for each panel
 */
export class StudioServiceProvider extends ServiceProvider {
  override register(): void {
    // Bind PanelManager as a singleton
    this.app.singleton(PanelManager, () => new PanelManager())
  }

  override async boot(): Promise<void> {
    const panelManager = this.app.make(PanelManager)

    // Auto-discover panels from app/Studio/
    const studioDir = join(process.cwd(), 'app', 'Studio')
    const panels = await PanelDiscovery.scan(studioDir)

    for (const panel of panels) {
      // Boot the panel
      panel.boot(this.app)

      // Register the panel
      panelManager.register(panel)

      // Register routes for this panel
      this.registerPanelRoutes(this.app, panel)
    }
  }

  private registerPanelRoutes(container: Container, panel: { path: string }): void {
    let router: Router
    try {
      router = container.make<Router>('Router' as any)
    } catch {
      // Router not available — skip route registration
      return
    }

    const panelManager = container.make(PanelManager)
    const controller = new StudioController(panelManager)
    const prefix = panel.path

    router.group({ prefix: `${prefix}/api` }, (r: Router) => {
      // Panel schema
      r.get('/panel', (req) => controller.panel(req))

      // Global search
      r.get('/search', (req) => controller.globalSearch(req))

      // Resource CRUD
      r.get('/resources/:resource', (req) => controller.index(req))
      r.post('/resources/:resource', (req) => controller.store(req))
      r.get('/resources/:resource/schema', (req) => controller.schema(req))
      r.get('/resources/:resource/relation/:name', (req) => controller.relation(req))
      r.get('/resources/:resource/:id', (req) => controller.show(req))
      r.put('/resources/:resource/:id', (req) => controller.update(req))
      r.delete('/resources/:resource/:id', (req) => controller.destroy(req))

      // Actions
      r.post('/resources/:resource/actions/:action', (req) => controller.action(req))
      r.post('/resources/:resource/bulk-actions/:action', (req) => controller.bulkAction(req))
    })
  }
}
