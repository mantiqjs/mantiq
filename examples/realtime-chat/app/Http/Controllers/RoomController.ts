import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Room } from '../../Models/Room.ts'
import { RoomMember } from '../../Models/RoomMember.ts'
import { User } from '../../Models/User.ts'

async function getAuthUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user()
  if (!user) return null
  return (user as any).getAttribute?.('id') ?? user.getAuthIdentifier()
}

export class RoomController {
  async index(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const memberships = await RoomMember.where('user_id', userId).get() as any[]
    const roomIds = memberships.map((m: any) => m.getAttribute('room_id') as number)

    const rooms: any[] = []
    for (const rid of roomIds) {
      const room = await Room.find(rid)
      if (room) {
        const memberCount = await (RoomMember.query().where('room_id', rid) as any).count() as number
        rooms.push({ ...room.toObject(), member_count: memberCount })
      }
    }

    return MantiqResponse.json({ data: rooms })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('id'))
    const room = await Room.find(roomId)
    if (!room) return MantiqResponse.json({ error: 'Room not found.' }, 404)

    // Check membership
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first()
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 403)

    // Get members with user info
    const members = await RoomMember.where('room_id', roomId).get() as any[]
    const memberData: any[] = []
    for (const m of members) {
      const user = await User.find(m.getAttribute('user_id') as number)
      if (user) {
        memberData.push({
          ...m.toObject(),
          user: user.toObject(),
        })
      }
    }

    return MantiqResponse.json({
      data: {
        ...room.toObject(),
        members: memberData,
      },
    })
  }

  async create(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const body = await request.input() as { name?: string; description?: string; type?: string; max_members?: number }

    if (!body.name) {
      return MantiqResponse.json({ error: 'Room name is required.' }, 422)
    }

    const room = await Room.create({
      name: body.name,
      description: body.description ?? null,
      type: body.type ?? 'public',
      created_by: userId,
      max_members: body.max_members ?? 100,
    })

    const roomId = (room as any).getAttribute('id') as number

    // Creator joins as admin
    await RoomMember.create({
      room_id: roomId,
      user_id: userId,
      role: 'admin',
      joined_at: new Date().toISOString(),
      muted: 0,
    })

    const memberCount = 1

    return MantiqResponse.json({
      data: { ...room.toObject(), member_count: memberCount },
    }, 201)
  }

  async update(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('id'))
    const room = await Room.find(roomId)
    if (!room) return MantiqResponse.json({ error: 'Room not found.' }, 404)

    // Check admin role
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first() as any
    if (!membership || membership.getAttribute('role') !== 'admin') {
      return MantiqResponse.json({ error: 'Only admins can update rooms.' }, 403)
    }

    const body = await request.input() as { name?: string; description?: string; max_members?: number }

    if (body.name) room.setAttribute('name', body.name)
    if (body.description !== undefined) room.setAttribute('description', body.description)
    if (body.max_members) room.setAttribute('max_members', body.max_members)

    await room.save()
    return MantiqResponse.json({ data: room.toObject() })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const roomId = Number(request.param('id'))
    const room = await Room.find(roomId)
    if (!room) return MantiqResponse.json({ error: 'Room not found.' }, 404)

    // Only creator can delete
    if ((room as any).getAttribute('created_by') !== userId) {
      return MantiqResponse.json({ error: 'Only the creator can delete this room.' }, 403)
    }

    await room.delete()
    return MantiqResponse.json({ success: true })
  }

  async createDirect(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const body = await request.input() as { user_id?: number }
    if (!body.user_id) {
      return MantiqResponse.json({ error: 'Target user_id is required.' }, 422)
    }

    const targetUser = await User.find(body.user_id)
    if (!targetUser) return MantiqResponse.json({ error: 'User not found.' }, 404)

    // Check if DM already exists between these users
    const myDMs = await RoomMember.where('user_id', userId).get() as any[]
    for (const m of myDMs) {
      const rid = m.getAttribute('room_id') as number
      const room = await Room.find(rid)
      if (room && (room as any).getAttribute('type') === 'direct') {
        const otherMember = await RoomMember.where('room_id', rid).where('user_id', body.user_id).first()
        if (otherMember) {
          return MantiqResponse.json({ data: room.toObject() })
        }
      }
    }

    const currentUser = await User.find(userId)
    const currentName = currentUser ? (currentUser as any).getAttribute('name') : 'User'
    const targetName = (targetUser as any).getAttribute('name')

    const room = await Room.create({
      name: `${currentName} & ${targetName}`,
      description: null,
      type: 'direct',
      created_by: userId,
      max_members: 2,
    })

    const roomId = (room as any).getAttribute('id') as number
    const now = new Date().toISOString()

    await RoomMember.create({ room_id: roomId, user_id: userId, role: 'member', joined_at: now, muted: 0 })
    await RoomMember.create({ room_id: roomId, user_id: body.user_id, role: 'member', joined_at: now, muted: 0 })

    return MantiqResponse.json({ data: { ...room.toObject(), member_count: 2 } }, 201)
  }
}
