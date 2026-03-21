import { HealthCheck } from '../HealthCheck.ts'

/**
 * Verifies required environment variables are set.
 *
 * @example
 * health.register(new EnvironmentCheck(['APP_KEY', 'DB_DATABASE']))
 */
export class EnvironmentCheck extends HealthCheck {
  readonly name = 'environment'

  constructor(private requiredVars: string[] = ['APP_KEY']) {
    super()
  }

  override async run(): Promise<void> {
    const missing: string[] = []
    const present: string[] = []

    for (const key of this.requiredVars) {
      if (process.env[key]) {
        present.push(key)
      } else {
        missing.push(key)
      }
    }

    this.meta('checked', this.requiredVars.length)
    this.meta('present', present.length)

    if (missing.length > 0) {
      this.meta('missing', missing)
      throw new Error(`Missing environment variables: ${missing.join(', ')}`)
    }
  }
}
