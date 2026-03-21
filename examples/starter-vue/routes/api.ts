import type { Router } from '@mantiq/core'
import { MantiqResponse, HashManager } from '@mantiq/core'
import { User } from '../app/Models/User.ts'

export default function (router: Router) {
  router.get('/api/ping', () => {
    return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Users CRUD — server-side search + pagination
  router.get('/api/users', async (request: any) => {
    const search = request.query('search') ?? ''
    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 10)))
    const sortBy = request.query('sort') ?? 'created_at'
    const sortDir = request.query('dir') === 'asc' ? 'asc' : 'desc'

    let query = User.query()

    if (search) {
      query = query.where('name', 'LIKE', `%${search}%`)
        .orWhere('email', 'LIKE', `%${search}%`) as any
    }

    const total = await (User.query() as any).count() as number
    const filteredQuery = search
      ? User.query().where('name', 'LIKE', `%${search}%`).orWhere('email', 'LIKE', `%${search}%`) as any
      : User.query()

    const filteredTotal = await filteredQuery.count() as number

    const users = search
      ? await User.query()
          .where('name', 'LIKE', `%${search}%`)
          .orWhere('email', 'LIKE', `%${search}%`)
          .orderBy(sortBy, sortDir)
          .limit(perPage)
          .offset((page - 1) * perPage)
          .get() as any[]
      : await User.query()
          .orderBy(sortBy, sortDir)
          .limit(perPage)
          .offset((page - 1) * perPage)
          .get() as any[]

    return MantiqResponse.json({
      data: users.map((u: any) => u.toObject()),
      meta: {
        total,
        filtered_total: filteredTotal,
        page,
        per_page: perPage,
        last_page: Math.ceil(filteredTotal / perPage),
      },
    })
  }).middleware('auth')

  router.post('/api/users', async (request: any) => {
    const body = await request.input()
    if (!body?.name || !body?.email || !body?.password) {
      return MantiqResponse.json({ error: 'Name, email and password are required.' }, 422)
    }

    // Check duplicate
    const existing = await User.where('email', body.email).first()
    if (existing) {
      return MantiqResponse.json({ error: 'Email already exists.' }, 422)
    }

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const user = await User.create({
      name: body.name,
      email: body.email,
      password: await hasher.make(body.password),
    })

    return MantiqResponse.json({ data: user.toObject() }, 201)
  }).middleware('auth')

  router.put('/api/users/:id', async (request: any) => {
    const id = request.param('id')
    const body = await request.input()
    const user = await User.find(Number(id))
    if (!user) return MantiqResponse.json({ error: 'User not found.' }, 404)

    if (body.name) user.setAttribute('name', body.name)
    if (body.email) user.setAttribute('email', body.email)

    if (body.password) {
      const hasher = new HashManager({ bcrypt: { rounds: 10 } })
      user.setAttribute('password', await hasher.make(body.password))
    }

    await user.save()
    return MantiqResponse.json({ data: user.toObject() })
  }).middleware('auth')

  router.delete('/api/users/:id', async (request: any) => {
    const id = request.param('id')
    const user = await User.find(Number(id))
    if (!user) return MantiqResponse.json({ error: 'User not found.' }, 404)

    await user.delete()
    return MantiqResponse.json({ success: true })
  }).middleware('auth')
}
