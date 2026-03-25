import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Tenant } from '../../Models/Tenant.ts'
import { User } from '../../Models/User.ts'
import { Subscription } from '../../Models/Subscription.ts'
import { Plan } from '../../Models/Plan.ts'
import { AuditLog } from '../../Models/AuditLog.ts'

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

export class TenantController {
  async show(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number
    const tenant = await Tenant.find(tenantId)
    if (!tenant) return MantiqResponse.json({ message: 'Tenant not found.' }, 404)

    return MantiqResponse.json({ data: tenant.toObject() })
  }

  async update(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const role = user.getAttribute('role') as string
    if (role !== 'owner' && role !== 'admin') {
      return MantiqResponse.json({ message: 'Only owners and admins can update tenant settings.' }, 403)
    }

    const tenantId = user.getAttribute('tenant_id') as number
    const tenant = await Tenant.find(tenantId)
    if (!tenant) return MantiqResponse.json({ message: 'Tenant not found.' }, 404)

    const body = await request.input() as {
      name?: string
      settings?: string
    }

    if (body.name !== undefined) tenant.setAttribute('name', body.name.trim())
    if (body.settings !== undefined) tenant.setAttribute('settings', body.settings)

    await tenant.save()

    return MantiqResponse.json({ message: 'Tenant updated.', data: tenant.toObject() })
  }

  async members(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number
    const members = await User.where('tenant_id', tenantId).get() as any[]

    return MantiqResponse.json({
      data: members.map((m: any) => m.toObject()),
    })
  }

  async stats(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number

    // User count
    const userCount = await User.where('tenant_id', tenantId).count() as number

    // Subscription info
    const subscription = await Subscription.where('tenant_id', tenantId).first()
    let subscriptionData: any = null
    if (subscription) {
      subscriptionData = subscription.toObject()
      const planId = subscription.getAttribute('plan_id') as number
      const plan = await Plan.find(planId)
      if (plan) {
        subscriptionData.plan = plan.toObject()
      }
    }

    // Audit log count
    const auditLogCount = await AuditLog.where('tenant_id', tenantId).count() as number

    return MantiqResponse.json({
      data: {
        user_count: userCount,
        subscription: subscriptionData,
        audit_log_count: auditLogCount,
      },
    })
  }
}
