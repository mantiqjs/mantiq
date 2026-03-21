export type HealthStatus = 'ok' | 'degraded' | 'critical'

export interface CheckResult {
  name: string
  status: HealthStatus
  message?: string | undefined
  duration: number  // ms
  meta?: Record<string, any> | undefined
}

/**
 * Base class for health checks. Extend this and implement `run()`.
 *
 * @example
 * class CustomCheck extends HealthCheck {
 *   name = 'custom'
 *   async run(): Promise<void> {
 *     // throw to fail, or call this.degrade() for warnings
 *   }
 * }
 */
export abstract class HealthCheck {
  abstract readonly name: string

  private _status: HealthStatus = 'ok'
  private _message?: string | undefined
  private _meta: Record<string, any> = {}

  /** Override to perform the actual check. Throw to fail. */
  abstract run(): Promise<void>

  /** Mark this check as degraded (warning, not critical). */
  protected degrade(message: string): void {
    this._status = 'degraded'
    this._message = message
  }

  /** Attach metadata to the result (shown only in debug mode). */
  protected meta(key: string, value: any): void {
    this._meta[key] = value
  }

  /** @internal Execute the check and return a result. */
  async execute(): Promise<CheckResult> {
    this._status = 'ok'
    this._message = undefined
    this._meta = {}

    const start = performance.now()
    try {
      await this.run()
      return {
        name: this.name,
        status: this._status,
        message: this._message,
        duration: Math.round((performance.now() - start) * 100) / 100,
        meta: Object.keys(this._meta).length > 0 ? this._meta : undefined,
      }
    } catch (e: any) {
      return {
        name: this.name,
        status: 'critical',
        message: e.message ?? String(e),
        duration: Math.round((performance.now() - start) * 100) / 100,
        meta: Object.keys(this._meta).length > 0 ? this._meta : undefined,
      }
    }
  }
}
