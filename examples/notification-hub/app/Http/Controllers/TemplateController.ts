import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { NotificationTemplate } from '../../Models/NotificationTemplate.ts'
import { NotificationLog } from '../../Models/NotificationLog.ts'

export class TemplateController {
  /**
   * List templates with optional channel filter.
   */
  async index(request: MantiqRequest): Promise<Response> {
    const channel = request.query('channel')

    let query = NotificationTemplate.query()
    if (channel) {
      query = query.where('channel', channel) as any
    }

    const templates = await query.orderBy('created_at', 'desc').get() as any[]
    const data = templates.map((t: any) => t.toObject())

    return MantiqResponse.json({ data })
  }

  /**
   * Get template details.
   */
  async show(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const template = await NotificationTemplate.find(Number(id))

    if (!template) {
      return MantiqResponse.json({ message: 'Template not found.' }, 404)
    }

    return MantiqResponse.json({ data: template.toObject() })
  }

  /**
   * Create a new template.
   */
  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      name?: string
      channel?: string
      subject?: string
      body?: string
      variables?: string
      is_active?: number
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.name || !body.name.trim()) {
      errors.name = 'Name is required.'
    }
    if (!body.channel || !body.channel.trim()) {
      errors.channel = 'Channel is required.'
    }
    if (!body.body || !body.body.trim()) {
      errors.body = 'Body is required.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ message: 'Validation failed.', errors }, 422)
    }

    // ── Uniqueness check ────────────────────────────────────────────────────
    const existing = await NotificationTemplate.where('name', body.name!.trim()).first()
    if (existing) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { name: 'A template with this name already exists.' },
      }, 422)
    }

    const template = await NotificationTemplate.create({
      name: body.name!.trim(),
      channel: body.channel!.trim(),
      subject: body.subject?.trim() || null,
      body: body.body!.trim(),
      variables: body.variables?.trim() || '[]',
      is_active: body.is_active ?? 1,
    })

    return MantiqResponse.json({ message: 'Template created.', data: template.toObject() }, 201)
  }

  /**
   * Update a template.
   */
  async update(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const template = await NotificationTemplate.find(Number(id))

    if (!template) {
      return MantiqResponse.json({ message: 'Template not found.' }, 404)
    }

    const body = await request.input() as {
      name?: string
      channel?: string
      subject?: string
      body?: string
      variables?: string
      is_active?: number
    }

    // Check uniqueness if name is changing
    if (body.name !== undefined) {
      const existing = await NotificationTemplate.where('name', body.name.trim()).first()
      if (existing && (existing.getAttribute('id') as number) !== Number(id)) {
        return MantiqResponse.json({
          message: 'Validation failed.',
          errors: { name: 'A template with this name already exists.' },
        }, 422)
      }
      template.setAttribute('name', body.name.trim())
    }
    if (body.channel !== undefined) template.setAttribute('channel', body.channel.trim())
    if (body.subject !== undefined) template.setAttribute('subject', body.subject?.trim() || null)
    if (body.body !== undefined) template.setAttribute('body', body.body.trim())
    if (body.variables !== undefined) template.setAttribute('variables', body.variables.trim())
    if (body.is_active !== undefined) template.setAttribute('is_active', body.is_active)

    await template.save()

    return MantiqResponse.json({ message: 'Template updated.', data: template.toObject() })
  }

  /**
   * Delete a template.
   */
  async destroy(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const template = await NotificationTemplate.find(Number(id))

    if (!template) {
      return MantiqResponse.json({ message: 'Template not found.' }, 404)
    }

    await template.delete()
    return MantiqResponse.json({ message: 'Template deleted.' })
  }

  /**
   * Preview a template by rendering its body with sample variables.
   */
  async preview(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const template = await NotificationTemplate.find(Number(id))

    if (!template) {
      return MantiqResponse.json({ message: 'Template not found.' }, 404)
    }

    const body = await request.input() as { variables?: Record<string, string> }
    const variables = body.variables ?? {}

    let renderedBody = template.getAttribute('body') as string
    let renderedSubject = (template.getAttribute('subject') as string) ?? ''

    for (const [key, value] of Object.entries(variables)) {
      renderedBody = renderedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      renderedSubject = renderedSubject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }

    return MantiqResponse.json({
      data: {
        subject: renderedSubject,
        body: renderedBody,
        channel: template.getAttribute('channel'),
      },
    })
  }

  /**
   * Simulate sending a notification using this template and log it.
   */
  async test(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const template = await NotificationTemplate.find(Number(id))

    if (!template) {
      return MantiqResponse.json({ message: 'Template not found.' }, 404)
    }

    const body = await request.input() as {
      recipient?: string
      variables?: Record<string, string>
    }

    if (!body.recipient || !body.recipient.trim()) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { recipient: 'Recipient is required.' },
      }, 422)
    }

    const variables = body.variables ?? {}
    let renderedBody = template.getAttribute('body') as string
    let renderedSubject = (template.getAttribute('subject') as string) ?? ''

    for (const [key, value] of Object.entries(variables)) {
      renderedBody = renderedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      renderedSubject = renderedSubject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }

    const log = await NotificationLog.create({
      template_id: Number(id),
      channel: template.getAttribute('channel') as string,
      recipient: body.recipient.trim(),
      subject: renderedSubject,
      body: renderedBody,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: JSON.stringify({ test: true, variables }),
    })

    return MantiqResponse.json({
      message: 'Test notification sent.',
      data: log.toObject(),
    })
  }
}
