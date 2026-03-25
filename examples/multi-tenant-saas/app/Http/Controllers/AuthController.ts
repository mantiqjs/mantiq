import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, HashManager } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'
import { Tenant } from '../../Models/Tenant.ts'
import { Plan } from '../../Models/Plan.ts'
import { Subscription } from '../../Models/Subscription.ts'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

export class AuthController {
  async register(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      name?: string
      email?: string
      password?: string
      company_name?: string
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.name || !body.name.trim()) {
      errors.name = 'Name is required.'
    }
    if (!body.email || !body.email.trim()) {
      errors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.email = 'Email must be a valid email address.'
    }
    if (!body.password) {
      errors.password = 'Password is required.'
    } else if (body.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    }
    if (!body.company_name || !body.company_name.trim()) {
      errors.company_name = 'Company name is required.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ message: 'Validation failed.', errors }, 422)
    }

    // ── Uniqueness check ────────────────────────────────────────────────────
    const existing = await User.where('email', body.email!).first()
    if (existing) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { email: 'A user with this email already exists.' },
      }, 422)
    }

    // ── Create tenant ───────────────────────────────────────────────────────
    let slug = slugify(body.company_name!)
    const existingTenant = await Tenant.where('slug', slug).first()
    if (existingTenant) {
      slug = `${slug}-${Date.now()}`
    }

    const tenant = await Tenant.create({
      name: body.company_name!.trim(),
      slug,
      plan: 'free',
      status: 'active',
      max_users: 3,
      max_storage: 104857600,
    })

    const tenantId = tenant.getAttribute('id') as number

    // ── Create user (owner) ─────────────────────────────────────────────────
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const user = await User.create({
      name: body.name!.trim(),
      email: body.email!.trim().toLowerCase(),
      password: await hasher.make(body.password!),
      tenant_id: tenantId,
      role: 'owner',
    })

    // ── Create subscription on free plan ────────────────────────────────────
    const freePlan = await Plan.where('slug', 'free').first()
    if (freePlan) {
      const planId = freePlan.getAttribute('id') as number
      const now = new Date().toISOString()
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await Subscription.create({
        tenant_id: tenantId,
        plan_id: planId,
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
      })
    }

    // ── Auto-login ──────────────────────────────────────────────────────────
    const manager = auth()
    manager.setRequest(request)
    await manager.login(user as any)

    return MantiqResponse.json({
      message: 'Registration successful.',
      data: {
        user: user.toObject(),
        tenant: tenant.toObject(),
      },
    }, 201)
  }

  async login(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      email?: string
      password?: string
      remember?: boolean
    }

    // ── Validation ──────────────────────────────────────────────────────────
    if (!body.email || !body.password) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: {
          ...(!body.email ? { email: 'Email is required.' } : {}),
          ...(!body.password ? { password: 'Password is required.' } : {}),
        },
      }, 422)
    }

    // ── Attempt login ───────────────────────────────────────────────────────
    const manager = auth()
    manager.setRequest(request)

    const success = await manager.attempt(
      { email: body.email, password: body.password },
      body.remember ?? false,
    )

    if (!success) {
      return MantiqResponse.json({ message: 'Invalid credentials.' }, 401)
    }

    const user = await manager.user()
    return MantiqResponse.json({
      message: 'Login successful.',
      data: user,
    })
  }

  async logout(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    await manager.logout()
    return MantiqResponse.json({ message: 'Logged out successfully.' })
  }

  async me(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    if (!user) {
      return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)
    }

    return MantiqResponse.json({ data: user })
  }
}
