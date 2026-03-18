import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, abort } from '@mantiq/core'
import { User } from '../../Models/User.ts'

export class UserController {
  /** GET /api/users */
  async index(_request: MantiqRequest): Promise<Response> {
    const users = await User.all()
    return MantiqResponse.json({
      data: users.map((u) => u.toObject()),
      total: users.length,
    })
  }

  /** GET /api/users/:id */
  async show(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('user'))
    const user = await User.find(id)
    if (!user) abort(404, `User ${id} not found`)
    return MantiqResponse.json({ data: user!.toObject() })
  }

  /** POST /api/users */
  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input()
    const { name, email } = body

    if (!name || !email) {
      return MantiqResponse.json(
        { error: { message: 'name and email are required', status: 422 } },
        422,
      )
    }

    const user = await User.create({ name, email, role: body.role ?? 'user' })
    return MantiqResponse.json({ data: user.toObject() }, 201)
  }

  /** DELETE /api/users/:id */
  async destroy(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('user'))
    const user = await User.find(id)
    if (!user) abort(404, `User ${id} not found`)
    await user!.delete()
    return MantiqResponse.noContent()
  }
}
