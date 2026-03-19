import type { MantiqRequest } from '@mantiq/core'
import { json, noContent, abort, HashManager } from '@mantiq/core'
import { User } from '../../Models/User.ts'

export class UserController {
  /** GET /api/users?page=1&per_page=20&search=alice */
  async index(request: MantiqRequest): Promise<Response> {
    const page = Math.max(1, Number(request.query('page')) || 1)
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page')) || 20))
    const search = request.query('search') ?? ''

    let query = User.query()
    if (search) {
      query = query.where('name', 'like', `%${search}%`)
        .orWhere('email', 'like', `%${search}%`)
    }

    const result = await query.paginate(page, perPage)
    return json({
      data: (result.data as User[]).map((u) => u.toObject()),
      total: result.total,
      page: result.currentPage,
      per_page: perPage,
      last_page: result.lastPage,
      from: result.from,
      to: result.to,
      has_more: result.hasMore,
    })
  }

  /** GET /api/users/:id */
  async show(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('user'))
    const user = await User.find(id)
    if (!user) abort(404, `User ${id} not found`)
    return json({ data: user!.toObject() })
  }

  /** POST /api/users */
  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input()
    const { name, email } = body

    if (!name || !email) {
      return json(
        { error: { message: 'name and email are required', status: 422 } },
        422,
      )
    }

    // API-created users get a random password (admin can reset later)
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const password = await hasher.make(crypto.randomUUID())

    const user = await User.create({ name, email, role: body.role ?? 'user', password })
    return json({ data: user.toObject() }, 201)
  }

  /** PUT /api/users/:id */
  async update(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('user'))
    const user = await User.find(id)
    if (!user) abort(404, `User ${id} not found`)

    const body = await request.input()
    if (body.name) user!.set('name', body.name)
    if (body.email) user!.set('email', body.email)
    if (body.role) user!.set('role', body.role)
    await user!.save()

    return json({ data: user!.toObject() })
  }

  /** DELETE /api/users/:id */
  async destroy(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('user'))
    const user = await User.find(id)
    if (!user) abort(404, `User ${id} not found`)
    await user!.delete()
    return noContent()
  }
}
