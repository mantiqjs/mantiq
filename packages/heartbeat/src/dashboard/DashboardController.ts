import type { HeartbeatStore } from '../storage/HeartbeatStore.ts'
import type { MetricsCollector } from '../metrics/MetricsCollector.ts'
import { renderOverviewPage } from './pages/OverviewPage.ts'
import { renderRequestsPage } from './pages/RequestsPage.ts'
import { renderQueriesPage } from './pages/QueriesPage.ts'
import { renderExceptionsPage } from './pages/ExceptionsPage.ts'
import { renderJobsPage } from './pages/JobsPage.ts'
import { renderCachePage } from './pages/CachePage.ts'
import { renderEventsPage } from './pages/EventsPage.ts'
import { renderPerformancePage } from './pages/PerformancePage.ts'
import { renderRequestDetailPage } from './pages/RequestDetailPage.ts'
import { renderMailPage } from './pages/MailPage.ts'
import { renderMailDetailPage } from './pages/MailDetailPage.ts'
import { renderLogsPage } from './pages/LogsPage.ts'
import { renderModelsPage } from './pages/ModelsPage.ts'
import { renderSchedulesPage } from './pages/SchedulesPage.ts'
import { renderCommandsPage } from './pages/CommandsPage.ts'
import { renderCommandDetailPage } from './pages/CommandDetailPage.ts'
import { renderNotificationsPage } from './pages/NotificationsPage.ts'
import type { EntryType } from '../contracts/Entry.ts'

/**
 * Handles all Heartbeat dashboard routes.
 *
 * Dispatches to the correct page renderer based on the request path.
 * Also serves JSON API endpoints for real-time polling.
 */
export class DashboardController {
  constructor(
    private store: HeartbeatStore,
    private metrics: MetricsCollector,
    private basePath: string,
  ) {}

  /**
   * Handle an incoming request to the Heartbeat dashboard.
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Strip base path to get the sub-route
    let sub = path.slice(this.basePath.length)
    if (sub.startsWith('/')) sub = sub.slice(1)
    if (sub.endsWith('/')) sub = sub.slice(0, -1)

    // API endpoints
    if (sub.startsWith('api/')) {
      return this.handleApi(sub.slice(4), url.searchParams, request.method)
    }

    // Page routes
    const html = await this.renderPage(sub, url.searchParams)
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  private async renderPage(sub: string, searchParams?: URLSearchParams): Promise<string> {
    // Static page routes
    switch (sub) {
      case '':
      case 'overview':
        return renderOverviewPage(this.store, this.metrics, this.basePath)
      case 'requests':
        return renderRequestsPage(this.store, this.basePath, searchParams)
      case 'queries':
        return renderQueriesPage(this.store, this.basePath, searchParams)
      case 'exceptions':
        return renderExceptionsPage(this.store, this.basePath, searchParams)
      case 'jobs':
        return renderJobsPage(this.store, this.basePath, searchParams)
      case 'cache':
        return renderCachePage(this.store, this.basePath, searchParams)
      case 'events':
        return renderEventsPage(this.store, this.basePath, searchParams)
      case 'performance':
        return renderPerformancePage(this.store, this.metrics, this.basePath, searchParams)
      case 'mail':
        return renderMailPage(this.store, this.basePath)
      case 'logs':
        return renderLogsPage(this.store, this.basePath, searchParams)
      case 'models':
        return renderModelsPage(this.store, this.basePath, searchParams)
      case 'schedules':
        return renderSchedulesPage(this.store, this.basePath, searchParams)
      case 'commands':
        return renderCommandsPage(this.store, this.basePath, searchParams)
      case 'notifications':
        return renderNotificationsPage(this.store, this.basePath, searchParams)
    }

    // Parameterized routes
    const requestDetail = sub.match(/^requests\/([a-f0-9-]+)$/)
    if (requestDetail) {
      const html = await renderRequestDetailPage(this.store, requestDetail[1]!, this.basePath)
      return html ?? this.render404()
    }

    const mailDetail = sub.match(/^mail\/([a-f0-9-]+)$/)
    if (mailDetail) {
      const html = await renderMailDetailPage(this.store, mailDetail[1]!, this.basePath)
      return html ?? this.render404()
    }

    const commandDetail = sub.match(/^commands\/([a-f0-9-]+)$/)
    if (commandDetail) {
      const html = await renderCommandDetailPage(this.store, commandDetail[1]!, this.basePath)
      return html ?? this.render404()
    }

    return this.render404()
  }

  // ── API Endpoints ─────────────────────────────────────────────────────

  private async handleApi(sub: string, params: URLSearchParams, method: string): Promise<Response> {
    try {
      switch (sub) {
        case 'entries':
          return this.apiEntries(params)
        case 'metrics':
          return this.apiMetrics()
        case 'exception-groups':
          return this.apiExceptionGroups()
        case 'exception-groups/resolve':
          if (method === 'POST') return this.apiResolveExceptionGroup(params)
          return Response.json({ error: 'Method not allowed' }, { status: 405 })
        case 'exception-groups/unresolve':
          if (method === 'POST') return this.apiUnresolveExceptionGroup(params)
          return Response.json({ error: 'Method not allowed' }, { status: 405 })
        default: {
          // Handle parameterized API routes: exceptions/{fingerprint}/resolve|unresolve
          const exceptionAction = sub.match(/^exceptions\/([^/]+)\/(resolve|unresolve)$/)
          if (exceptionAction) {
            const fingerprint = decodeURIComponent(exceptionAction[1]!)
            const action = exceptionAction[2]!
            if (action === 'resolve') {
              await this.store.resolveExceptionGroup(fingerprint)
            } else {
              await this.store.unresolveExceptionGroup(fingerprint)
            }
            // Redirect back to exceptions page
            return new Response(null, {
              status: 302,
              headers: { Location: `${this.basePath}/exceptions` },
            })
          }
          return Response.json({ error: 'Not found' }, { status: 404 })
        }
      }
    } catch (error) {
      return Response.json({ error: 'Internal error' }, { status: 500 })
    }
  }

  private async apiEntries(params: URLSearchParams): Promise<Response> {
    const type = params.get('type') as EntryType | null
    const limit = Math.min(parseInt(params.get('limit') ?? '50', 10), 200)
    const offset = parseInt(params.get('offset') ?? '0', 10)

    const entries = await this.store.getEntries({
      type: type ?? undefined,
      limit,
      offset,
    })

    const parsed = entries.map((e) => ({
      ...e,
      content: JSON.parse(e.content),
      tags: JSON.parse(e.tags),
    }))

    return Response.json({ data: parsed, count: parsed.length })
  }

  private apiMetrics(): Response {
    const data = {
      http: {
        total: this.metrics.getCounter('http.requests.total'),
        errors: this.metrics.getCounter('http.errors.total'),
        p50: this.metrics.percentile('http.requests.duration', 50),
        p95: this.metrics.percentile('http.requests.duration', 95),
        p99: this.metrics.percentile('http.requests.duration', 99),
      },
      queue: {
        processed: this.metrics.getCounter('queue.jobs.processed'),
        failed: this.metrics.getCounter('queue.jobs.failed'),
      },
      system: {
        rss: this.metrics.getGauge('system.memory.rss'),
        heap_used: this.metrics.getGauge('system.memory.heap_used'),
      },
      cache: {
        hits: this.metrics.getCounter('cache.hits'),
        misses: this.metrics.getCounter('cache.misses'),
      },
    }

    return Response.json({ data })
  }

  private async apiExceptionGroups(): Promise<Response> {
    const groups = await this.store.getExceptionGroups()
    return Response.json({ data: groups })
  }

  private async apiResolveExceptionGroup(params: URLSearchParams): Promise<Response> {
    const fingerprint = params.get('fingerprint')
    if (!fingerprint) return Response.json({ error: 'Missing fingerprint' }, { status: 400 })
    await this.store.resolveExceptionGroup(fingerprint)
    return Response.json({ success: true })
  }

  private async apiUnresolveExceptionGroup(params: URLSearchParams): Promise<Response> {
    const fingerprint = params.get('fingerprint')
    if (!fingerprint) return Response.json({ error: 'Missing fingerprint' }, { status: 400 })
    await this.store.unresolveExceptionGroup(fingerprint)
    return Response.json({ success: true })
  }

  private render404(): string {
    return `<!DOCTYPE html><html><body><h1>404 — Page not found</h1><p><a href="${this.basePath}">Back to Heartbeat</a></p></body></html>`
  }
}
