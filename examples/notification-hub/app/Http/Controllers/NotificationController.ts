import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { NotificationLog } from '../../Models/NotificationLog.ts'
import { NotificationTemplate } from '../../Models/NotificationTemplate.ts'
import { WebhookEndpoint } from '../../Models/WebhookEndpoint.ts'

function renderTemplate(text: string, variables: Record<string, string>): string {
  let rendered = text
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return rendered
}

export class NotificationController {
  /**
   * Send a notification to one or more recipients.
   */
  async send(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    const body = await request.input() as {
      template_id?: number
      channel?: string
      subject?: string
      body?: string
      recipients?: string[]
      variables?: Record<string, string>
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.recipients || !Array.isArray(body.recipients) || body.recipients.length === 0) {
      errors.recipients = 'At least one recipient is required.'
    }
    if (!body.template_id && !body.body) {
      errors.body = 'Either template_id or body is required.'
    }
    if (!body.template_id && !body.channel) {
      errors.channel = 'Channel is required when not using a template.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ message: 'Validation failed.', errors }, 422)
    }

    const variables = body.variables ?? {}
    let channel = body.channel ?? ''
    let subject = body.subject ?? ''
    let notifBody = body.body ?? ''

    // Resolve template if provided
    if (body.template_id) {
      const template = await NotificationTemplate.find(Number(body.template_id))
      if (!template) {
        return MantiqResponse.json({ message: 'Template not found.' }, 404)
      }
      channel = template.getAttribute('channel') as string
      subject = renderTemplate((template.getAttribute('subject') as string) ?? '', variables)
      notifBody = renderTemplate(template.getAttribute('body') as string, variables)
    } else {
      subject = renderTemplate(subject, variables)
      notifBody = renderTemplate(notifBody, variables)
    }

    const logs: any[] = []

    for (const recipient of body.recipients!) {
      const log = await NotificationLog.create({
        user_id: user ? user.getAuthIdentifier() : null,
        template_id: body.template_id ?? null,
        channel,
        recipient: recipient.trim(),
        subject,
        body: notifBody,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: JSON.stringify({ variables }),
      })

      // If channel is webhook, deliver to matching endpoints
      if (channel === 'webhook') {
        const endpoints = await WebhookEndpoint.where('is_active', 1).get() as any[]
        for (const endpoint of endpoints) {
          const events = JSON.parse((endpoint.getAttribute('events') as string) || '[]')
          if (events.includes('notification') || events.includes('*')) {
            try {
              await fetch(endpoint.getAttribute('url') as string, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Webhook-Secret': endpoint.getAttribute('secret') as string,
                },
                body: JSON.stringify({
                  event: 'notification',
                  recipient,
                  subject,
                  body: notifBody,
                  sent_at: new Date().toISOString(),
                }),
              })
              endpoint.setAttribute('last_delivery_at', new Date().toISOString())
              await endpoint.save()
            } catch {
              endpoint.setAttribute('failure_count', (endpoint.getAttribute('failure_count') as number) + 1)
              await endpoint.save()
            }
          }
        }
      }

      logs.push(log.toObject())
    }

    return MantiqResponse.json({
      message: `Notification sent to ${logs.length} recipient(s).`,
      data: logs,
    })
  }

  /**
   * Send bulk notifications to multiple recipients.
   */
  async sendBulk(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    const body = await request.input() as {
      notifications: Array<{
        template_id?: number
        channel?: string
        subject?: string
        body?: string
        recipients: string[]
        variables?: Record<string, string>
      }>
    }

    if (!body.notifications || !Array.isArray(body.notifications) || body.notifications.length === 0) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { notifications: 'At least one notification is required.' },
      }, 422)
    }

    const allLogs: any[] = []

    for (const notif of body.notifications) {
      const variables = notif.variables ?? {}
      let channel = notif.channel ?? ''
      let subject = notif.subject ?? ''
      let notifBody = notif.body ?? ''

      if (notif.template_id) {
        const template = await NotificationTemplate.find(Number(notif.template_id))
        if (template) {
          channel = template.getAttribute('channel') as string
          subject = renderTemplate((template.getAttribute('subject') as string) ?? '', variables)
          notifBody = renderTemplate(template.getAttribute('body') as string, variables)
        }
      } else {
        subject = renderTemplate(subject, variables)
        notifBody = renderTemplate(notifBody, variables)
      }

      for (const recipient of notif.recipients) {
        const log = await NotificationLog.create({
          user_id: user ? user.getAuthIdentifier() : null,
          template_id: notif.template_id ?? null,
          channel,
          recipient: recipient.trim(),
          subject,
          body: notifBody,
          status: 'sent',
          sent_at: new Date().toISOString(),
          metadata: JSON.stringify({ variables }),
        })

        // If channel is webhook, deliver to matching endpoints
        if (channel === 'webhook') {
          const endpoints = await WebhookEndpoint.where('is_active', 1).get() as any[]
          for (const endpoint of endpoints) {
            const events = JSON.parse((endpoint.getAttribute('events') as string) || '[]')
            if (events.includes('notification') || events.includes('*')) {
              try {
                await fetch(endpoint.getAttribute('url') as string, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Secret': endpoint.getAttribute('secret') as string,
                  },
                  body: JSON.stringify({
                    event: 'notification',
                    recipient,
                    subject,
                    body: notifBody,
                    sent_at: new Date().toISOString(),
                  }),
                })
                endpoint.setAttribute('last_delivery_at', new Date().toISOString())
                await endpoint.save()
              } catch {
                endpoint.setAttribute('failure_count', (endpoint.getAttribute('failure_count') as number) + 1)
                await endpoint.save()
              }
            }
          }
        }

        allLogs.push(log.toObject())
      }
    }

    return MantiqResponse.json({
      message: `Bulk send complete. ${allLogs.length} notification(s) sent.`,
      data: allLogs,
    })
  }

  /**
   * List notification logs with filters and pagination.
   */
  async logs(request: MantiqRequest): Promise<Response> {
    const channel = request.query('channel')
    const status = request.query('status')
    const recipient = request.query('recipient')
    const dateFrom = request.query('date_from')
    const dateTo = request.query('date_to')
    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 15)))

    const buildQuery = () => {
      let q = NotificationLog.query()
      if (channel) q = q.where('channel', channel) as any
      if (status) q = q.where('status', status) as any
      if (recipient) q = q.where('recipient', 'LIKE', `%${recipient}%`) as any
      if (dateFrom) q = q.where('created_at', '>=', dateFrom) as any
      if (dateTo) q = q.where('created_at', '<=', dateTo) as any
      return q
    }

    const total = await buildQuery().count() as number

    const logs = await buildQuery()
      .orderBy('created_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .get() as any[]

    const data = logs.map((l: any) => l.toObject())

    return MantiqResponse.json({
      data,
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.max(1, Math.ceil(total / perPage)),
      },
    })
  }

  /**
   * Get a single notification log detail.
   */
  async show(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const log = await NotificationLog.find(Number(id))

    if (!log) {
      return MantiqResponse.json({ message: 'Notification log not found.' }, 404)
    }

    return MantiqResponse.json({ data: log.toObject() })
  }

  /**
   * Retry a failed notification.
   */
  async retry(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const log = await NotificationLog.find(Number(id))

    if (!log) {
      return MantiqResponse.json({ message: 'Notification log not found.' }, 404)
    }

    const currentStatus = log.getAttribute('status') as string
    if (currentStatus !== 'failed') {
      return MantiqResponse.json({ message: 'Only failed notifications can be retried.' }, 422)
    }

    // Reset to pending, then mark as sent
    log.setAttribute('status', 'pending')
    log.setAttribute('error_message', null)
    await log.save()

    log.setAttribute('status', 'sent')
    log.setAttribute('sent_at', new Date().toISOString())
    await log.save()

    return MantiqResponse.json({
      message: 'Notification retried.',
      data: log.toObject(),
    })
  }

  /**
   * Get aggregate stats by channel and status.
   */
  async stats(_request: MantiqRequest): Promise<Response> {
    const allLogs = await NotificationLog.query().get() as any[]

    const byChannel: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    const byChannelAndStatus: Record<string, Record<string, number>> = {}

    for (const log of allLogs) {
      const channel = log.getAttribute('channel') as string
      const status = log.getAttribute('status') as string

      byChannel[channel] = (byChannel[channel] ?? 0) + 1
      byStatus[status] = (byStatus[status] ?? 0) + 1

      if (!byChannelAndStatus[channel]) byChannelAndStatus[channel] = {}
      byChannelAndStatus[channel][status] = (byChannelAndStatus[channel][status] ?? 0) + 1
    }

    return MantiqResponse.json({
      data: {
        total: allLogs.length,
        by_channel: byChannel,
        by_status: byStatus,
        by_channel_and_status: byChannelAndStatus,
      },
    })
  }
}
