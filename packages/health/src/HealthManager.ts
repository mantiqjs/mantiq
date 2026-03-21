import type { HealthCheck, CheckResult, HealthStatus } from './HealthCheck.ts'

export interface HealthReport {
  status: HealthStatus
  timestamp: string
  duration: number  // total ms
  checks: CheckResult[]
}

export class HealthManager {
  private checks: HealthCheck[] = []
  private _lastReport: HealthReport | null = null

  /** Register a health check. */
  register(check: HealthCheck): this {
    this.checks.push(check)
    return this
  }

  /** Register multiple checks at once. */
  registerMany(checks: HealthCheck[]): this {
    for (const check of checks) this.register(check)
    return this
  }

  /** Run all checks and return a full report. */
  async check(): Promise<HealthReport> {
    const start = performance.now()
    const results = await Promise.all(this.checks.map((c) => c.execute()))

    let overall: HealthStatus = 'ok'
    for (const r of results) {
      if (r.status === 'critical') { overall = 'critical'; break }
      if (r.status === 'degraded') overall = 'degraded'
    }

    this._lastReport = {
      status: overall,
      timestamp: new Date().toISOString(),
      duration: Math.round((performance.now() - start) * 100) / 100,
      checks: results,
    }

    return this._lastReport
  }

  /** Returns the last cached report (without re-running checks). */
  get lastReport(): HealthReport | null {
    return this._lastReport
  }

  /** Quick status check — returns 'ok', 'degraded', or 'critical'. */
  async status(): Promise<HealthStatus> {
    const report = await this.check()
    return report.status
  }

  /** Returns registered check names. */
  getCheckNames(): string[] {
    return this.checks.map((c) => c.name)
  }
}
