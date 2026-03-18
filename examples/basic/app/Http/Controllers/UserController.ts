import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, abort } from '@mantiq/core'

// Simulated in-memory data store
const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith',    email: 'bob@example.com',   role: 'user'  },
  { id: 3, name: 'Carol White',  email: 'carol@example.com', role: 'user'  },
]

export class UserController {
  /** GET /api/users */
  index(_request: MantiqRequest): Response {
    return MantiqResponse.json({ data: users, total: users.length })
  }

  /** GET /api/users/:id */
  show(request: MantiqRequest): Response {
    const id = Number(request.param('user'))
    const user = users.find((u) => u.id === id)
    if (!user) abort(404, `User ${id} not found`)
    return MantiqResponse.json({ data: user })
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

    const user = { id: users.length + 1, name, email, role: 'user' }
    users.push(user)
    return MantiqResponse.json({ data: user }, 201)
  }

  /** DELETE /api/users/:id */
  destroy(request: MantiqRequest): Response {
    const id = Number(request.param('user'))
    const idx = users.findIndex((u) => u.id === id)
    if (idx === -1) abort(404, `User ${id} not found`)
    users.splice(idx, 1)
    return MantiqResponse.noContent()
  }
}
