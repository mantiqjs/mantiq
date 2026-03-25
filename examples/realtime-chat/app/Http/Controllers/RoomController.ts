import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Room } from '../../Models/Room.ts'
import { RoomMember } from '../../Models/RoomMember.ts'
import { User } from '../../Models/User.ts'
import type { MantiqRequest } from '@mantiq/core'

export class RoomController {
  /**
   * List rooms the authenticated user belongs to.
   */
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const userId = user.getAuthIdentifier()

    // Get room IDs the user is a member of
    const memberships = await RoomMember.where('user_id', userId).get()
    const roomIds = memberships.map((m) => m.getAttribute('room_id') as number)

    if (roomIds.length === 0) {
      return MantiqResponse.json({ rooms: [] })
    }

    const rooms = await Room.whereIn('id', roomIds).get()

    return MantiqResponse.json({
      rooms: rooms.map((r) => r.toObject()),
    })
  }

  /**
   * Show room details with member list.
   */
  async show(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('id'))
    const room = await Room.find(roomId)
    if (!room) {
      return MantiqResponse.json({ error: 'Room not found.' }, 404)
    }

    // Verify membership
    const membership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!membership) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 403)
    }

    // Fetch members with user details
    const members = await RoomMember.where('room_id', roomId).get()
    const memberUserIds = members.map((m) => m.getAttribute('user_id') as number)
    const users = memberUserIds.length > 0
      ? await User.whereIn('id', memberUserIds).get()
      : []

    const userMap = new Map(users.map((u) => [u.getAttribute('id') as number, u.toObject()]))
    const memberList = members.map((m) => ({
      ...m.toObject(),
      user: userMap.get(m.getAttribute('user_id') as number) ?? null,
    }))

    return MantiqResponse.json({
      room: room.toObject(),
      members: memberList,
    })
  }

  /**
   * Create a new room. The creator becomes the owner.
   */
  async create(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const body = await request.input()
    const name = body['name']
    if (!name) {
      return MantiqResponse.json({ error: 'Room name is required.' }, 422)
    }

    const room = await Room.create({
      name,
      description: body['description'] ?? null,
      type: body['type'] ?? 'public',
      created_by: user.getAuthIdentifier(),
      max_members: body['max_members'] ?? 100,
    })

    // Add creator as owner
    await RoomMember.create({
      room_id: room.getAttribute('id'),
      user_id: user.getAuthIdentifier(),
      role: 'owner',
      joined_at: new Date().toISOString(),
      muted: 0,
    })

    return MantiqResponse.json({
      message: 'Room created.',
      room: room.toObject(),
    }, 201)
  }

  /**
   * Update room details. Only owner or admin can update.
   */
  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('id'))
    const room = await Room.find(roomId)
    if (!room) {
      return MantiqResponse.json({ error: 'Room not found.' }, 404)
    }

    // Check permission: owner or admin only
    const membership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!membership) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 403)
    }

    const role = membership.getAttribute('role') as string
    if (role !== 'owner' && role !== 'admin') {
      return MantiqResponse.json({ error: 'Only owners and admins can update the room.' }, 403)
    }

    const body = await request.input()
    if (body['name'] !== undefined) room.setAttribute('name', body['name'])
    if (body['description'] !== undefined) room.setAttribute('description', body['description'])
    if (body['max_members'] !== undefined) room.setAttribute('max_members', body['max_members'])

    await room.save()

    return MantiqResponse.json({
      message: 'Room updated.',
      room: room.toObject(),
    })
  }

  /**
   * Delete a room. Only the owner can delete.
   */
  async delete(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('id'))
    const room = await Room.find(roomId)
    if (!room) {
      return MantiqResponse.json({ error: 'Room not found.' }, 404)
    }

    // Only owner can delete
    const membership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!membership || membership.getAttribute('role') !== 'owner') {
      return MantiqResponse.json({ error: 'Only the room owner can delete the room.' }, 403)
    }

    // Clean up: remove all members, messages, reactions
    const messages = await (await import('../../Models/Message.ts')).Message.where('room_id', roomId).get()
    for (const msg of messages) {
      const { Reaction } = await import('../../Models/Reaction.ts')
      const reactions = await Reaction.where('message_id', msg.getAttribute('id')).get()
      for (const r of reactions) await r.delete()
      await msg.delete()
    }

    const members = await RoomMember.where('room_id', roomId).get()
    for (const m of members) await m.delete()

    await room.delete()

    return MantiqResponse.json({ message: 'Room deleted.' })
  }

  /**
   * Create or retrieve an existing direct message room between two users.
   */
  async createDirect(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const body = await request.input()
    const targetUserId = body['user_id']
    if (!targetUserId) {
      return MantiqResponse.json({ error: 'Target user_id is required.' }, 422)
    }

    const currentUserId = user.getAuthIdentifier()
    if (Number(targetUserId) === currentUserId) {
      return MantiqResponse.json({ error: 'Cannot create a DM with yourself.' }, 422)
    }

    // Check target user exists
    const targetUser = await User.find(Number(targetUserId))
    if (!targetUser) {
      return MantiqResponse.json({ error: 'Target user not found.' }, 404)
    }

    // Check if a DM room already exists between the two users
    const myDmMemberships = await RoomMember.where('user_id', currentUserId).get()
    const myDmRoomIds = myDmMemberships.map((m) => m.getAttribute('room_id') as number)

    if (myDmRoomIds.length > 0) {
      const dmRooms = await Room.where('type', 'direct').whereIn('id', myDmRoomIds).get()
      for (const dmRoom of dmRooms) {
        const otherMember = await RoomMember.where('room_id', dmRoom.getAttribute('id'))
          .where('user_id', Number(targetUserId))
          .first()
        if (otherMember) {
          return MantiqResponse.json({
            message: 'Direct message room already exists.',
            room: dmRoom.toObject(),
          })
        }
      }
    }

    // Create a new direct message room
    const currentUserModel = await User.find(currentUserId)
    const dmRoom = await Room.create({
      name: `DM: ${currentUserModel?.getAttribute('name') ?? 'User'} & ${targetUser.getAttribute('name')}`,
      description: null,
      type: 'direct',
      created_by: currentUserId,
      max_members: 2,
    })

    const now = new Date().toISOString()

    await RoomMember.create({
      room_id: dmRoom.getAttribute('id'),
      user_id: currentUserId,
      role: 'member',
      joined_at: now,
      muted: 0,
    })

    await RoomMember.create({
      room_id: dmRoom.getAttribute('id'),
      user_id: Number(targetUserId),
      role: 'member',
      joined_at: now,
      muted: 0,
    })

    return MantiqResponse.json({
      message: 'Direct message room created.',
      room: dmRoom.toObject(),
    }, 201)
  }
}
