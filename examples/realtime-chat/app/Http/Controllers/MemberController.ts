import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { RoomMember } from '../../Models/RoomMember.ts'
import { User } from '../../Models/User.ts'

async function getAuthUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user()
  if (!user) return null
  return (user as any).getAttribute?.('id') ?? user.getAuthIdentifier()
}

export class MemberController {
  async index(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))

    // Check membership
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first()
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 403)

    const members = await RoomMember.where('room_id', roomId).get() as any[]
    const data: any[] = []
    for (const m of members) {
      const user = await User.find(m.getAttribute('user_id') as number)
      if (user) {
        data.push({
          ...m.toObject(),
          user: user.toObject(),
        })
      }
    }

    return MantiqResponse.json({ data })
  }

  async invite(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))
    const body = await request.input() as { user_id?: number }

    if (!body.user_id) {
      return MantiqResponse.json({ error: 'user_id is required.' }, 422)
    }

    // Check caller is member
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first()
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 403)

    // Check target user exists
    const targetUser = await User.find(body.user_id)
    if (!targetUser) return MantiqResponse.json({ error: 'User not found.' }, 404)

    // Check not already member
    const existing = await RoomMember.where('room_id', roomId).where('user_id', body.user_id).first()
    if (existing) return MantiqResponse.json({ error: 'User is already a member.' }, 422)

    const member = await RoomMember.create({
      room_id: roomId,
      user_id: body.user_id,
      role: 'member',
      joined_at: new Date().toISOString(),
      muted: 0,
    })

    return MantiqResponse.json({ data: { ...member.toObject(), user: targetUser.toObject() } }, 201)
  }

  async remove(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))
    const targetUserId = Number(request.param('userId'))

    // Check caller is admin
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first() as any
    if (!membership || membership.getAttribute('role') !== 'admin') {
      return MantiqResponse.json({ error: 'Only admins can remove members.' }, 403)
    }

    const target = await RoomMember.where('room_id', roomId).where('user_id', targetUserId).first()
    if (!target) return MantiqResponse.json({ error: 'Member not found.' }, 404)

    await target.delete()
    return MantiqResponse.json({ success: true })
  }

  async updateRole(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))
    const targetUserId = Number(request.param('userId'))
    const body = await request.input() as { role?: string }

    if (!body.role || !['admin', 'member'].includes(body.role)) {
      return MantiqResponse.json({ error: 'Valid role (admin or member) is required.' }, 422)
    }

    // Check caller is admin
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first() as any
    if (!membership || membership.getAttribute('role') !== 'admin') {
      return MantiqResponse.json({ error: 'Only admins can change roles.' }, 403)
    }

    const target = await RoomMember.where('room_id', roomId).where('user_id', targetUserId).first() as any
    if (!target) return MantiqResponse.json({ error: 'Member not found.' }, 404)

    target.setAttribute('role', body.role)
    await target.save()
    return MantiqResponse.json({ data: target.toObject() })
  }

  async leave(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))

    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first()
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 404)

    await membership.delete()
    return MantiqResponse.json({ success: true })
  }

  async mute(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))

    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first() as any
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 404)

    membership.setAttribute('muted', 1)
    await membership.save()
    return MantiqResponse.json({ data: membership.toObject() })
  }

  async unmute(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('roomId'))

    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first() as any
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 404)

    membership.setAttribute('muted', 0)
    await membership.save()
    return MantiqResponse.json({ data: membership.toObject() })
  }
}
