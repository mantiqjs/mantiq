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

  /**
   * GET /api/users/stream
   *
   * SSE endpoint that streams users one-by-one in an infinite loop.
   * Each user is sent as a JSON event with a delay between them.
   */
  async stream(_request: MantiqRequest): Promise<Response> {
    const CHUNK_SIZE = 20

    const stream = new ReadableStream({
      async start(controller) {
        let eventId = 0
        const send = (event: string, data: any) => {
          eventId++
          controller.enqueue(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        }

        // Stream users in an infinite loop, paginated in chunks
        while (true) {
          try {
            // Get total count once per cycle
            const total = await User.query().count()
            send('total', { count: total })

            let offset = 0
            let page = 1

            while (true) {
              const chunk = await User.query()
                .orderBy('id', 'asc')
                .limit(CHUNK_SIZE)
                .offset(offset)
                .get() as User[]

              if (chunk.length === 0) break

              send('page', { page, size: chunk.length, total })

              for (const user of chunk) {
                send('user', user.toObject())
                await new Promise((r) => setTimeout(r, 500))
              }

              if (chunk.length < CHUNK_SIZE) break
              offset += CHUNK_SIZE
              page++
            }

            // Pause before restarting the loop
            send('cycle', { message: 'Restarting stream...' })
            await new Promise((r) => setTimeout(r, 2000))
          } catch {
            await new Promise((r) => setTimeout(r, 5000))
          }
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
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
