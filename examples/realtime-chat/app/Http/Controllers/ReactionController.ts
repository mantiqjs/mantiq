import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Reaction } from '../../Models/Reaction.ts'
import { Message } from '../../Models/Message.ts'
import { RoomMember } from '../../Models/RoomMember.ts'

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

export class ReactionController {
  async add(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const messageId = Number(request.param('messageId'))
    const message = await Message.find(messageId)
    if (!message) return MantiqResponse.json({ error: 'Message not found.' }, 404)

    const roomId = message.getAttribute('room_id') as number
    const member = await RoomMember.query().where('room_id', roomId).where('user_id', userId).first()
    if (!member) return MantiqResponse.json({ error: 'You are not a member of this room.' }, 403)

    const body = await request.input() as { emoji?: string }
    if (!body.emoji?.trim()) {
      return MantiqResponse.json({ error: 'Emoji is required.' }, 422)
    }

    const existing = await Reaction.query()
      .where('message_id', messageId)
      .where('user_id', userId)
      .where('emoji', body.emoji)
      .first()
    if (existing) {
      return MantiqResponse.json({ error: 'You already reacted with this emoji.' }, 409)
    }

    const reaction = await Reaction.create({
      message_id: messageId,
      user_id: userId,
      emoji: body.emoji.trim(),
    })

    return MantiqResponse.json({ data: reaction.toObject() }, 201)
  }

  async remove(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const messageId = Number(request.param('messageId'))
    const emoji = request.param('emoji')

    const reaction = await Reaction.query()
      .where('message_id', messageId)
      .where('user_id', userId)
      .where('emoji', decodeURIComponent(emoji ?? ''))
      .first() as any

    if (!reaction) return MantiqResponse.json({ error: 'Reaction not found.' }, 404)

    await reaction.delete()
    return MantiqResponse.json({ message: 'Reaction removed.' })
  }
}
