import type { MantiqRequest } from '@mantiq/core'
import { json, HashManager } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'

export class AuthController {
  /** POST /register — create account + auto-login */
  async register(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as { name?: string; email?: string; password?: string; password_confirmation?: string }

    if (!body.name || !body.email || !body.password) {
      return json({ error: 'Name, email and password are required.' }, 422)
    }
    if (body.password.length < 6) {
      return json({ error: 'Password must be at least 6 characters.' }, 422)
    }
    if (body.password_confirmation && body.password !== body.password_confirmation) {
      return json({ error: 'Passwords do not match.' }, 422)
    }

    // Check if email already taken
    const existing = await User.where('email', body.email).first()
    if (existing) {
      return json({ error: 'A user with this email already exists.' }, 422)
    }

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make(body.password)

    const user = await User.create({
      name: body.name,
      email: body.email,
      password: hashed,
      role: 'user',
    })

    // Auto-login after registration
    const manager = auth()
    manager.setRequest(request)
    await manager.login(user as any)

    return json({ message: 'Registered.', user: user.toObject() }, 201)
  }

  /** POST /login — authenticate via email + password */
  async login(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as { email?: string; password?: string; remember?: boolean }

    if (!body.email || !body.password) {
      return json({ error: 'Email and password are required.' }, 422)
    }

    const manager = auth()
    manager.setRequest(request)

    const success = await manager.attempt(
      { email: body.email, password: body.password },
      body.remember ?? false,
    )

    if (!success) {
      return json({ error: 'Invalid credentials.' }, 401)
    }

    const user = await manager.user()
    return json({ message: 'Logged in.', user })
  }

  /** POST /logout — end the session */
  async logout(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    await manager.logout()
    return json({ message: 'Logged out.' })
  }

  /** GET /me — return the authenticated user */
  async me(request: MantiqRequest): Promise<Response> {
    const user = request.user()
    if (!user) {
      return json({ error: 'Unauthenticated.' }, 401)
    }
    return json({ user })
  }
}
