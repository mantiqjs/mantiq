import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Reaction } from '../../Models/Reaction.ts'
import { Message } from '../../Models/Message.ts'
import { RoomMember } from '../../Models/RoomMember.ts'

async function getAuthUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user()
  if (!user) return null
  return (user as any).getAttribute?.('id') ?? user.getAuthIdentifier()
}

export class ReactionController {
  async add(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const messageId = Number(request.param('messageId'))
    const message = await Message.find(messageId)
    if (!message) return MantiqResponse.json({ error: 'Message not found.' }, 404)

    // Check user is member of the room
    const roomId = (message as any).getAttribute('room_id') as number
    const membership = await RoomMember.where('room_id', roomId).where('user_id', userId).first()
    if (!membership) return MantiqResponse.json({ error: 'Not a member of this room.' }, 403)

    const body = await request.input() as { emoji?: string }
    if (!body.emoji) {
      return MantiqResponse.json({ error: 'Emoji is required.' }, 422)
    }

    // Check if already reacted with same emoji
    const existing = await Reaction.where('message_id', messageId)
      .where('user_id', userId)
      .where('emoji', body.emoji)
      .first()

    if (existing) {
      return MantiqResponse.json({ error: 'Already reacted with this emoji.' }, 422)
    }

    const reaction = await Reaction.create({
      message_id: messageId,
      user_id: userId,
      emoji: body.emoji,
    })

    return MantiqResponse.json({ data: reaction.toObject() }, 201)
  }

  async remove(request: MantiqRequest): Promise<Response> {
    const userId = await getAuthUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const messageId = Number(request.param('messageId'))
    const body = await request.input() as { emoji?: string }
    if (!body.emoji) {
      return MantiqResponse.json({ error: 'Emoji is required.' }, 422)
    }

    const reaction = await Reaction.where('message_id', messageId)
      .where('user_id', userId)
      .where('emoji', body.emoji)
      .first()

    if (!reaction) return MantiqResponse.json({ error: 'Reaction not found.' }, 404)

    await reaction.delete()
    return MantiqResponse.json({ success: true })
  }
}
