import { HealthCheck } from '../HealthCheck.ts'

/**
 * Verifies the auth system is configured — guards and providers exist.
 */
export class AuthCheck extends HealthCheck {
  readonly name = 'auth'

  constructor(private auth: any) {
    super()
  }

  override async run(): Promise<void> {
    if (!this.auth) throw new Error('Auth instance is null')

    const defaultGuard = this.auth.getDefaultGuard?.() ?? this.auth.defaultGuard ?? 'unknown'
    this.meta('guard', typeof defaultGuard === 'string' ? defaultGuard : 'unknown')

    try {
      const guard = this.auth.guard?.() ?? this.auth.guard?.(defaultGuard)
      if (!guard) {
        throw new Error(`Default guard "${defaultGuard}" could not be resolved`)
      }
      this.meta('provider', guard.getProvider?.()?.constructor?.name ?? 'unknown')
    } catch (e: any) {
      throw new Error(`Auth not configured: ${e.message}`)
    }
  }
}
