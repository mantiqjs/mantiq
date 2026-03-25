import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, HashManager } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'

export class AuthController {
  async register(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      name?: string
      email?: string
      password?: string
      notification_preferences?: string
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

    // ── Create user ─────────────────────────────────────────────────────────
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const user = await User.create({
      name: body.name!.trim(),
      email: body.email!.trim().toLowerCase(),
      password: await hasher.make(body.password!),
      notification_preferences: body.notification_preferences ?? null,
    })

    // ── Auto-login ──────────────────────────────────────────────────────────
    const manager = auth()
    manager.setRequest(request)
    await manager.login(user as any)

    return MantiqResponse.json({
      message: 'Registration successful.',
      data: user.toObject(),
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

  async updatePreferences(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    if (!user) {
      return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)
    }

    const body = await request.input() as { notification_preferences?: string }

    const userModel = await User.find(user.getAuthIdentifier())
    if (!userModel) {
      return MantiqResponse.json({ message: 'User not found.' }, 404)
    }

    userModel.setAttribute('notification_preferences', body.notification_preferences ?? null)
    await userModel.save()

    return MantiqResponse.json({
      message: 'Preferences updated.',
      data: userModel.toObject(),
    })
  }
}
