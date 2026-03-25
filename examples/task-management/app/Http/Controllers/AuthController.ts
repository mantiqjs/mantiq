import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, HashManager } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'

const VALID_ROLES = ['admin', 'manager', 'member'] as const

export class AuthController {
  async register(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      name?: string; email?: string; password?: string; role?: string
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.name || body.name.trim().length === 0) {
      errors.name = 'Name is required.'
    } else if (body.name.trim().length > 100) {
      errors.name = 'Name must not exceed 100 characters.'
    }

    if (!body.email || body.email.trim().length === 0) {
      errors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.email = 'Email must be a valid email address.'
    }

    if (!body.password) {
      errors.password = 'Password is required.'
    } else if (body.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    }

    if (body.role && !(VALID_ROLES as readonly string[]).includes(body.role)) {
      errors.role = 'Role must be one of: admin, manager, member.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ errors }, 422)
    }

    // ── Check duplicate ─────────────────────────────────────────────────────
    const existing = await User.where('email', body.email!).first()
    if (existing) {
      return MantiqResponse.json({ errors: { email: 'A user with this email already exists.' } }, 422)
    }

    // ── Create user ─────────────────────────────────────────────────────────
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const user = await User.create({
      name: body.name!.trim(),
      email: body.email!.trim().toLowerCase(),
      password: await hasher.make(body.password!),
      role: body.role ?? 'member',
    })

    // ── Auto-login ──────────────────────────────────────────────────────────
    const manager = auth()
    manager.setRequest(request)
    await manager.login(user as any)

    return MantiqResponse.json({
      message: 'Registration successful.',
      user: user.toObject(),
    }, 201)
  }

  async login(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as { email?: string; password?: string; remember?: boolean }

    if (!body.email || !body.password) {
      return MantiqResponse.json({ errors: { credentials: 'Email and password are required.' } }, 422)
    }

    const manager = auth()
    manager.setRequest(request)

    const success = await manager.attempt(
      { email: body.email.trim().toLowerCase(), password: body.password },
      body.remember ?? false,
    )

    if (!success) {
      return MantiqResponse.json({ errors: { credentials: 'Invalid email or password.' } }, 401)
    }

    const user = await manager.user()
    return MantiqResponse.json({ message: 'Logged in.', user })
  }

  async logout(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    await manager.logout()
    return MantiqResponse.json({ message: 'Logged out.' })
  }

  async me(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    return MantiqResponse.json({ user })
  }
}
