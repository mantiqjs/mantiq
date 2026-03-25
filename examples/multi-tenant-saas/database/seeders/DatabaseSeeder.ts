import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { Tenant } from '../../app/Models/Tenant.ts'
import { User } from '../../app/Models/User.ts'
import { Plan } from '../../app/Models/Plan.ts'
import { Subscription } from '../../app/Models/Subscription.ts'
import { AuditLog } from '../../app/Models/AuditLog.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')

    // ── Plans ──────────────────────────────────────────────────────────────────
    const plans = [
      {
        name: 'Free',
        slug: 'free',
        price: 0,
        features: JSON.stringify(['Up to 3 users', '100 MB storage', 'Community support', 'Basic analytics']),
        max_users: 3,
        max_storage: 104857600, // 100 MB
        is_active: 1,
      },
      {
        name: 'Starter',
        slug: 'starter',
        price: 2900,
        features: JSON.stringify(['Up to 10 users', '1 GB storage', 'Email support', 'Advanced analytics', 'Custom branding']),
        max_users: 10,
        max_storage: 1073741824, // 1 GB
        is_active: 1,
      },
      {
        name: 'Pro',
        slug: 'pro',
        price: 9900,
        features: JSON.stringify(['Unlimited users', '10 GB storage', 'Priority support', 'Advanced analytics', 'Custom branding', 'API access', 'SSO integration']),
        max_users: 999,
        max_storage: 10737418240, // 10 GB
        is_active: 1,
      },
    ]

    const planIds: Record<string, number> = {}
    for (const p of plans) {
      const existing = await Plan.where('slug', p.slug).first()
      if (existing) {
        planIds[p.slug] = existing.getAttribute('id') as number
      } else {
        const plan = await Plan.create(p)
        planIds[p.slug] = plan.getAttribute('id') as number
      }
    }

    // ── Tenants ────────────────────────────────────────────────────────────────
    const tenants = [
      {
        name: 'Acme Corp',
        slug: 'acme-corp',
        plan: 'pro',
        status: 'active',
        max_users: 999,
        max_storage: 10737418240,
        settings: JSON.stringify({ theme: 'dark', notifications: true }),
      },
      {
        name: 'Startup Inc',
        slug: 'startup-inc',
        plan: 'free',
        status: 'active',
        max_users: 3,
        max_storage: 104857600,
        settings: JSON.stringify({ theme: 'light', notifications: true }),
      },
    ]

    const tenantIds: Record<string, number> = {}
    for (const t of tenants) {
      const existing = await Tenant.where('slug', t.slug).first()
      if (existing) {
        tenantIds[t.slug] = existing.getAttribute('id') as number
      } else {
        const tenant = await Tenant.create(t)
        tenantIds[t.slug] = tenant.getAttribute('id') as number
      }
    }

    // ── Users ──────────────────────────────────────────────────────────────────
    const users = [
      // Acme Corp users
      { name: 'Alice Johnson', email: 'alice@acme.com', tenant_slug: 'acme-corp', role: 'owner' },
      { name: 'Bob Smith', email: 'bob@acme.com', tenant_slug: 'acme-corp', role: 'admin' },
      { name: 'Charlie Brown', email: 'charlie@acme.com', tenant_slug: 'acme-corp', role: 'member' },
      // Startup Inc users
      { name: 'Diana Prince', email: 'diana@startup.com', tenant_slug: 'startup-inc', role: 'owner' },
      { name: 'Eve Wilson', email: 'eve@startup.com', tenant_slug: 'startup-inc', role: 'member' },
    ]

    const userIds: Record<string, number> = {}
    for (const u of users) {
      const existing = await User.where('email', u.email).first()
      if (existing) {
        userIds[u.email] = existing.getAttribute('id') as number
      } else {
        const user = await User.create({
          name: u.name,
          email: u.email,
          password: hashed,
          tenant_id: tenantIds[u.tenant_slug]!,
          role: u.role,
        })
        userIds[u.email] = user.getAttribute('id') as number
      }
    }

    // ── Subscriptions ──────────────────────────────────────────────────────────
    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const subscriptions = [
      { tenant_slug: 'acme-corp', plan_slug: 'pro' },
      { tenant_slug: 'startup-inc', plan_slug: 'free' },
    ]

    for (const s of subscriptions) {
      const tenantId = tenantIds[s.tenant_slug]!
      const existing = await Subscription.where('tenant_id', tenantId).first()
      if (!existing) {
        await Subscription.create({
          tenant_id: tenantId,
          plan_id: planIds[s.plan_slug]!,
          status: 'active',
          current_period_start: now,
          current_period_end: periodEnd,
        })
      }
    }

    // ── Audit Logs ─────────────────────────────────────────────────────────────
    const auditLogs = [
      { tenant_slug: 'acme-corp', email: 'alice@acme.com', action: 'tenant.created', entity_type: 'Tenant', ip: '192.168.1.10' },
      { tenant_slug: 'acme-corp', email: 'alice@acme.com', action: 'user.registered', entity_type: 'User', ip: '192.168.1.10' },
      { tenant_slug: 'acme-corp', email: 'alice@acme.com', action: 'subscription.created', entity_type: 'Subscription', ip: '192.168.1.10' },
      { tenant_slug: 'acme-corp', email: 'bob@acme.com', action: 'user.invited', entity_type: 'Invitation', ip: '192.168.1.11' },
      { tenant_slug: 'acme-corp', email: 'alice@acme.com', action: 'subscription.upgraded', entity_type: 'Subscription', ip: '192.168.1.10' },
      { tenant_slug: 'acme-corp', email: 'bob@acme.com', action: 'tenant.settings.updated', entity_type: 'Tenant', ip: '192.168.1.11' },
      { tenant_slug: 'startup-inc', email: 'diana@startup.com', action: 'tenant.created', entity_type: 'Tenant', ip: '10.0.0.5' },
      { tenant_slug: 'startup-inc', email: 'diana@startup.com', action: 'user.registered', entity_type: 'User', ip: '10.0.0.5' },
      { tenant_slug: 'startup-inc', email: 'diana@startup.com', action: 'subscription.created', entity_type: 'Subscription', ip: '10.0.0.5' },
      { tenant_slug: 'startup-inc', email: 'diana@startup.com', action: 'user.invited', entity_type: 'Invitation', ip: '10.0.0.5' },
    ]

    for (const log of auditLogs) {
      const tenantId = tenantIds[log.tenant_slug]!
      const logUserId = userIds[log.email]!

      const existing = await AuditLog.where('tenant_id', tenantId)
        .where('user_id', logUserId)
        .where('action', log.action)
        .first()

      if (!existing) {
        await AuditLog.create({
          tenant_id: tenantId,
          user_id: logUserId,
          action: log.action,
          entity_type: log.entity_type,
          entity_id: tenantId,
          ip_address: log.ip,
        })
      }
    }
  }
}
