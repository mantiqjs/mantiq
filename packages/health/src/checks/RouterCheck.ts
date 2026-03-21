import { HealthCheck } from '../HealthCheck.ts'

/**
 * Verifies the router has routes registered and key endpoints exist.
 */
export class RouterCheck extends HealthCheck {
  readonly name = 'router'

  constructor(
    private router: any,
    private expectedRoutes: string[] = [],
  ) {
    super()
  }

  override async run(): Promise<void> {
    if (!this.router) throw new Error('Router instance is null')

    const routes = this.router.getRoutes?.() ?? this.router.routes ?? []
    const routeCount = Array.isArray(routes) ? routes.length : Object.keys(routes).length
    this.meta('routes', routeCount)

    if (routeCount === 0) {
      throw new Error('No routes registered')
    }

    // Verify expected routes exist
    if (this.expectedRoutes.length > 0) {
      const registeredPaths = Array.isArray(routes)
        ? routes.map((r: any) => r.path ?? r.uri ?? '')
        : Object.keys(routes)

      const missing = this.expectedRoutes.filter((p) => !registeredPaths.some((rp: string) => rp === p || rp.includes(p)))

      if (missing.length > 0) {
        this.meta('missing', missing)
        this.degrade(`Missing expected routes: ${missing.join(', ')}`)
      }
    }
  }
}
