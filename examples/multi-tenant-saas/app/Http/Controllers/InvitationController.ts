import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, HashManager } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Invitation } from '../../Models/Invitation.ts'
import { User } from '../../Models/User.ts'
import { Tenant } from '../../Models/Tenant.ts'
import { Subscription } from '../../Models/Subscription.ts'
import { Plan } from '../../Models/Plan.ts'

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

export class InvitationController {
  async index(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number
    const invitations = await Invitation.where('tenant_id', tenantId)
      .where('accepted_at', null)
      .get() as any[]

    return MantiqResponse.json({
      data: invitations.map((inv: any) => inv.toObject()),
    })
  }

  async invite(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number

    const body = await request.input() as {
      email?: string
      role?: string
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.email || !body.email.trim()) {
      errors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.email = 'Email must be a valid email address.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ message: 'Validation failed.', errors }, 422)
    }

    // Check if user already exists in this tenant
    const existingUser = await User.where('email', body.email!)
      .where('tenant_id', tenantId)
      .first()
    if (existingUser) {
      return MantiqResponse.json({ message: 'This user is already a member of your organization.' }, 409)
    }

    // Check if invitation already pending
    const existingInvite = await Invitation.where('email', body.email!)
      .where('tenant_id', tenantId)
      .where('accepted_at', null)
      .first()
    if (existingInvite) {
      return MantiqResponse.json({ message: 'An invitation has already been sent to this email.' }, 409)
    }

    // ── Check plan user limit ───────────────────────────────────────────────
    const subscription = await Subscription.where('tenant_id', tenantId).first()
    if (subscription) {
      const planId = subscription.getAttribute('plan_id') as number
      const plan = await Plan.find(planId)
      if (plan) {
        const maxUsers = plan.getAttribute('max_users') as number
        const currentUserCount = await User.where('tenant_id', tenantId).count() as number
        const pendingInviteCount = await Invitation.where('tenant_id', tenantId)
          .where('accepted_at', null)
          .count() as number

        if (currentUserCount + pendingInviteCount >= maxUsers) {
          return MantiqResponse.json({
            message: 'User limit reached for your current plan. Please upgrade to invite more users.',
          }, 403)
        }
      }
    }

    // ── Generate token ──────────────────────────────────────────────────────
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const invitation = await Invitation.create({
      tenant_id: tenantId,
      email: body.email!.trim().toLowerCase(),
      role: body.role ?? 'member',
      token,
      invited_by: userId,
      expires_at: expiresAt,
    })

    return MantiqResponse.json({
      message: 'Invitation sent.',
      data: invitation.toObject(),
    }, 201)
  }

  async accept(request: MantiqRequest): Promise<Response> {
    const token = request.param('token')
    const invitation = await Invitation.where('token', token).first()

    if (!invitation) {
      return MantiqResponse.json({ message: 'Invalid invitation token.' }, 404)
    }

    // Check if already accepted
    if (invitation.getAttribute('accepted_at')) {
      return MantiqResponse.json({ message: 'This invitation has already been accepted.' }, 400)
    }

    // Check expiration
    const expiresAt = new Date(invitation.getAttribute('expires_at') as string)
    if (expiresAt < new Date()) {
      return MantiqResponse.json({ message: 'This invitation has expired.' }, 400)
    }

    const body = await request.input() as {
      name?: string
      password?: string
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.name || !body.name.trim()) {
      errors.name = 'Name is required.'
    }
    if (!body.password) {
      errors.password = 'Password is required.'
    } else if (body.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ message: 'Validation failed.', errors }, 422)
    }

    const email = invitation.getAttribute('email') as string
    const tenantId = invitation.getAttribute('tenant_id') as number
    const role = invitation.getAttribute('role') as string

    // Check if user with this email already exists
    const existingUser = await User.where('email', email).first()
    if (existingUser) {
      return MantiqResponse.json({ message: 'A user with this email already exists.' }, 409)
    }

    // ── Create user ─────────────────────────────────────────────────────────
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const user = await User.create({
      name: body.name!.trim(),
      email,
      password: await hasher.make(body.password!),
      tenant_id: tenantId,
      role,
    })

    // Mark invitation as accepted
    invitation.setAttribute('accepted_at', new Date().toISOString())
    await invitation.save()

    return MantiqResponse.json({
      message: 'Invitation accepted.',
      data: user.toObject(),
    }, 201)
  }

  async revoke(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number
    const invitationId = Number(request.param('id'))
    const invitation = await Invitation.find(invitationId)

    if (!invitation) {
      return MantiqResponse.json({ message: 'Invitation not found.' }, 404)
    }

    if ((invitation.getAttribute('tenant_id') as number) !== tenantId) {
      return MantiqResponse.json({ message: 'Invitation not found.' }, 404)
    }

    await invitation.delete()

    return MantiqResponse.json({ message: 'Invitation revoked.' })
  }
}
