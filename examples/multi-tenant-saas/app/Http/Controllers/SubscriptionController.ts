import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Subscription } from '../../Models/Subscription.ts'
import { Plan } from '../../Models/Plan.ts'
import { User } from '../../Models/User.ts'
import { Tenant } from '../../Models/Tenant.ts'

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

export class SubscriptionController {
  async current(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number
    const subscription = await Subscription.where('tenant_id', tenantId).first()

    if (!subscription) {
      return MantiqResponse.json({ message: 'No active subscription found.' }, 404)
    }

    const data = subscription.toObject()
    const planId = subscription.getAttribute('plan_id') as number
    const plan = await Plan.find(planId)
    if (plan) {
      data.plan = plan.toObject()
    }

    return MantiqResponse.json({ data })
  }

  async subscribe(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number

    const body = await request.input() as { plan_id?: number }

    if (!body.plan_id) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { plan_id: 'Plan ID is required.' },
      }, 422)
    }

    const plan = await Plan.find(Number(body.plan_id))
    if (!plan) {
      return MantiqResponse.json({ message: 'Plan not found.' }, 404)
    }

    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Check for existing subscription
    const existing = await Subscription.where('tenant_id', tenantId).first()

    if (existing) {
      // Update existing subscription (change plan)
      existing.setAttribute('plan_id', Number(body.plan_id))
      existing.setAttribute('status', 'active')
      existing.setAttribute('current_period_start', now)
      existing.setAttribute('current_period_end', periodEnd)
      existing.setAttribute('cancelled_at', null)
      await existing.save()

      // Update tenant plan info
      const tenant = await Tenant.find(tenantId)
      if (tenant) {
        tenant.setAttribute('plan', plan.getAttribute('slug') as string)
        tenant.setAttribute('max_users', plan.getAttribute('max_users') as number)
        tenant.setAttribute('max_storage', plan.getAttribute('max_storage') as number)
        await tenant.save()
      }

      const data = existing.toObject()
      data.plan = plan.toObject()

      return MantiqResponse.json({ message: 'Subscription updated.', data })
    }

    // Create new subscription
    const subscription = await Subscription.create({
      tenant_id: tenantId,
      plan_id: Number(body.plan_id),
      status: 'active',
      current_period_start: now,
      current_period_end: periodEnd,
    })

    // Update tenant plan info
    const tenant = await Tenant.find(tenantId)
    if (tenant) {
      tenant.setAttribute('plan', plan.getAttribute('slug') as string)
      tenant.setAttribute('max_users', plan.getAttribute('max_users') as number)
      tenant.setAttribute('max_storage', plan.getAttribute('max_storage') as number)
      await tenant.save()
    }

    const data = subscription.toObject()
    data.plan = plan.toObject()

    return MantiqResponse.json({ message: 'Subscription created.', data }, 201)
  }

  async cancel(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number
    const subscription = await Subscription.where('tenant_id', tenantId).first()

    if (!subscription) {
      return MantiqResponse.json({ message: 'No active subscription found.' }, 404)
    }

    if (subscription.getAttribute('cancelled_at')) {
      return MantiqResponse.json({ message: 'Subscription is already cancelled.' }, 400)
    }

    subscription.setAttribute('cancelled_at', new Date().toISOString())
    await subscription.save()

    return MantiqResponse.json({ message: 'Subscription cancelled.', data: subscription.toObject() })
  }

  async resume(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number
    const subscription = await Subscription.where('tenant_id', tenantId).first()

    if (!subscription) {
      return MantiqResponse.json({ message: 'No subscription found.' }, 404)
    }

    if (!subscription.getAttribute('cancelled_at')) {
      return MantiqResponse.json({ message: 'Subscription is not cancelled.' }, 400)
    }

    subscription.setAttribute('cancelled_at', null)
    await subscription.save()

    return MantiqResponse.json({ message: 'Subscription resumed.', data: subscription.toObject() })
  }
}
