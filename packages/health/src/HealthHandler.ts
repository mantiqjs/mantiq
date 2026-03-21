import type { HealthManager, HealthReport } from './HealthManager.ts'

/**
 * HTTP request handler for /health endpoint.
 *
 * - Debug mode: full report with all check details, durations, and metadata
 * - Production: minimal response — just status and timestamp
 *
 * Returns 200 for ok/degraded, 503 for critical.
 */
export function healthHandler(manager: HealthManager, debug = false) {
  return async (_request: Request): Promise<Response> => {
    const report = await manager.check()
    const status = report.status === 'critical' ? 503 : 200

    if (debug) {
      return new Response(JSON.stringify(report, null, 2), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Production: strip meta and detailed messages
    const minimal: Record<string, any> = {
      status: report.status,
      timestamp: report.timestamp,
    }

    // Only include check names + status (no messages, no meta)
    if (report.status !== 'ok') {
      minimal.checks = report.checks
        .filter((c) => c.status !== 'ok')
        .map((c) => ({ name: c.name, status: c.status }))
    }

    return new Response(JSON.stringify(minimal), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Returns the health status as a compact string for Heartbeat headers.
 * Format: "ok" | "degraded:database,memory" | "critical:database"
 */
export async function healthHeaderValue(manager: HealthManager): Promise<string> {
  const report = manager.lastReport ?? await manager.check()
  if (report.status === 'ok') return 'ok'

  const failing = report.checks
    .filter((c) => c.status !== 'ok')
    .map((c) => c.name)

  return `${report.status}:${failing.join(',')}`
}
