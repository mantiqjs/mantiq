import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Room } from '../../Models/Room.ts'
import { RoomMember } from '../../Models/RoomMember.ts'
import { User } from '../../Models/User.ts'
import type { MantiqRequest } from '@mantiq/core'

export class MemberController {
  /**
   * List all members of a room.
   */
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('roomId'))

    // Verify caller is a member
    const callerMembership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!callerMembership) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 403)
    }

    const members = await RoomMember.where('room_id', roomId).get()
    const userIds = members.map((m) => m.getAttribute('user_id') as number)
    const users = userIds.length > 0 ? await User.whereIn('id', userIds).get() : []

    const userMap = new Map(users.map((u) => [u.getAttribute('id') as number, u.toObject()]))
    const memberList = members.map((m) => ({
      ...m.toObject(),
      user: userMap.get(m.getAttribute('user_id') as number) ?? null,
    }))

    return MantiqResponse.json({ members: memberList })
  }

  /**
   * Invite (add) a user to a room.
   */
  async invite(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('roomId'))
    const body = await request.input()
    const inviteeId = body['user_id']

    if (!inviteeId) {
      return MantiqResponse.json({ error: 'user_id is required.' }, 422)
    }

    // Verify room exists
    const room = await Room.find(roomId)
    if (!room) {
      return MantiqResponse.json({ error: 'Room not found.' }, 404)
    }

    // Verify caller is a member
    const callerMembership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!callerMembership) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 403)
    }

    // Verify target user exists
    const targetUser = await User.find(Number(inviteeId))
    if (!targetUser) {
      return MantiqResponse.json({ error: 'User not found.' }, 404)
    }

    // Check if already a member
    const existingMembership = await RoomMember.where('room_id', roomId)
      .where('user_id', Number(inviteeId))
      .first()

    if (existingMembership) {
      return MantiqResponse.json({ error: 'User is already a member of this room.' }, 409)
    }

    // Check room capacity
    const memberCount = await RoomMember.where('room_id', roomId).count()
    const maxMembers = room.getAttribute('max_members') as number
    if (memberCount >= maxMembers) {
      return MantiqResponse.json({ error: 'Room has reached its maximum member capacity.' }, 422)
    }

    const member = await RoomMember.create({
      room_id: roomId,
      user_id: Number(inviteeId),
      role: 'member',
      joined_at: new Date().toISOString(),
      muted: 0,
    })

    return MantiqResponse.json({
      message: 'User invited to room.',
      member: member.toObject(),
    }, 201)
  }

  /**
   * Remove a user from a room. Requires admin or owner role.
   */
  async remove(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('roomId'))
    const targetUserId = Number(request.param('userId'))

    // Verify caller's membership and role
    const callerMembership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!callerMembership) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 403)
    }

    const callerRole = callerMembership.getAttribute('role') as string
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      return MantiqResponse.json({ error: 'Only owners and admins can remove members.' }, 403)
    }

    // Cannot remove yourself via this endpoint
    if (targetUserId === user.getAuthIdentifier()) {
      return MantiqResponse.json({ error: 'Use the leave endpoint to remove yourself.' }, 422)
    }

    // Find the target membership
    const targetMembership = await RoomMember.where('room_id', roomId)
      .where('user_id', targetUserId)
      .first()

    if (!targetMembership) {
      return MantiqResponse.json({ error: 'User is not a member of this room.' }, 404)
    }

    // Admin cannot remove owner
    const targetRole = targetMembership.getAttribute('role') as string
    if (targetRole === 'owner') {
      return MantiqResponse.json({ error: 'Cannot remove the room owner.' }, 403)
    }

    // Admin cannot remove another admin unless caller is owner
    if (targetRole === 'admin' && callerRole !== 'owner') {
      return MantiqResponse.json({ error: 'Only the owner can remove admins.' }, 403)
    }

    await targetMembership.delete()

    return MantiqResponse.json({ message: 'Member removed from room.' })
  }

  /**
   * Update a member's role. Only the owner can change roles.
   */
  async updateRole(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('roomId'))
    const targetUserId = Number(request.param('userId'))
    const body = await request.input()
    const newRole = body['role']

    if (!newRole || !['admin', 'member'].includes(newRole)) {
      return MantiqResponse.json({ error: 'Role must be "admin" or "member".' }, 422)
    }

    // Only owner can change roles
    const callerMembership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!callerMembership || callerMembership.getAttribute('role') !== 'owner') {
      return MantiqResponse.json({ error: 'Only the room owner can change member roles.' }, 403)
    }

    // Find target membership
    const targetMembership = await RoomMember.where('room_id', roomId)
      .where('user_id', targetUserId)
      .first()

    if (!targetMembership) {
      return MantiqResponse.json({ error: 'User is not a member of this room.' }, 404)
    }

    if (targetMembership.getAttribute('role') === 'owner') {
      return MantiqResponse.json({ error: 'Cannot change the owner\'s role.' }, 403)
    }

    targetMembership.setAttribute('role', newRole)
    await targetMembership.save()

    return MantiqResponse.json({
      message: 'Member role updated.',
      member: targetMembership.toObject(),
    })
  }

  /**
   * Leave a room.
   */
  async leave(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('roomId'))

    const membership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!membership) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 404)
    }

    // If the owner leaves, the room is not deleted — ownership should be transferred first
    if (membership.getAttribute('role') === 'owner') {
      const otherMembers = await RoomMember.where('room_id', roomId)
        .where('user_id', '!=', user.getAuthIdentifier())
        .get()

      if (otherMembers.length > 0) {
        return MantiqResponse.json({
          error: 'Transfer ownership before leaving. You are the room owner.',
        }, 422)
      }
    }

    await membership.delete()

    return MantiqResponse.json({ message: 'You have left the room.' })
  }

  /**
   * Mute notifications for this room (for the current user).
   */
  async mute(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('roomId'))

    const membership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!membership) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 404)
    }

    membership.setAttribute('muted', 1)
    await membership.save()

    return MantiqResponse.json({ message: 'Room muted.' })
  }

  /**
   * Unmute notifications for this room (for the current user).
   */
  async unmute(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const roomId = Number(request.param('roomId'))

    const membership = await RoomMember.where('room_id', roomId)
      .where('user_id', user.getAuthIdentifier())
      .first()

    if (!membership) {
      return MantiqResponse.json({ error: 'You are not a member of this room.' }, 404)
    }

    membership.setAttribute('muted', 0)
    await membership.save()

    return MantiqResponse.json({ message: 'Room unmuted.' })
  }
}
