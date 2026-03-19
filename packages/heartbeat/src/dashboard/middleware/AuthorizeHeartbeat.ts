/**
 * Middleware that gates access to the Heartbeat dashboard.
 *
 * By default: allows all access in development, blocks in production.
 * Can be customized via the dashboard.middleware config.
 */
export function authorizeHeartbeat(environment: string) {
  return async (request: Request, next: (req: Request) => Promise<Response>): Promise<Response> => {
    // Allow in development
    if (environment === 'development' || environment === 'local' || environment === 'testing') {
      return next(request)
    }

    // In production, return 403 by default.
    // Apps should override this middleware for custom auth logic.
    return new Response('Forbidden — Heartbeat dashboard is disabled in production. Configure dashboard.middleware to enable.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
