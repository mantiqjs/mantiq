import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'

export class AuthController {
  /** POST /login — authenticate via email + password */
  async login(request: MantiqRequest): Promise<Response> {
    const body = await request.json() as { email?: string; password?: string; remember?: boolean }

    if (!body.email || !body.password) {
      return MantiqResponse.json({ error: 'Email and password are required.' }, 422)
    }

    const manager = auth()
    const success = await manager.attempt(
      { email: body.email, password: body.password },
      body.remember ?? false,
    )

    if (!success) {
      return MantiqResponse.json({ error: 'Invalid credentials.' }, 401)
    }

    const user = await manager.user()
    return MantiqResponse.json({ message: 'Logged in.', user })
  }

  /** POST /logout — end the session */
  async logout(_request: MantiqRequest): Promise<Response> {
    await auth().logout()
    return MantiqResponse.json({ message: 'Logged out.' })
  }

  /** GET /me — return the authenticated user */
  async me(request: MantiqRequest): Promise<Response> {
    const user = request.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }
    return MantiqResponse.json({ user })
  }
}
