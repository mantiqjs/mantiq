import { MantiqResponse, HashManager } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'
import type { MantiqRequest } from '@mantiq/core'

export class AuthController {
  /**
   * Register a new user account.
   */
  async register(request: MantiqRequest): Promise<Response> {
    const body = await request.input()
    const name = body['name']
    const email = body['email']
    const password = body['password']

    if (!name || !email || !password) {
      return MantiqResponse.json({ error: 'Name, email, and password are required.' }, 422)
    }

    // Check for duplicate email
    const existing = await User.where('email', email).first()
    if (existing) {
      return MantiqResponse.json({ error: 'A user with this email already exists.' }, 409)
    }

    const hasher = new HashManager({ driver: 'bcrypt', bcrypt: { rounds: 10 } })
    const hashed = await hasher.make(password)

    const user = await User.create({
      name,
      email,
      password: hashed,
      status: 'online',
      last_seen_at: new Date().toISOString(),
    })

    // Log the user in
    const manager = auth()
    manager.setRequest(request)
    await manager.login(user)

    return MantiqResponse.json({
      message: 'Registration successful.',
      user: user.toObject(),
    }, 201)
  }

  /**
   * Authenticate and log in.
   */
  async login(request: MantiqRequest): Promise<Response> {
    const body = await request.input()
    const email = body['email']
    const password = body['password']

    if (!email || !password) {
      return MantiqResponse.json({ error: 'Email and password are required.' }, 422)
    }

    const manager = auth()
    manager.setRequest(request)
    const success = await manager.attempt({ email, password })

    if (!success) {
      return MantiqResponse.json({ error: 'Invalid credentials.' }, 401)
    }

    // Update user status
    const user = await manager.user()
    if (user) {
      const userModel = await User.find(user.getAuthIdentifier())
      if (userModel) {
        userModel.setAttribute('status', 'online')
        userModel.setAttribute('last_seen_at', new Date().toISOString())
        await userModel.save()
      }
    }

    const authedUser = await manager.user()
    return MantiqResponse.json({
      message: 'Login successful.',
      user: authedUser ? (authedUser as User).toObject() : null,
    })
  }

  /**
   * Log out the current user.
   */
  async logout(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)

    const user = await manager.user()
    if (user) {
      const userModel = await User.find(user.getAuthIdentifier())
      if (userModel) {
        userModel.setAttribute('status', 'offline')
        userModel.setAttribute('last_seen_at', new Date().toISOString())
        await userModel.save()
      }
    }

    await manager.logout()

    return MantiqResponse.json({ message: 'Logged out successfully.' })
  }

  /**
   * Get the authenticated user's profile.
   */
  async me(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    return MantiqResponse.json({ user: (user as User).toObject() })
  }

  /**
   * Update the authenticated user's profile (name and avatar).
   */
  async updateProfile(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const body = await request.input()
    const userModel = await User.find(user.getAuthIdentifier())
    if (!userModel) {
      return MantiqResponse.json({ error: 'User not found.' }, 404)
    }

    if (body['name'] !== undefined) {
      userModel.setAttribute('name', body['name'])
    }
    if (body['avatar_url'] !== undefined) {
      userModel.setAttribute('avatar_url', body['avatar_url'])
    }

    await userModel.save()

    return MantiqResponse.json({
      message: 'Profile updated.',
      user: userModel.toObject(),
    })
  }
}
