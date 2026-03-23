import type { MantiqRequest } from '@mantiq/core'
import { json, hash, abort } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'

export class AuthController {
  async register(request: MantiqRequest, data: Record<string, any>): Promise<Response> {
    if (await User.where('email', data.email).first()) abort(422, 'A user with this email already exists.')

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: await hash(data.password),
    })

    const manager = auth()
    manager.setRequest(request)
    await manager.login(user)

    return json({ message: 'Registered.', user: user.toObject() }, 201)
  }

  async login(request: MantiqRequest, data: Record<string, any>): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)

    const success = await manager.attempt(
      { email: data.email, password: data.password },
      data.remember ?? false,
    )
    if (!success) abort(401, 'Invalid credentials.')

    const user = await manager.user()
    return json({ message: 'Logged in.', user: user?.toObject() })
  }

  async logout(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    await manager.logout()
    return json({ message: 'Logged out.' })
  }
}
