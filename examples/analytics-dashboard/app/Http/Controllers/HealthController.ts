import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Metric } from '../../Models/Metric.ts'

export class HealthController {
  /** GET /api/health/status — comprehensive health check */
  async status(_request: MantiqRequest): Promise<Response> {
    const checks: Record<string, { status: string; details?: any }> = {}

    // Database connectivity
    try {
      await Metric.query().limit(1).get()
      checks.database = { status: 'healthy' }
    } catch (err: any) {
      checks.database = { status: 'unhealthy', details: err?.message ?? 'Connection failed' }
    }

    // Memory usage
    const mem = process.memoryUsage()
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100
    const rssMB = Math.round(mem.rss / 1024 / 1024 * 100) / 100
    const heapPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100)
    checks.memory = {
      status: heapPercent < 90 ? 'healthy' : 'warning',
      details: {
        heap_used_mb: heapUsedMB,
        heap_total_mb: heapTotalMB,
        rss_mb: rssMB,
        heap_usage_percent: heapPercent,
      },
    }

    // Uptime
    const uptimeSeconds = Math.floor(process.uptime())
    const uptimeHours = Math.floor(uptimeSeconds / 3600)
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60)
    checks.uptime = {
      status: 'healthy',
      details: {
        seconds: uptimeSeconds,
        human: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds % 60}s`,
      },
    }

    // Disk space (best effort — may not be available in all environments)
    try {
      const { statfs } = await import('node:fs/promises')
      const stats = await statfs('/')
      const totalGB = Math.round((stats.blocks * stats.bsize) / (1024 ** 3) * 100) / 100
      const freeGB = Math.round((stats.bfree * stats.bsize) / (1024 ** 3) * 100) / 100
      const usedPercent = Math.round(((stats.blocks - stats.bfree) / stats.blocks) * 100)
      checks.disk = {
        status: usedPercent < 90 ? 'healthy' : 'warning',
        details: { total_gb: totalGB, free_gb: freeGB, used_percent: usedPercent },
      }
    } catch {
      checks.disk = { status: 'unknown', details: 'Unable to read disk stats' }
    }

    // Overall status
    const allStatuses = Object.values(checks).map((c) => c.status)
    const overallStatus = allStatuses.includes('unhealthy')
      ? 'unhealthy'
      : allStatuses.includes('warning')
        ? 'degraded'
        : 'healthy'

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200

    return MantiqResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    }, statusCode)
  }

  /** GET /api/health/readiness — is the app ready to serve traffic */
  async readiness(_request: MantiqRequest): Promise<Response> {
    try {
      // Verify database is accessible
      await Metric.query().limit(1).get()

      return MantiqResponse.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      })
    } catch {
      return MantiqResponse.json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'Database is not accessible.',
      }, 503)
    }
  }

  /** GET /api/health/liveness — is the app alive */
  async liveness(_request: MantiqRequest): Promise<Response> {
    return MantiqResponse.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
    })
  }
}
