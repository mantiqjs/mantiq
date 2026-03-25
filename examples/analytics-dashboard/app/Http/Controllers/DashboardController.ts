import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Dashboard } from '../../Models/Dashboard.ts'
import { Metric } from '../../Models/Metric.ts'

export class DashboardController {
  /** GET /api/dashboards — list user's own dashboards + public ones */
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const userId = user?.id ?? user?.getAuthIdentifier?.() ?? null

    // Get all dashboards the user can see: their own + public
    const allDashboards = await Dashboard.query().orderBy('created_at', 'desc').get() as any[]
    const visible = allDashboards.filter((d: any) => {
      const ownerId = d.getAttribute('user_id')
      const isPublic = d.getAttribute('is_public')
      return ownerId === userId || isPublic === 1
    })

    return MantiqResponse.json({ data: visible.map((d: any) => d.toObject()) })
  }

  /** GET /api/dashboards/:id — show dashboard with resolved widget data */
  async show(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const dashboard = await Dashboard.find(Number(id))
    if (!dashboard) return MantiqResponse.json({ error: 'Dashboard not found.' }, 404)

    // Check access: public or owned by user
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any
    const userId = user?.id ?? user?.getAuthIdentifier?.() ?? null
    const ownerId = dashboard.getAttribute('user_id')
    const isPublic = dashboard.getAttribute('is_public')

    if (ownerId !== userId && isPublic !== 1) {
      return MantiqResponse.json({ error: 'Forbidden.' }, 403)
    }

    // Parse layout and resolve widget data
    const layoutRaw = dashboard.getAttribute('layout') as string
    let layout: any[] = []
    try {
      layout = JSON.parse(layoutRaw)
    } catch {
      layout = []
    }

    const resolvedWidgets = await Promise.all(
      layout.map(async (widget: any) => {
        if (widget.type === 'metric_latest' && widget.metric_name) {
          const metrics = await Metric.query()
            .where('name', widget.metric_name)
            .orderBy('recorded_at', 'desc')
            .limit(1)
            .get() as any[]
          const latest = metrics[0]
          return { ...widget, data: latest ? latest.toObject() : null }
        }

        if (widget.type === 'metric_chart' && widget.metric_name) {
          const limit = widget.limit ?? 50
          const metrics = await Metric.query()
            .where('name', widget.metric_name)
            .orderBy('recorded_at', 'desc')
            .limit(limit)
            .get() as any[]
          return { ...widget, data: metrics.reverse().map((m: any) => m.toObject()) }
        }

        if (widget.type === 'metric_summary' && widget.metric_name) {
          const metrics = await Metric.query()
            .where('name', widget.metric_name)
            .orderBy('recorded_at', 'asc')
            .get() as any[]
          const values = metrics.map((m: any) => Number(m.getAttribute('value'))).sort((a: number, b: number) => a - b)
          if (values.length === 0) {
            return { ...widget, data: { count: 0, avg: null, min: null, max: null } }
          }
          const count = values.length
          const sum = values.reduce((a: number, b: number) => a + b, 0)
          return {
            ...widget,
            data: {
              count,
              avg: Math.round((sum / count) * 100) / 100,
              min: values[0],
              max: values[count - 1],
            },
          }
        }

        return widget
      }),
    )

    return MantiqResponse.json({
      data: {
        ...dashboard.toObject(),
        resolved_layout: resolvedWidgets,
      },
    })
  }

  /** POST /api/dashboards — create a dashboard */
  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any
    const userId = user?.id ?? user?.getAuthIdentifier?.() ?? null

    const body = await request.input() as {
      name?: string; description?: string; layout?: any[]; is_public?: number
    }

    if (!body.name) {
      return MantiqResponse.json({ error: 'Dashboard name is required.' }, 422)
    }

    const dashboard = await Dashboard.create({
      name: body.name,
      description: body.description ?? null,
      user_id: userId,
      layout: JSON.stringify(body.layout ?? []),
      is_public: body.is_public ?? 0,
    })

    return MantiqResponse.json({ message: 'Dashboard created.', data: dashboard.toObject() }, 201)
  }

  /** PUT /api/dashboards/:id — update a dashboard */
  async update(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const dashboard = await Dashboard.find(Number(id))
    if (!dashboard) return MantiqResponse.json({ error: 'Dashboard not found.' }, 404)

    // Only owner can update
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any
    const userId = user?.id ?? user?.getAuthIdentifier?.() ?? null

    if (dashboard.getAttribute('user_id') !== userId) {
      return MantiqResponse.json({ error: 'Forbidden.' }, 403)
    }

    const body = await request.input() as Record<string, any>

    if (body.name !== undefined) dashboard.setAttribute('name', body.name)
    if (body.description !== undefined) dashboard.setAttribute('description', body.description)
    if (body.layout !== undefined) dashboard.setAttribute('layout', JSON.stringify(body.layout))
    if (body.is_public !== undefined) dashboard.setAttribute('is_public', body.is_public)

    await dashboard.save()
    return MantiqResponse.json({ message: 'Dashboard updated.', data: dashboard.toObject() })
  }

  /** DELETE /api/dashboards/:id — delete a dashboard */
  async destroy(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const dashboard = await Dashboard.find(Number(id))
    if (!dashboard) return MantiqResponse.json({ error: 'Dashboard not found.' }, 404)

    // Only owner can delete
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any
    const userId = user?.id ?? user?.getAuthIdentifier?.() ?? null

    if (dashboard.getAttribute('user_id') !== userId) {
      return MantiqResponse.json({ error: 'Forbidden.' }, 403)
    }

    await dashboard.delete()
    return MantiqResponse.json({ message: 'Dashboard deleted.' })
  }
}
