import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Alert } from '../../Models/Alert.ts'
import { AlertEvent } from '../../Models/AlertEvent.ts'
import { Metric } from '../../Models/Metric.ts'

const VALID_CONDITIONS = ['gt', 'lt', 'eq', 'gte', 'lte'] as const
const VALID_CHANNELS = ['log', 'mail', 'webhook'] as const

export class AlertController {
  /** GET /api/alerts — list all alerts */
  async index(_request: MantiqRequest): Promise<Response> {
    const alerts = await Alert.query().orderBy('created_at', 'desc').get() as any[]
    return MantiqResponse.json({ data: alerts.map((a: any) => a.toObject()) })
  }

  /** POST /api/alerts — create a new alert rule */
  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      name?: string; metric_name?: string; condition?: string; threshold?: number
      window_seconds?: number; channel?: string; channel_target?: string
      cooldown_seconds?: number
    }

    if (!body.name || !body.metric_name || !body.condition || body.threshold === undefined) {
      return MantiqResponse.json({ error: 'name, metric_name, condition, and threshold are required.' }, 422)
    }

    if (!VALID_CONDITIONS.includes(body.condition as any)) {
      return MantiqResponse.json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` }, 422)
    }

    if (body.channel && !VALID_CHANNELS.includes(body.channel as any)) {
      return MantiqResponse.json({ error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` }, 422)
    }

    const alert = await Alert.create({
      name: body.name,
      metric_name: body.metric_name,
      condition: body.condition,
      threshold: body.threshold,
      window_seconds: body.window_seconds ?? 300,
      channel: body.channel ?? 'log',
      channel_target: body.channel_target ?? null,
      is_active: 1,
      last_triggered_at: null,
      cooldown_seconds: body.cooldown_seconds ?? 600,
    })

    return MantiqResponse.json({ message: 'Alert created.', data: alert.toObject() }, 201)
  }

  /** PUT /api/alerts/:id — update an alert rule */
  async update(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const alert = await Alert.find(Number(id))
    if (!alert) return MantiqResponse.json({ error: 'Alert not found.' }, 404)

    const body = await request.input() as Record<string, any>

    if (body.condition && !VALID_CONDITIONS.includes(body.condition as any)) {
      return MantiqResponse.json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` }, 422)
    }
    if (body.channel && !VALID_CHANNELS.includes(body.channel as any)) {
      return MantiqResponse.json({ error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` }, 422)
    }

    const fields = ['name', 'metric_name', 'condition', 'threshold', 'window_seconds', 'channel', 'channel_target', 'cooldown_seconds']
    for (const field of fields) {
      if (body[field] !== undefined) {
        alert.setAttribute(field, body[field])
      }
    }

    await alert.save()
    return MantiqResponse.json({ message: 'Alert updated.', data: alert.toObject() })
  }

  /** DELETE /api/alerts/:id — delete an alert */
  async destroy(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const alert = await Alert.find(Number(id))
    if (!alert) return MantiqResponse.json({ error: 'Alert not found.' }, 404)

    await alert.delete()
    return MantiqResponse.json({ message: 'Alert deleted.' })
  }

  /** PATCH /api/alerts/:id/toggle — enable or disable an alert */
  async toggle(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const alert = await Alert.find(Number(id))
    if (!alert) return MantiqResponse.json({ error: 'Alert not found.' }, 404)

    const current = alert.getAttribute('is_active') as number
    alert.setAttribute('is_active', current === 1 ? 0 : 1)
    await alert.save()

    const status = alert.getAttribute('is_active') === 1 ? 'enabled' : 'disabled'
    return MantiqResponse.json({ message: `Alert ${status}.`, data: alert.toObject() })
  }

  /** GET /api/alerts/:id/events — list alert events for a specific alert */
  async events(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const alert = await Alert.find(Number(id))
    if (!alert) return MantiqResponse.json({ error: 'Alert not found.' }, 404)

    const events = await AlertEvent.query()
      .where('alert_id', Number(id))
      .orderBy('triggered_at', 'desc')
      .get() as any[]

    return MantiqResponse.json({ data: events.map((e: any) => e.toObject()) })
  }

  /** PATCH /api/alert-events/:id/ack — acknowledge an alert event */
  async acknowledge(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const event = await AlertEvent.find(Number(id))
    if (!event) return MantiqResponse.json({ error: 'Alert event not found.' }, 404)

    event.setAttribute('acknowledged', 1)
    await event.save()

    return MantiqResponse.json({ message: 'Alert event acknowledged.', data: event.toObject() })
  }

  /** POST /api/alerts/:id/check — manually evaluate alert against recent metrics */
  async check(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const alert = await Alert.find(Number(id))
    if (!alert) return MantiqResponse.json({ error: 'Alert not found.' }, 404)

    const metricName = alert.getAttribute('metric_name') as string
    const windowSeconds = alert.getAttribute('window_seconds') as number
    const threshold = alert.getAttribute('threshold') as number
    const condition = alert.getAttribute('condition') as string
    const cooldownSeconds = alert.getAttribute('cooldown_seconds') as number
    const lastTriggered = alert.getAttribute('last_triggered_at') as string | null

    // Check cooldown
    if (lastTriggered) {
      const lastTime = new Date(lastTriggered).getTime()
      const now = Date.now()
      if (now - lastTime < cooldownSeconds * 1000) {
        return MantiqResponse.json({
          message: 'Alert is in cooldown period.',
          triggered: false,
          cooldown_remaining_seconds: Math.ceil((cooldownSeconds * 1000 - (now - lastTime)) / 1000),
        })
      }
    }

    // Fetch metrics within window
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString()
    const metrics = await Metric.query()
      .where('name', metricName)
      .where('recorded_at', '>=', windowStart)
      .get() as any[]

    if (metrics.length === 0) {
      return MantiqResponse.json({ message: 'No metrics found in window.', triggered: false, metrics_count: 0 })
    }

    // Compute average of values in window
    const values = metrics.map((m: any) => Number(m.getAttribute('value')))
    const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length

    // Evaluate condition
    const triggered = this.evaluateCondition(avg, condition, threshold)

    if (triggered) {
      // Create alert event
      const now = new Date().toISOString()
      const alertEvent = await AlertEvent.create({
        alert_id: Number(id),
        metric_value: Math.round(avg * 100) / 100,
        triggered_at: now,
        resolved_at: null,
        acknowledged: 0,
      })

      // Update last_triggered_at
      alert.setAttribute('last_triggered_at', now)
      await alert.save()

      return MantiqResponse.json({
        message: 'Alert triggered!',
        triggered: true,
        avg_value: Math.round(avg * 100) / 100,
        threshold,
        condition,
        metrics_count: metrics.length,
        event: alertEvent.toObject(),
      })
    }

    return MantiqResponse.json({
      message: 'Alert condition not met.',
      triggered: false,
      avg_value: Math.round(avg * 100) / 100,
      threshold,
      condition,
      metrics_count: metrics.length,
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold
      case 'lt': return value < threshold
      case 'eq': return value === threshold
      case 'gte': return value >= threshold
      case 'lte': return value <= threshold
      default: return false
    }
  }
}
