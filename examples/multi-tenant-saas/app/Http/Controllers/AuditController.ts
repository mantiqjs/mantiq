import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { AuditLog } from '../../Models/AuditLog.ts'
import { User } from '../../Models/User.ts'

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

export class AuditController {
  async index(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number

    // Pagination
    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 15)))

    // Filters
    const action = request.query('action')
    const filterUserId = request.query('user_id')
    const dateFrom = request.query('date_from')
    const dateTo = request.query('date_to')

    // Build query for counting
    const buildQuery = () => {
      let q = AuditLog.where('tenant_id', tenantId)

      if (action) {
        q = q.where('action', action) as any
      }
      if (filterUserId) {
        q = q.where('user_id', Number(filterUserId)) as any
      }
      if (dateFrom) {
        q = q.where('created_at', '>=', dateFrom) as any
      }
      if (dateTo) {
        q = q.where('created_at', '<=', dateTo) as any
      }

      return q
    }

    const total = await buildQuery().count() as number

    const logs = await buildQuery()
      .orderBy('created_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .get() as any[]

    return MantiqResponse.json({
      data: logs.map((l: any) => l.toObject()),
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.max(1, Math.ceil(total / perPage)),
      },
    })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const user = await User.find(userId)
    if (!user) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = user.getAttribute('tenant_id') as number
    const logId = Number(request.param('id'))
    const log = await AuditLog.find(logId)

    if (!log) {
      return MantiqResponse.json({ message: 'Audit log not found.' }, 404)
    }

    if ((log.getAttribute('tenant_id') as number) !== tenantId) {
      return MantiqResponse.json({ message: 'Audit log not found.' }, 404)
    }

    return MantiqResponse.json({ data: log.toObject() })
  }
}
