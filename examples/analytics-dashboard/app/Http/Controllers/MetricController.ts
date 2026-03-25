import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Metric } from '../../Models/Metric.ts'

interface MetricInput {
  name?: string
  value?: number
  unit?: string
  tags?: Record<string, string>
}

interface MetricBatchInput {
  metrics?: MetricInput[]
  name?: string
  value?: number
  unit?: string
  tags?: Record<string, string>
}

export class MetricController {
  /** POST /api/metrics — accept single or batch metric ingestion */
  async ingest(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as MetricBatchInput

    const items: MetricInput[] = body.metrics
      ? body.metrics
      : [{ name: body.name, value: body.value, unit: body.unit, tags: body.tags }]

    if (items.length === 0) {
      return MantiqResponse.json({ error: 'No metrics provided.' }, 422)
    }

    const created: any[] = []
    const errors: string[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (!item.name || item.value === undefined || item.value === null) {
        errors.push(`Metric at index ${i}: name and value are required.`)
        continue
      }

      const metric = await Metric.create({
        name: item.name,
        value: item.value,
        unit: item.unit ?? null,
        tags: item.tags ? JSON.stringify(item.tags) : null,
        recorded_at: new Date().toISOString(),
      })
      created.push(metric.toObject())
    }

    if (errors.length > 0 && created.length === 0) {
      return MantiqResponse.json({ error: 'All metrics failed validation.', details: errors }, 422)
    }

    return MantiqResponse.json({
      message: `${created.length} metric(s) ingested.`,
      data: created,
      errors: errors.length > 0 ? errors : undefined,
    }, 201)
  }

  /** GET /api/metrics — query metrics by name with time range and aggregation */
  async query(request: MantiqRequest): Promise<Response> {
    const name = request.query('name')
    const from = request.query('from')
    const to = request.query('to')
    const aggregation = request.query('aggregation') as string | undefined
    const groupBy = request.query('group_by') as string | undefined

    if (!name) {
      return MantiqResponse.json({ error: 'Query parameter "name" is required.' }, 422)
    }

    let query = Metric.query().where('name', name) as any

    if (from) {
      query = query.where('recorded_at', '>=', from)
    }
    if (to) {
      query = query.where('recorded_at', '<=', to)
    }

    const metrics = await query.orderBy('recorded_at', 'asc').get() as any[]
    const values = metrics.map((m: any) => Number(m.getAttribute('value')))

    // If aggregation requested, compute in-memory
    if (aggregation && values.length > 0) {
      if (groupBy) {
        const buckets = this.groupByInterval(metrics, groupBy)
        const aggregated = Object.entries(buckets).map(([bucket, items]) => {
          const vals = (items as any[]).map((m: any) => Number(m.getAttribute('value')))
          return { bucket, ...this.computeAggregation(vals, aggregation) }
        })
        return MantiqResponse.json({ data: aggregated, total: metrics.length })
      }

      const result = this.computeAggregation(values, aggregation)
      return MantiqResponse.json({ data: result, total: metrics.length })
    }

    return MantiqResponse.json({
      data: metrics.map((m: any) => m.toObject()),
      total: metrics.length,
    })
  }

  /** GET /api/metrics/names — list distinct metric names */
  async names(_request: MantiqRequest): Promise<Response> {
    const metrics = await Metric.query().orderBy('name', 'asc').get() as any[]
    const nameSet = new Set<string>()
    for (const m of metrics) {
      nameSet.add(m.getAttribute('name') as string)
    }
    return MantiqResponse.json({ data: Array.from(nameSet) })
  }

  /** GET /api/metrics/latest — latest value for each metric name (or specific name) */
  async latest(request: MantiqRequest): Promise<Response> {
    const name = request.query('name')

    const allMetrics = name
      ? await Metric.query().where('name', name).orderBy('recorded_at', 'desc').get() as any[]
      : await Metric.query().orderBy('recorded_at', 'desc').get() as any[]

    // Group by name, take latest per name
    const latestMap = new Map<string, any>()
    for (const m of allMetrics) {
      const metricName = m.getAttribute('name') as string
      if (!latestMap.has(metricName)) {
        latestMap.set(metricName, m.toObject())
      }
    }

    return MantiqResponse.json({ data: Array.from(latestMap.values()) })
  }

  /** GET /api/metrics/summary — summary stats (avg, min, max, count, p50, p95, p99) */
  async summary(request: MantiqRequest): Promise<Response> {
    const name = request.query('name')
    const from = request.query('from')
    const to = request.query('to')

    if (!name) {
      return MantiqResponse.json({ error: 'Query parameter "name" is required.' }, 422)
    }

    let query = Metric.query().where('name', name) as any
    if (from) query = query.where('recorded_at', '>=', from)
    if (to) query = query.where('recorded_at', '<=', to)

    const metrics = await query.orderBy('recorded_at', 'asc').get() as any[]
    const values = metrics.map((m: any) => Number(m.getAttribute('value'))).sort((a: number, b: number) => a - b)

    if (values.length === 0) {
      return MantiqResponse.json({ data: { count: 0, avg: null, min: null, max: null, p50: null, p95: null, p99: null } })
    }

    const count = values.length
    const sum = values.reduce((a: number, b: number) => a + b, 0)
    const avg = sum / count
    const min = values[0]!
    const max = values[count - 1]!
    const p50 = this.percentile(values, 50)
    const p95 = this.percentile(values, 95)
    const p99 = this.percentile(values, 99)

    return MantiqResponse.json({
      data: { name, count, avg: Math.round(avg * 100) / 100, min, max, p50, p95, p99 },
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private computeAggregation(values: number[], aggregation: string): Record<string, number> {
    const count = values.length
    const sum = values.reduce((a, b) => a + b, 0)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = Math.round((sum / count) * 100) / 100

    switch (aggregation) {
      case 'avg': return { avg }
      case 'sum': return { sum }
      case 'min': return { min }
      case 'max': return { max }
      case 'count': return { count }
      default: return { avg, sum, min, max, count }
    }
  }

  private groupByInterval(metrics: any[], interval: string): Record<string, any[]> {
    const buckets: Record<string, any[]> = {}

    for (const m of metrics) {
      const ts = new Date(m.getAttribute('recorded_at') as string)
      let key: string

      switch (interval) {
        case '1m':
          key = `${ts.getUTCFullYear()}-${String(ts.getUTCMonth() + 1).padStart(2, '0')}-${String(ts.getUTCDate()).padStart(2, '0')}T${String(ts.getUTCHours()).padStart(2, '0')}:${String(ts.getUTCMinutes()).padStart(2, '0')}`
          break
        case '5m': {
          const min5 = Math.floor(ts.getUTCMinutes() / 5) * 5
          key = `${ts.getUTCFullYear()}-${String(ts.getUTCMonth() + 1).padStart(2, '0')}-${String(ts.getUTCDate()).padStart(2, '0')}T${String(ts.getUTCHours()).padStart(2, '0')}:${String(min5).padStart(2, '0')}`
          break
        }
        case '1h':
          key = `${ts.getUTCFullYear()}-${String(ts.getUTCMonth() + 1).padStart(2, '0')}-${String(ts.getUTCDate()).padStart(2, '0')}T${String(ts.getUTCHours()).padStart(2, '0')}:00`
          break
        case '1d':
          key = `${ts.getUTCFullYear()}-${String(ts.getUTCMonth() + 1).padStart(2, '0')}-${String(ts.getUTCDate()).padStart(2, '0')}`
          break
        default:
          key = m.getAttribute('recorded_at') as string
      }

      if (!buckets[key]) buckets[key] = []
      buckets[key]!.push(m)
    }

    return buckets
  }

  private percentile(sorted: number[], p: number): number {
    const idx = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(idx)
    const upper = Math.ceil(idx)
    if (lower === upper) return sorted[lower]!
    const weight = idx - lower
    return Math.round((sorted[lower]! * (1 - weight) + sorted[upper]! * weight) * 100) / 100
  }
}
