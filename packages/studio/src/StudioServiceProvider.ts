import { ServiceProvider, RouterImpl } from '@mantiq/core'
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
 * Route structure for a panel at /admin:
 *
 *   /admin/api/*          → API (web middleware group + auth + panel access)
 *   /admin, /admin/*      → SPA (no middleware — assets are public, auth via API)
 */
export class StudioServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(PanelManager, () => new PanelManager())
  }

  override async boot(): Promise<void> {
    const panelManager = this.app.make(PanelManager)

    const studioDir = join(process.cwd(), 'app', 'Studio')
    const panels = await PanelDiscovery.scan(studioDir)

    if (panels.length === 0) return

    // Guard against double-boot (package discovery + app/Providers wrapper)
    if (panelManager.all().length > 0) return

    let kernel: any = null
    try {
      const { HttpKernel } = await import('@mantiq/core')
      kernel = this.app.make(HttpKernel)
    } catch { /* CLI context */ }

    for (const panel of panels) {
      panel.boot(this.app)
      panelManager.register(panel)

      if (kernel?.registerMiddleware) {
        const access = new CheckPanelAccess(panel)
        const alias = `studio.access.${panel.id}`
        const WrappedMiddleware = class {
          async handle(req: any, next: any) { return access.handle(req, next) }
        }
        kernel.registerMiddleware(alias, WrappedMiddleware as any)
      }

      this.registerPanelRoutes(this.app, panel)
    }
  }

  private registerPanelRoutes(container: Container, panel: StudioPanel): void {
    let router: Router
    try {
      router = container.make(RouterImpl)
    } catch {
      return
    }

    const panelManager = container.make(PanelManager)
    const controller = new StudioController(panelManager)
    const prefix = panel.path
    const guard = panel.guard()
    const accessAlias = `studio.access.${panel.id}`

    // ── API routes — full middleware stack ──────────────────────────────
    // 'web' group provides session/CSRF, auth guard authenticates,
    // panel access checks authorization
    const apiMiddleware = [
      'web',
      `auth:${guard}`,
      accessAlias,
      ...panel.middleware(),
    ]

    router.group({ prefix: `${prefix}/api`, middleware: apiMiddleware }, (r: Router) => {
      r.get('/panel', (req) => controller.panel(req))
      r.get('/search', (req) => controller.globalSearch(req))
      r.get('/resources/:resource/schema', (req) => controller.schema(req))
      r.get('/resources/:resource/relation/:name', (req) => controller.relation(req))
      r.get('/resources/:resource/:id', (req) => controller.show(req))
      r.put('/resources/:resource/:id', (req) => controller.update(req))
      r.delete('/resources/:resource/:id', (req) => controller.destroy(req))
      r.get('/resources/:resource', (req) => controller.index(req))
      r.post('/resources/:resource', (req) => controller.store(req))
      r.post('/resources/:resource/actions/:action', (req) => controller.action(req))
      r.post('/resources/:resource/bulk-actions/:action', (req) => controller.bulkAction(req))
    })

    // ── SPA + assets — no middleware ───────────────────────────────────
    // Serves index.html (with rewritten asset paths) and static assets.
    // No auth here — the SPA is public. Auth is enforced by the API
    // endpoints; the frontend redirects to login on 401.
    const assetsMiddleware = new StudioServeAssets(prefix)
    const spaFallback = async () => new Response(
      'Studio frontend not found. Run: bun mantiq studio:install',
      { status: 404, headers: { 'Content-Type': 'text/plain' } },
    )

    router.get(`${prefix}/*`, (req) =>
      assetsMiddleware.handle(req, spaFallback),
    )

    if (prefix) {
      router.get(prefix, (req) =>
        assetsMiddleware.handle(req, spaFallback),
      )
    }
  }
}
