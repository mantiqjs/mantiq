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
      return this.handleApi(sub.slice(4), url.searchParams)
    }

    // Page routes
    const html = await this.renderPage(sub)
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  private async renderPage(sub: string): Promise<string> {
    // Static page routes
    switch (sub) {
      case '':
      case 'overview':
        return renderOverviewPage(this.store, this.metrics, this.basePath)
      case 'requests':
        return renderRequestsPage(this.store, this.basePath)
      case 'queries':
        return renderQueriesPage(this.store, this.basePath)
      case 'exceptions':
        return renderExceptionsPage(this.store, this.basePath)
      case 'jobs':
        return renderJobsPage(this.store, this.basePath)
      case 'cache':
        return renderCachePage(this.store, this.basePath)
      case 'events':
        return renderEventsPage(this.store, this.basePath)
      case 'performance':
        return renderPerformancePage(this.metrics, this.basePath)
    }

    // Parameterized routes
    const requestDetail = sub.match(/^requests\/([a-f0-9-]+)$/)
    if (requestDetail) {
      const html = await renderRequestDetailPage(this.store, requestDetail[1]!, this.basePath)
      return html ?? this.render404()
    }

    return this.render404()
  }

  // ── API Endpoints ─────────────────────────────────────────────────────

  private async handleApi(sub: string, params: URLSearchParams): Promise<Response> {
    try {
      switch (sub) {
        case 'entries':
          return this.apiEntries(params)
        case 'metrics':
          return this.apiMetrics()
        case 'exception-groups':
          return this.apiExceptionGroups()
        default:
          return Response.json({ error: 'Not found' }, { status: 404 })
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

  private render404(): string {
    return `<!DOCTYPE html><html><body><h1>404 — Page not found</h1><p><a href="${this.basePath}">Back to Heartbeat</a></p></body></html>`
  }
}
