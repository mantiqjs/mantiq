import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { NotificationTemplate } from '../../app/Models/NotificationTemplate.ts'
import { NotificationLog } from '../../app/Models/NotificationLog.ts'
import { WebhookEndpoint } from '../../app/Models/WebhookEndpoint.ts'
import { NotificationGroup } from '../../app/Models/NotificationGroup.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')

    // ── Users ─────────────────────────────────────────────────────────────────
    const users = [
      { name: 'Admin', email: 'admin@notifications.com', notification_preferences: JSON.stringify({ email: true, sms: true, webhook: true }) },
      { name: 'Operator', email: 'operator@notifications.com', notification_preferences: JSON.stringify({ email: true, sms: false, webhook: false }) },
    ]

    const userIds: number[] = []
    for (const u of users) {
      const existing = await User.where('email', u.email).first()
      if (existing) {
        userIds.push(existing.getAttribute('id') as number)
      } else {
        const user = await User.create({ ...u, password: hashed })
        userIds.push(user.getAttribute('id') as number)
      }
    }

    // ── Templates ─────────────────────────────────────────────────────────────
    const templates = [
      {
        name: 'Welcome Email',
        channel: 'email',
        subject: 'Welcome to {{app_name}}, {{user_name}}!',
        body: 'Hi {{user_name}},\n\nWelcome to {{app_name}}! We are excited to have you on board.\n\nYour account has been created successfully. You can log in at {{login_url}}.\n\nBest regards,\nThe {{app_name}} Team',
        variables: JSON.stringify(['app_name', 'user_name', 'login_url']),
      },
      {
        name: 'Password Reset',
        channel: 'email',
        subject: 'Reset Your Password — {{app_name}}',
        body: 'Hi {{user_name}},\n\nWe received a request to reset your password. Click the link below to set a new password:\n\n{{reset_url}}\n\nThis link will expire in {{expiry_minutes}} minutes.\n\nIf you did not request this, please ignore this email.',
        variables: JSON.stringify(['user_name', 'app_name', 'reset_url', 'expiry_minutes']),
      },
      {
        name: 'Order Confirmation',
        channel: 'email',
        subject: 'Order #{{order_id}} Confirmed',
        body: 'Hi {{user_name}},\n\nYour order #{{order_id}} has been confirmed.\n\nItems: {{item_summary}}\nTotal: {{total_amount}}\nEstimated Delivery: {{delivery_date}}\n\nTrack your order at {{tracking_url}}.\n\nThank you for your purchase!',
        variables: JSON.stringify(['user_name', 'order_id', 'item_summary', 'total_amount', 'delivery_date', 'tracking_url']),
      },
      {
        name: 'SMS Verification',
        channel: 'sms',
        subject: null,
        body: 'Your {{app_name}} verification code is {{code}}. It expires in {{expiry_minutes}} minutes. Do not share this code.',
        variables: JSON.stringify(['app_name', 'code', 'expiry_minutes']),
      },
      {
        name: 'Deployment Webhook',
        channel: 'webhook',
        subject: 'Deployment {{status}} — {{project_name}}',
        body: '{"event":"deployment","project":"{{project_name}}","environment":"{{environment}}","status":"{{status}}","commit":"{{commit_sha}}","deployed_by":"{{deployed_by}}","timestamp":"{{timestamp}}"}',
        variables: JSON.stringify(['project_name', 'environment', 'status', 'commit_sha', 'deployed_by', 'timestamp']),
      },
    ]

    const templateIds: number[] = []
    for (const t of templates) {
      const existing = await NotificationTemplate.where('name', t.name).first()
      if (existing) {
        templateIds.push(existing.getAttribute('id') as number)
      } else {
        const template = await NotificationTemplate.create({ ...t, is_active: 1 })
        templateIds.push(template.getAttribute('id') as number)
      }
    }

    // ── Webhook Endpoint ──────────────────────────────────────────────────────
    const existingEndpoint = await WebhookEndpoint.where('user_id', userIds[0]!).first()
    if (!existingEndpoint) {
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      await WebhookEndpoint.create({
        user_id: userIds[0]!,
        url: 'https://example.com/webhooks/notifications',
        secret,
        events: JSON.stringify(['notification', 'deployment', '*']),
        is_active: 1,
        failure_count: 0,
      })
    }

    // ── Notification Logs ─────────────────────────────────────────────────────
    const existingLogs = await NotificationLog.query().count() as number
    if (existingLogs === 0) {
      const logEntries = [
        {
          user_id: userIds[0]!, template_id: templateIds[0]!, channel: 'email',
          recipient: 'admin@notifications.com', subject: 'Welcome to NotifyHub, Admin!',
          body: 'Hi Admin,\n\nWelcome to NotifyHub! We are excited to have you on board.',
          status: 'delivered', sent_at: '2026-03-20T10:00:00Z', delivered_at: '2026-03-20T10:00:05Z',
        },
        {
          user_id: userIds[1]!, template_id: templateIds[0]!, channel: 'email',
          recipient: 'operator@notifications.com', subject: 'Welcome to NotifyHub, Operator!',
          body: 'Hi Operator,\n\nWelcome to NotifyHub! We are excited to have you on board.',
          status: 'delivered', sent_at: '2026-03-20T10:05:00Z', delivered_at: '2026-03-20T10:05:03Z',
        },
        {
          user_id: userIds[0]!, template_id: templateIds[1]!, channel: 'email',
          recipient: 'admin@notifications.com', subject: 'Reset Your Password — NotifyHub',
          body: 'Hi Admin,\n\nWe received a request to reset your password.',
          status: 'sent', sent_at: '2026-03-21T14:30:00Z',
        },
        {
          user_id: userIds[0]!, template_id: templateIds[3]!, channel: 'sms',
          recipient: '+1234567890', subject: null,
          body: 'Your NotifyHub verification code is 482917. It expires in 10 minutes.',
          status: 'delivered', sent_at: '2026-03-21T15:00:00Z', delivered_at: '2026-03-21T15:00:02Z',
        },
        {
          user_id: userIds[1]!, template_id: templateIds[3]!, channel: 'sms',
          recipient: '+0987654321', subject: null,
          body: 'Your NotifyHub verification code is 193748. It expires in 10 minutes.',
          status: 'failed', sent_at: '2026-03-22T09:00:00Z',
          error_message: 'Carrier rejected: invalid phone number format.',
        },
        {
          user_id: userIds[0]!, template_id: templateIds[2]!, channel: 'email',
          recipient: 'customer@example.com', subject: 'Order #10042 Confirmed',
          body: 'Hi Customer,\n\nYour order #10042 has been confirmed.',
          status: 'delivered', sent_at: '2026-03-22T11:00:00Z', delivered_at: '2026-03-22T11:00:08Z',
        },
        {
          user_id: userIds[0]!, template_id: templateIds[4]!, channel: 'webhook',
          recipient: 'https://example.com/webhooks/notifications',
          subject: 'Deployment success — mantiq-api',
          body: '{"event":"deployment","project":"mantiq-api","environment":"production","status":"success"}',
          status: 'sent', sent_at: '2026-03-23T08:00:00Z',
        },
        {
          user_id: userIds[1]!, template_id: templateIds[4]!, channel: 'webhook',
          recipient: 'https://example.com/webhooks/notifications',
          subject: 'Deployment failed — mantiq-api',
          body: '{"event":"deployment","project":"mantiq-api","environment":"staging","status":"failed"}',
          status: 'failed', sent_at: '2026-03-23T09:30:00Z',
          error_message: 'Connection refused: endpoint unreachable.',
        },
        {
          user_id: userIds[0]!, template_id: null, channel: 'email',
          recipient: 'team@example.com', subject: 'Weekly Report',
          body: 'Here is your weekly notification summary: 42 sent, 2 failed, 40 delivered.',
          status: 'pending',
        },
        {
          user_id: userIds[1]!, template_id: null, channel: 'sms',
          recipient: '+1122334455', subject: null,
          body: 'Scheduled maintenance tonight at 11 PM UTC. Expected downtime: 30 minutes.',
          status: 'sent', sent_at: '2026-03-24T16:00:00Z',
        },
      ]

      for (const entry of logEntries) {
        await NotificationLog.create({
          user_id: entry.user_id,
          template_id: entry.template_id,
          channel: entry.channel,
          recipient: entry.recipient,
          subject: entry.subject ?? null,
          body: entry.body,
          status: entry.status,
          error_message: (entry as any).error_message ?? null,
          sent_at: (entry as any).sent_at ?? null,
          delivered_at: (entry as any).delivered_at ?? null,
          metadata: null,
        })
      }
    }

    // ── Notification Group ────────────────────────────────────────────────────
    const existingGroup = await NotificationGroup.where('name', 'Engineering Team').first()
    if (!existingGroup) {
      await NotificationGroup.create({
        name: 'Engineering Team',
        description: 'All engineering team members for deployment and incident notifications.',
        user_id: userIds[0]!,
        members: JSON.stringify(userIds),
      })
    }
  }
}
