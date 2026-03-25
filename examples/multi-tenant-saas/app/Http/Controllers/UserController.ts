import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { User } from '../../Models/User.ts'

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

export class UserController {
  async index(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const currentUser = await User.find(userId)
    if (!currentUser) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = currentUser.getAttribute('tenant_id') as number
    const users = await User.where('tenant_id', tenantId).get() as any[]

    return MantiqResponse.json({
      data: users.map((u: any) => u.toObject()),
    })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const currentUser = await User.find(userId)
    if (!currentUser) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const tenantId = currentUser.getAttribute('tenant_id') as number
    const targetId = Number(request.param('id'))
    const targetUser = await User.find(targetId)

    if (!targetUser) {
      return MantiqResponse.json({ message: 'User not found.' }, 404)
    }

    // Ensure same tenant
    if ((targetUser.getAttribute('tenant_id') as number) !== tenantId) {
      return MantiqResponse.json({ message: 'User not found.' }, 404)
    }

    return MantiqResponse.json({ data: targetUser.toObject() })
  }

  async update(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const currentUser = await User.find(userId)
    if (!currentUser) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const currentRole = currentUser.getAttribute('role') as string
    if (currentRole !== 'owner' && currentRole !== 'admin') {
      return MantiqResponse.json({ message: 'Only owners and admins can update user roles.' }, 403)
    }

    const tenantId = currentUser.getAttribute('tenant_id') as number
    const targetId = Number(request.param('id'))
    const targetUser = await User.find(targetId)

    if (!targetUser) {
      return MantiqResponse.json({ message: 'User not found.' }, 404)
    }

    if ((targetUser.getAttribute('tenant_id') as number) !== tenantId) {
      return MantiqResponse.json({ message: 'User not found.' }, 404)
    }

    const body = await request.input() as { role?: string }

    if (body.role !== undefined) {
      const validRoles = ['owner', 'admin', 'member']
      if (!validRoles.includes(body.role)) {
        return MantiqResponse.json({
          message: 'Validation failed.',
          errors: { role: 'Role must be one of: owner, admin, member.' },
        }, 422)
      }
      targetUser.setAttribute('role', body.role)
    }

    await targetUser.save()

    return MantiqResponse.json({ message: 'User updated.', data: targetUser.toObject() })
  }

  async remove(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const currentUser = await User.find(userId)
    if (!currentUser) return MantiqResponse.json({ message: 'User not found.' }, 404)

    const currentRole = currentUser.getAttribute('role') as string
    if (currentRole !== 'owner' && currentRole !== 'admin') {
      return MantiqResponse.json({ message: 'Only owners and admins can remove users.' }, 403)
    }

    const tenantId = currentUser.getAttribute('tenant_id') as number
    const targetId = Number(request.param('id'))

    // Cannot remove self
    if (targetId === userId) {
      return MantiqResponse.json({ message: 'You cannot remove yourself.' }, 400)
    }

    const targetUser = await User.find(targetId)

    if (!targetUser) {
      return MantiqResponse.json({ message: 'User not found.' }, 404)
    }

    if ((targetUser.getAttribute('tenant_id') as number) !== tenantId) {
      return MantiqResponse.json({ message: 'User not found.' }, 404)
    }

    await targetUser.delete()

    return MantiqResponse.json({ message: 'User removed.' })
  }
}
